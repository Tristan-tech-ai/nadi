-- M-25 lanjutan: tenggat PPN hanya untuk usaha yang mengisi identitas pajak sebagai PKP (M-09), agar usaha kecil yang bukan
-- pengusaha kena pajak tidak menerima kartu PPN yang tidak berlaku baginya. Fungsi lain di 20261105071000 tidak berubah.
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
     where exists (select 1 from public.identitas_pajak ip where ip.perusahaan_id = p_pid and ip.pkp)
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
revoke all on function app.tenggat_kepatuhan(uuid, date, date) from public, anon, authenticated;
