-- Tes T-02 (supabase/migrations/20261105101000_ekstraktor_bayangan.sql): aturan lama tetap, aturan baru mulai bayangan,
-- database menolak status aktif sebelum 2 kali cocok dengan model, kolom aktif mengikuti status. Lulus bila "gagal=[]".
-- Angka aturan lama (19 aktif, 2 mati) adalah keadaan produksi 6 Nov 2026 saat migrasi.
create temp table _t (nama text, ok boolean, info text);
do $$
declare v uuid; n_aktif int; n_mati int;
begin
  select count(*) filter (where status = 'aktif'), count(*) filter (where status = 'mati') into n_aktif, n_mati from public.ekstraktor where versi = 0;
  -- angka 19/2 adalah aturan bawaan produksi saat migrasi; database baru (Supabase lokal) tidak punya aturan versi 0
  insert into _t values ('aturan lama tetap (produksi 19 aktif, 2 mati; database baru 0)', (n_aktif = 19 and n_mati = 2) or (n_aktif + n_mati = 0 and not exists (select 1 from public.ekstraktor where versi = 0)), n_aktif || '/' || n_mati);
  insert into public.ekstraktor (perusahaan_id, sidik_tata_letak, jenis_berkas, aturan) values (null, 'uji-t02-' || gen_random_uuid(), 'nota', '{"bentuk":"teks","jenis":"nota","jangkar":["A","B"],"bidang":{}}') returning id into v;
  insert into _t values ('aturan baru mulai bayangan dan tidak aktif', (select status = 'bayangan' and not aktif and versi = 1 from public.ekstraktor where id = v), null);
  begin
    update public.ekstraktor set status = 'aktif' where id = v;
    insert into _t values ('aktif tanpa masa bayangan ditolak database', false, null);
  exception when check_violation then insert into _t values ('aktif tanpa masa bayangan ditolak database', true, null); end;
  update public.ekstraktor set bayangan_cocok = 2, status = 'aktif' where id = v;
  insert into _t values ('aktif setelah 2 kali cocok, kolom aktif ikut', (select aktif from public.ekstraktor where id = v), null);
  update public.ekstraktor set status = 'mati', alasan_mati = 'beda dengan model' where id = v;
  insert into _t values ('mati mematikan kolom aktif', (select not aktif from public.ekstraktor where id = v), null);
end $$;
do $$ declare total int; gagal text; begin
  select count(*), coalesce(string_agg(nama || coalesce(' (' || info || ')', ''), '; ') filter (where not ok), '') into total, gagal from _t;
  raise exception 'HASIL_TES % | gagal=[%]', total, gagal; end $$;
