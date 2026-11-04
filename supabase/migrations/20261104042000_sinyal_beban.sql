-- F3-07B (docs/research/sinyal-risiko-beban.md, docs/design/sinyal-beban-layar.md): kartu info "Beban dan kabar tim" untuk pemilik.
-- Tiga sinyal per orang dari data yang sudah ada, dihitung untuk minggu penuh sebelum p_senin di zona usaha:
--   berat  : beban per jam > 1,5 x rata-rata tim, 3 minggu berturut-turut, rata-rata hanya dari orang berkerja dan n >= 3;
--   lintas : kerja lintas topi 3 minggu terakhir >= 3 dan poinnya >= 2 x 3 minggu sebelumnya;
--   sakit  : hari sakit disetujui 4 minggu terakhir >= 3 dan >= 2 x rata-rata 4 minggu dari 12 minggu sebelumnya (hanya bila
--            orang sudah tercatat >= 16 minggu). Tanpa alasan dan bukti izin.
-- Kartu muncul bila sinyal berat menyala, atau minimal dua sinyal menyala. Bukan prediksi orang berhenti.

create or replace function app.sinyal_beban(p_pid uuid, p_senin date)
returns table (orang_id uuid, nama text, berat boolean, poin40 numeric[], rata40 numeric[], rasio numeric, tim_n integer[],
               lintas boolean, lintas_baru integer, lintas_lama_poin numeric, lintas_baru_poin numeric,
               sakit boolean, sakit_hari integer, sakit_rata numeric, sakit_dihitung boolean, nyala boolean)
language sql stable set search_path = '' as $$
  with mg as (select g as ke, p_senin - 7 * g as mulai from generate_series(1, 6) g),
  b as (
    select mg.ke, x.orang_id, x.nama, x.poin, x.jam, x.lintas_poin, x.lintas_n,
           case when x.jam > 0 then x.poin / x.jam else 0 end as bpj
      from mg cross join lateral app.beban_orang(p_pid, mg.mulai) x
  ),
  tim as (
    select ke, avg(bpj) filter (where poin > 0) as rata, (count(*) filter (where poin > 0))::integer as n from b group by ke
  ),
  per as (
    select b.orang_id, min(b.nama) as nama,
           coalesce(bool_and(t.n >= 3 and t.rata > 0 and b.bpj > 1.5 * t.rata) filter (where b.ke <= 3), false) as berat,
           array_agg(round(b.bpj * 40, 1) order by b.ke desc) filter (where b.ke <= 3) as poin40,
           array_agg(round(t.rata * 40, 1) order by b.ke desc) filter (where b.ke <= 3) as rata40,
           round(avg(case when t.rata > 0 then b.bpj / t.rata end) filter (where b.ke <= 3), 1) as rasio,
           array_agg(t.n order by b.ke desc) filter (where b.ke <= 3) as tim_n,
           coalesce(sum(b.lintas_n) filter (where b.ke <= 3), 0)::integer as lintas_baru,
           coalesce(sum(b.lintas_poin) filter (where b.ke <= 3), 0) as lintas_baru_poin,
           coalesce(sum(b.lintas_poin) filter (where b.ke > 3), 0) as lintas_lama_poin
      from b join tim t on t.ke = b.ke group by b.orang_id
  ),
  sk as (
    select per.orang_id,
           coalesce((select sum(greatest(0, least(i.selesai, p_senin - 1) - greatest(i.mulai, p_senin - 28) + 1))
              from public.pengajuan_izin i where i.orang_id = per.orang_id and i.perusahaan_id = p_pid and i.jenis = 'sakit'
               and i.status = 'disetujui' and i.mulai < p_senin and i.selesai >= p_senin - 28), 0)::integer as hari,
           coalesce((select sum(greatest(0, least(i.selesai, p_senin - 29) - greatest(i.mulai, p_senin - 112) + 1))
              from public.pengajuan_izin i where i.orang_id = per.orang_id and i.perusahaan_id = p_pid and i.jenis = 'sakit'
               and i.status = 'disetujui' and i.mulai < p_senin - 28 and i.selesai >= p_senin - 112), 0) / 3.0 as rata,
           (select (o.dibuat_at at time zone coalesce(p.zona_waktu, 'Asia/Makassar'))::date <= p_senin - 112
              from public.orang o join public.perusahaan p on p.id = o.perusahaan_id where o.id = per.orang_id) as dihitung
      from per
  )
  select per.orang_id, per.nama, per.berat, per.poin40, per.rata40, per.rasio, per.tim_n,
         (per.lintas_baru >= 3 and per.lintas_baru_poin >= 2 * per.lintas_lama_poin) as lintas, per.lintas_baru, per.lintas_lama_poin, per.lintas_baru_poin,
         (sk.dihitung and sk.hari >= 3 and sk.hari >= 2 * sk.rata) as sakit, sk.hari, round(sk.rata, 1), sk.dihitung,
         -- berat sendirian cukup; tanpa berat butuh dua sinyal lain (lintas dan sakit).
         per.berat or ((per.lintas_baru >= 3 and per.lintas_baru_poin >= 2 * per.lintas_lama_poin)
                       and coalesce(sk.dihitung and sk.hari >= 3 and sk.hari >= 2 * sk.rata, false)) as nyala
    from per join sk on sk.orang_id = per.orang_id
