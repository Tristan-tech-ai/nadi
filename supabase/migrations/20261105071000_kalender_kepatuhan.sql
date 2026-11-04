-- M-25 (docs/research/kalender-kepatuhan.md): satu daftar tenggat dari aturan bertanggal dan data usaha.
-- Pajak: PMK 81/2024 (setor PPh tgl 15, lapor PPh tgl 20, setor/lapor PPN akhir bulan berikutnya; libur digeser, sama dengan
-- kalender_pajak M-09B). BPJS Ketenagakerjaan: PP 44/2015 Pasal 21 ayat (2) dan (3) (JKK, JKM paling lambat tgl 15 bulan
-- berikutnya). BPJS Kesehatan: Perpres 82/2018 Pasal 39 ayat (1) dan (4) (paling lambat tgl 10 setiap bulan). Libur digeser ke hari
-- kerja berikutnya lewat app.hari_kerja_pajak (Sabtu, Minggu, libur_nasional). THR: Permenaker 6/2016 Pasal 5 ayat (4), H-7 Idul
-- Fitri dari libur_nasional. Kontrak PKWT dan SP berakhir dari M-11. Izin usaha (NIB, PIRT, halal, lainnya) diisi pemilik.
-- Pengingat: cron harian membuat kartu info.kepatuhan di Feed pemilik untuk tenggat 7 hari ke depan (izin usaha: sesuai
-- pengingat_hari); push mengikuti cron nadi-push-usulan yang sudah ada. Tes: supabase/tests/kalender_kepatuhan.test.sql.

create table public.izin_usaha (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  jenis text not null check (jenis in ('nib', 'pirt', 'halal', 'bpom', 'lainnya')),
  nama text not null check (length(btrim(nama)) between 2 and 80),
  nomor text check (nomor is null or length(nomor) <= 60),
  berlaku_sampai date,
  pengingat_hari int not null default 60 check (pengingat_hari between 7 and 365),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now()
);
create index on public.izin_usaha (perusahaan_id);
alter table public.izin_usaha enable row level security;
create policy izin_usaha_baca on public.izin_usaha for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.izin_usaha to authenticated;

