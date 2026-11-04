-- M-10B (docs/research/gaji-lanjutan.md): cicilan kasbon lewat slip, THR harian lepas, rekening karyawan untuk berkas transfer.
-- Cicilan kasbon: komponen slip kode 'kasbon' (jenis potongan) disusun aplikasi; database menolak cicilan di atas sisa kasbon
-- dan tetap menegakkan batas 50% PP 36/2021 Pasal 65. Saat periode gaji disetujui, cicilan mengurangi sisa kasbon (tertua dulu)
-- dan dijurnal D 6-100 Gaji / K 1-150 Piutang karyawan (bagian upah yang dibayar dengan menutup piutang).
-- THR harian lepas: Permenaker 6/2016 Pasal 3 ayat (3): masa kerja >= 12 bulan = rata-rata upah 12 bulan terakhir sebelum Hari
-- Raya; < 12 bulan = rata-rata upah tiap bulan selama masa kerja. Upah = komponen pokok + tunjangan tetap slip yang disetujui.
-- Rekening: bank, nomor, atas nama di orang_rahasia (RLS pemilik/admin); hash dan 4 angka akhir diisi trigger agar Gerbang Gaji
-- (rekening sama dipakai dua orang) mulai bekerja. Tes: supabase/tests/gaji_lanjutan_b.test.sql.

alter table public.orang_rahasia
  add column bank text check (bank is null or length(btrim(bank)) between 2 and 40),
  add column rekening text check (rekening is null or rekening ~ '^[0-9]{6,20}$'),
  add column atas_nama text check (atas_nama is null or length(btrim(atas_nama)) between 2 and 40);

create or replace function app.isi_rekening_hash() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.rekening is null then
    new.rekening_hash := null; new.rekening_akhir := null;
  else
    new.rekening_hash := encode(extensions.digest(new.perusahaan_id::text || ':' || new.rekening, 'sha256'), 'hex');
    new.rekening_akhir := right(new.rekening, 4);
  end if;
  return new;
end $$;
create trigger isi_rekening_hash before insert or update of rekening on public.orang_rahasia
  for each row execute function app.isi_rekening_hash();
revoke all on function app.isi_rekening_hash() from public, anon, authenticated;

create table public.kasbon_bayar (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  kasbon_id uuid not null references public.kasbon(id) on delete cascade,
  slip_id uuid not null references public.slip_gaji(id) on delete cascade,
  periode_id uuid not null references public.periode_gaji(id) on delete cascade,
  nilai bigint not null check (nilai > 0),
  dibuat_at timestamptz not null default now(),
  unique (kasbon_id, slip_id)
);
create index on public.kasbon_bayar (perusahaan_id, periode_id);
create index on public.kasbon_bayar (slip_id);
alter table public.kasbon_bayar enable row level security;
create policy kasbon_bayar_baca on public.kasbon_bayar for select to authenticated
  using (perusahaan_id = (select app.pid()) and ((select app.peran_aktif()) in ('pemilik', 'admin')
    or kasbon_id in (select k.id from public.kasbon k where k.orang_id = (select app.orang_saya()))));
grant select on public.kasbon_bayar to authenticated;

-- Batas potongan Pasal 65 + cicilan kasbon tidak melebihi sisa kasbon orang itu.
create or replace function app.jaga_potongan_upah() returns trigger
language plpgsql set search_path = '' as $$
declare v_pendapatan numeric; v_pasal63 numeric; v_kasbon numeric; v_sisa numeric;
begin
  select coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'pendapatan'), 0),
         coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'potongan' and k ->> 'kode' in ('kasbon', 'denda', 'ganti_rugi', 'sewa', 'utang', 'kelebihan_bayar')), 0),
         coalesce(sum((k ->> 'nilai')::numeric) filter (where k ->> 'jenis' = 'potongan' and k ->> 'kode' = 'kasbon'), 0)
    into v_pendapatan, v_pasal63, v_kasbon from jsonb_array_elements(new.komponen) k;
  if v_pasal63 > v_pendapatan * 0.5 then
    raise exception 'Potongan kasbon, denda, ganti rugi, sewa, utang, dan kelebihan bayar Rp% melebihi 50%% upah Rp% (PP 36/2021 Pasal 65). Kurangi cicilannya.',
      v_pasal63, v_pendapatan using errcode = '22023';
  end if;
  if v_kasbon > 0 then
    select coalesce(sum(sisa), 0) into v_sisa from public.kasbon where perusahaan_id = new.perusahaan_id and orang_id = new.orang_id;
    if v_kasbon > v_sisa then
      raise exception 'Cicilan kasbon Rp% melebihi sisa kasbon Rp%', v_kasbon, v_sisa using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