$$;
revoke all on function app.sinyal_beban(uuid, date) from public, anon, authenticated;

create or replace function app.angka_id(p numeric) returns text language sql immutable set search_path = '' as $$
  select replace(trim(to_char(p, 'FM999999990.0')), '.', ',')
$$;

-- Kartu Feed untuk satu usaha, satu kartu per orang per minggu (kunci_klien deterministik). Orang yang kartunya sudah ditangani
-- dalam 3 minggu terakhir tidak dibuatkan kartu baru.
create or replace function app.buat_kartu_beban(p_pid uuid, p_senin date) returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; v_judul text; v_baris text[]; v_kunci uuid;
begin
  for r in select * from app.sinyal_beban(p_pid, p_senin) s where s.nyala loop
    if exists (select 1 from public.usulan u where u.perusahaan_id = p_pid and u.aksi = 'info.beban_tim' and u.status = 'diterima'
                  and u.payload ->> 'orang_id' = r.orang_id::text and u.diputuskan_at > (p_senin - 21)::timestamptz) then
      continue;
    end if;
    v_baris := '{}';
    if r.berat then
      v_judul := format('%s memikul %s kali beban rata-rata tim, 3 minggu berturut-turut.', r.nama, app.angka_id(r.rasio));
      v_baris := v_baris || format('%s poin per 40 jam; rata-rata tim %s poin.',
        array_to_string(array(select app.angka_id(x) from unnest(r.poin40) x), ', '), app.angka_id(r.rata40[3]));
    end if;
    if r.lintas then
      v_judul := coalesce(v_judul, format('%s mengerjakan %s kerja di luar topinya 3 minggu terakhir.', r.nama, r.lintas_baru));
      v_baris := v_baris || format('%s kerja di luar topinya 3 minggu terakhir. Bila memang tugasnya sekarang, pasang topinya di Peta organisasi.', r.lintas_baru);
    end if;
    if r.sakit then
      v_judul := coalesce(v_judul, format('%s mengambil %s hari sakit dalam 4 minggu, lebih sering dari biasanya.', r.nama, r.sakit_hari));
      v_baris := v_baris || format('%s hari sakit dalam 4 minggu (rata-rata %s). Mungkin perlu ditanya kabarnya.', r.sakit_hari, app.angka_id(r.sakit_rata));
    end if;
    if not r.sakit_dihitung then v_baris := v_baris || 'Kabar izin sakit muncul setelah 12 minggu data.'::text; end if;
    v_kunci := md5('beban_tim:' || r.orang_id::text || ':' || p_senin::text)::uuid;
    insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
    values (p_pid, 'sinyal', 'info.beban_tim', v_judul, array_to_string(v_baris, E'\n'),
            jsonb_build_object('orang_id', r.orang_id, 'minggu', p_senin, 'sinyal',
              array_remove(array[case when r.berat then 'berat' end, case when r.lintas then 'lintas' end, case when r.sakit then 'sakit' end], null),
              'angka', jsonb_build_object('poin40', r.poin40, 'rata40', r.rata40, 'rasio', r.rasio, 'lintas', r.lintas_baru,
                'sakit_hari', case when r.sakit then r.sakit_hari end)),
            '{pemilik}', v_kunci)
    on conflict (perusahaan_id, kunci_klien) where kunci_klien is not null do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke all on function app.buat_kartu_beban(uuid, date) from public, anon, authenticated;

-- Cron Senin: semua usaha non-demo, minggu penuh sebelum Senin ini di zona masing-masing.
create or replace function app.kartu_beban_mingguan() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select p.id from public.perusahaan p where coalesce(p.pengaturan ->> 'demo', '') = '' loop
    n := n + app.buat_kartu_beban(r.id, date_trunc('week', app.hari_ini(r.id))::date);
  end loop;
  return n;
end $$;
revoke all on function app.kartu_beban_mingguan() from public, anon, authenticated;
select cron.schedule('nadi-kartu-beban', '30 17 * * 0', 'select app.kartu_beban_mingguan()');

-- Sinyal minggu ini untuk layar pemilik (bukan admin, bukan staf; anggota yang dicabut ditolak lewat peran_aktif).
create or replace function public.sinyal_beban_tim(p_senin date default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang melihat beban dan kabar tim' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(s) - 'sakit_rata' order by s.nama)
    from app.sinyal_beban(v_pid, coalesce(p_senin, date_trunc('week', app.hari_ini(v_pid))::date)) s where s.nyala), '[]'::jsonb);
end $$;
revoke all on function public.sinyal_beban_tim(date) from public, anon;
grant execute on function public.sinyal_beban_tim(date) to authenticated;

-- "Sudah ditangani": pemilik menutup kartu info; tercatat siapa dan kapan.
create or replace function public.tandai_ditangani(p_usulan uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang menutup kartu ini' using errcode = '42501';
  end if;
  update public.usulan set status = 'diterima', diputuskan_oleh = (select auth.uid()), diputuskan_at = now()
   where id = p_usulan and perusahaan_id = v_pid and aksi like 'info.%' and status = 'menunggu';
  if not found then raise exception 'Kartu tidak ditemukan atau sudah ditutup' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.tandai_ditangani(uuid) from public, anon;
grant execute on function public.tandai_ditangani(uuid) to authenticated;