create or replace function public.simpan_izin_usaha(p_id uuid, p_jenis text, p_nama text, p_nomor text, p_berlaku_sampai date, p_pengingat int, p_aktif boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengelola(); v_id uuid;
begin
  if p_id is null then
    insert into public.izin_usaha (perusahaan_id, jenis, nama, nomor, berlaku_sampai, pengingat_hari)
    values (v_pid, p_jenis, btrim(p_nama), nullif(btrim(coalesce(p_nomor, '')), ''), p_berlaku_sampai, coalesce(p_pengingat, 60)) returning id into v_id;
  else
    update public.izin_usaha set jenis = p_jenis, nama = btrim(p_nama), nomor = nullif(btrim(coalesce(p_nomor, '')), ''), berlaku_sampai = p_berlaku_sampai,
           pengingat_hari = coalesce(p_pengingat, 60), aktif = coalesce(p_aktif, true)
     where id = p_id and perusahaan_id = v_pid returning id into v_id;
    if v_id is null then raise exception 'Izin usaha tidak ditemukan' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end $$;

-- Inti tanpa pemeriksaan peran (dipakai fungsi publik dan cron). Satu baris per tenggat.
create or replace function app.tenggat_kepatuhan(p_pid uuid, p_dari date, p_sampai date)
returns table (tanggal date, jenis text, judul text, dasar text, ref text)
language sql stable security definer set search_path = '' as $$
  with bulan as (
    select (generate_series(date_trunc('month', p_dari - 62), date_trunc('month', p_sampai), interval '1 month'))::date as m
  ),
  ada_karyawan as (select exists (select 1 from public.orang o where o.perusahaan_id = p_pid and o.status = 'aktif' and 'karyawan' = any(o.jenis)) as ya),
  semua as (
    select app.hari_kerja_pajak((b.m + interval '1 month')::date + 14) as tanggal, 'pajak' as jenis,
           'Setor PPh masa ' || to_char(b.m, 'MM-YYYY') as judul, 'PMK 81/2024 Pasal 94 ayat (2)' as dasar, 'setor_pph:' || b.m as ref from bulan b
    union all
    select app.hari_kerja_pajak((b.m + interval '1 month')::date + 19), 'pajak', 'Lapor SPT Masa PPh ' || to_char(b.m, 'MM-YYYY'), 'PMK 81/2024 Pasal 171 ayat (1)', 'lapor_pph:' || b.m from bulan b
    union all
    select app.hari_kerja_pajak((b.m + interval '2 month' - interval '1 day')::date), 'pajak', 'Setor dan lapor PPN masa ' || to_char(b.m, 'MM-YYYY'),
           'PMK 81/2024 Pasal 94 ayat (3) huruf e dan Pasal 171 ayat (13)', 'ppn:' || b.m from bulan b
    union all
    select app.hari_kerja_pajak((b.m + interval '1 month')::date + 14), 'bpjs', 'Setor iuran BPJS Ketenagakerjaan bulan ' || to_char(b.m, 'MM-YYYY'),
           'PP 44/2015 Pasal 21 ayat (2) dan (3)', 'bpjs_tk:' || b.m from bulan b, ada_karyawan a where a.ya
    union all
    select app.hari_kerja_pajak(b.m + 9), 'bpjs', 'Setor iuran BPJS Kesehatan bulan ' || to_char(b.m, 'MM-YYYY'),
           'Perpres 82/2018 Pasal 39 ayat (1) dan (4)', 'bpjs_kes:' || b.m from bulan b, ada_karyawan a where a.ya
    union all
    select min(l.tanggal) - 7, 'thr', 'Bayar THR paling lambat (Idulfitri ' || extract(year from min(l.tanggal)) || ')', 'Permenaker 6/2016 Pasal 5 ayat (4)',
           'thr:' || extract(year from min(l.tanggal))
      from public.libur_nasional l, ada_karyawan a where a.ya and l.nama ilike '%idul%fitri%' and l.jenis = 'libur'
     group by extract(year from l.tanggal)
    union all
    select pk.kontrak_sampai, 'kontrak', 'Kontrak PKWT ' || o.nama || ' berakhir', 'Perjanjian kerja waktu tertentu', 'kontrak:' || pk.orang_id || ':' || pk.kontrak_sampai
      from public.profil_kerja pk join public.orang o on o.id = pk.orang_id
     where pk.perusahaan_id = p_pid and pk.status_kerja = 'pkwt' and pk.kontrak_sampai is not null and o.status = 'aktif'
    union all
    select s.berlaku_sampai, 'sp', 'Masa ' || case when s.terakhir then 'SP pertama dan terakhir' else 'SP' || s.tingkat end || ' ' || o.nama || ' berakhir',
           'PP 35/2021 Penjelasan Pasal 52 ayat (1)', 'sp:' || s.id
      from public.surat_peringatan s join public.orang o on o.id = s.orang_id where s.perusahaan_id = p_pid
    union all
    select i.berlaku_sampai, 'izin', i.nama || coalesce(' (' || i.nomor || ')', '') || ' berlaku sampai tanggal ini', 'Izin usaha yang dicatat pemilik', 'izin:' || i.id
      from public.izin_usaha i where i.perusahaan_id = p_pid and i.aktif and i.berlaku_sampai is not null
  )
  select * from semua where tanggal between p_dari and p_sampai order by tanggal, jenis, judul
$$;

create or replace function public.kalender_kepatuhan(p_dari date, p_sampai date)
returns table (tanggal date, jenis text, judul text, dasar text, ref text)
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.pid();
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') not in ('pemilik', 'admin', 'akuntan') then
    raise exception 'Hanya pemilik, admin, atau akuntan yang melihat kalender kepatuhan' using errcode = '42501';
  end if;
  if p_dari is null or p_sampai is null or p_sampai < p_dari or p_sampai > p_dari + 400 then raise exception 'Rentang paling lama 400 hari' using errcode = '22023'; end if;
  return query select * from app.tenggat_kepatuhan(v_pid, p_dari, p_sampai);
end $$;

-- Cron harian: kartu info.kepatuhan untuk pemilik, sekali per tenggat (kunci dari ref). Izin usaha diingatkan sejak pengingat_hari.
create or replace function app.pengingat_kepatuhan(p_hari date default null) returns int
language plpgsql security definer set search_path = '' as $$
declare p record; t record; n int := 0; v_hari date;
begin
  for p in select pr.id from public.perusahaan pr where coalesce(pr.pengaturan ->> 'demo', 'false') <> 'true' loop
    v_hari := coalesce(p_hari, app.hari_ini(p.id));
    for t in
      select * from app.tenggat_kepatuhan(p.id, v_hari, v_hari + 7) where jenis <> 'izin'
      union all
      select k.* from app.tenggat_kepatuhan(p.id, v_hari, v_hari + 365) k join public.izin_usaha i on k.ref = 'izin:' || i.id
       where k.jenis = 'izin' and k.tanggal <= v_hari + i.pengingat_hari
    loop
      insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, untuk_peran, kunci_klien)
      values (p.id, 'nadi', 'info.kepatuhan', left(t.judul || ', ' || to_char(t.tanggal, 'DD-MM-YYYY'), 140),
        'Tenggat ' || to_char(t.tanggal, 'DD-MM-YYYY') || '. Dasar: ' || t.dasar || '.',
        jsonb_build_object('jenis', t.jenis, 'tanggal', t.tanggal, 'ref', t.ref), array['pemilik'], md5('kepatuhan:' || p.id || ':' || t.ref)::uuid)
      on conflict (perusahaan_id, kunci_klien) where kunci_klien is not null do nothing;
      if found then n := n + 1; end if;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function app.tenggat_kepatuhan(uuid, date, date), app.pengingat_kepatuhan(date) from public, anon, authenticated;
revoke all on function public.simpan_izin_usaha(uuid, text, text, text, date, int, boolean), public.kalender_kepatuhan(date, date) from public, anon;
grant execute on function public.simpan_izin_usaha(uuid, text, text, text, date, int, boolean), public.kalender_kepatuhan(date, date) to authenticated;
select cron.schedule('nadi-pengingat-kepatuhan', '0 23 * * *', 'select app.pengingat_kepatuhan()');