-- Periode disetujui: cicilan kasbon di setiap slip mengurangi sisa kasbon (tertua dulu), lalu satu jurnal per periode.
create or replace function app.kasbon_dari_gaji() returns trigger
language plpgsql security definer set search_path = '' as $$
declare s record; k record; v_sisa bigint; v_ambil bigint; v_total bigint := 0;
begin
  for s in
    select sg.id, sg.orang_id, sum((c ->> 'nilai')::bigint) as cicilan
      from public.slip_gaji sg cross join lateral jsonb_array_elements(sg.komponen) c
     where sg.periode_id = new.id and c ->> 'jenis' = 'potongan' and c ->> 'kode' = 'kasbon'
     group by sg.id, sg.orang_id having sum((c ->> 'nilai')::bigint) > 0
  loop
    v_sisa := s.cicilan;
    for k in select id, sisa from public.kasbon where perusahaan_id = new.perusahaan_id and orang_id = s.orang_id and sisa > 0
              order by tanggal, dibuat_at for update loop
      exit when v_sisa <= 0;
      v_ambil := least(k.sisa, v_sisa);
      insert into public.kasbon_bayar (perusahaan_id, kasbon_id, slip_id, periode_id, nilai)
      values (new.perusahaan_id, k.id, s.id, new.id, v_ambil) on conflict (kasbon_id, slip_id) do nothing;
      if found then
        update public.kasbon set sisa = sisa - v_ambil where id = k.id;
        v_total := v_total + v_ambil;
      end if;
      v_sisa := v_sisa - v_ambil;
    end loop;
  end loop;
  if v_total > 0 then
    perform app.pasang_bagan_bawaan(new.perusahaan_id);
    perform app.akun_pastikan(new.perusahaan_id, '1-150', 'Piutang karyawan (kasbon)', 'aset', 'debit');
    perform app.posting_jurnal(new.perusahaan_id, jsonb_build_object('tanggal', app.hari_ini(new.perusahaan_id),
      'keterangan', 'Cicilan kasbon lewat gaji ' || to_char(new.bulan, 'MM-YYYY'),
      'sumber', 'gaji', 'sumber_id', new.id::text, 'kunci_idempoten', 'kasbon_gaji:' || new.id),
      jsonb_build_array(jsonb_build_object('akun', '6-100', 'debit', v_total), jsonb_build_object('akun', '1-150', 'kredit', v_total)), auth.uid());
  end if;
  return new;
end $$;
create trigger kasbon_dari_gaji after update of status on public.periode_gaji
  for each row when (old.status = 'draf' and new.status = 'disetujui') execute function app.kasbon_dari_gaji();
revoke all on function app.kasbon_dari_gaji() from public, anon, authenticated;

-- THR: tambah harian lepas (orang_rahasia.gaji.harian_lepas = true) dengan upah rata-rata dari slip yang disetujui.
create or replace function public.hitung_thr(p_hari_raya date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang menghitung THR' using errcode = '42501';
  end if;
  if p_hari_raya is null then raise exception 'Isi tanggal Hari Raya' using errcode = '22023'; end if;
  return jsonb_build_object('hari_raya', p_hari_raya, 'batas_bayar', p_hari_raya - 7,
    'dasar', 'Permenaker 6/2016 Pasal 3 ayat (1), ayat (2) huruf b, dan ayat (3) untuk harian lepas; dibayar paling lambat 7 hari sebelum Hari Raya (Pasal 5 ayat (4))',
    'orang', coalesce((select jsonb_agg(x order by x ->> 'nama') from (
      select jsonb_build_object('id', o.id, 'nama', o.nama, 'mulai', m.mulai, 'masa_bulan', m.masa, 'harian_lepas', h.lepas,
        'upah', u.upah, 'bulan_rata', case when h.lepas then sl.bulan end,
        'thr', case when m.mulai is null or u.upah is null then null
                    when m.masa < 1 then 0
                    when m.masa >= 12 then round(u.upah)
                    else round(m.masa * u.upah / 12.0) end,
        'catatan', case when m.mulai is null then 'tanggal mulai kerja belum diisi'
                        when u.upah is null and h.lepas then 'belum ada slip gaji disetujui untuk rata-rata upah'
                        when u.upah is null then 'gaji pokok belum diisi'
                        when m.masa < 1 then 'masa kerja kurang dari 1 bulan' end) as x
        from public.orang o
        left join public.orang_rahasia r on r.orang_id = o.id
        cross join lateral (select app.tanggal_teks(o.data ->> 'mulai') as mulai) m0
        cross join lateral (select m0.mulai, app.masa_kerja_bulan(m0.mulai, p_hari_raya) as masa) m
        cross join lateral (select coalesce(r.gaji ->> 'harian_lepas', '') = 'true' as lepas) h
        cross join lateral (
          select count(*)::int as bulan, coalesce(sum(up.nilai), 0) as jumlah
            from public.slip_gaji sg join public.periode_gaji pg on pg.id = sg.periode_id
            cross join lateral (select coalesce(sum((c ->> 'nilai')::numeric), 0) as nilai from jsonb_array_elements(sg.komponen) c
                                 where c ->> 'jenis' = 'pendapatan' and c ->> 'kode' in ('pokok', 'tunjangan_tetap')) up
           where h.lepas and sg.orang_id = o.id and pg.perusahaan_id = v_pid and pg.status = 'disetujui'
             and pg.bulan >= (date_trunc('month', p_hari_raya) - interval '12 months')::date
             and pg.bulan < date_trunc('month', p_hari_raya)::date
             and (m.mulai is null or pg.bulan >= date_trunc('month', m.mulai)::date)) sl
        cross join lateral (select case
          when h.lepas then case when sl.bulan = 0 then null when m.masa >= 12 then sl.jumlah / 12.0 else sl.jumlah / sl.bulan end
          when jsonb_typeof(r.gaji -> 'pokok') = 'number'
          then (r.gaji -> 'pokok')::numeric + coalesce(case when jsonb_typeof(r.gaji -> 'tunjangan_tetap') = 'number' then (r.gaji -> 'tunjangan_tetap')::numeric end, 0) end as upah) u
       where o.perusahaan_id = v_pid and o.status = 'aktif' and 'karyawan' = any(o.jenis)) y), '[]'::jsonb));
end $$;
revoke all on function public.hitung_thr(date) from public, anon;
grant execute on function public.hitung_thr(date) to authenticated;
