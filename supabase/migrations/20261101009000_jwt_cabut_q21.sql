-- Q-21 (docs/quality/jwt-setelah-cabut.md): JWT yang sudah terbit tetap membawa pid/prn sampai kedaluwarsa, walau anggota
-- sudah dicabut (aktif = false) atau diturunkan perannya; trigger app.sinkron_klaim_anggota hanya membersihkan token berikutnya.
-- Kebijakan baca yang hanya memakai klaim kini juga memeriksa tabel anggota: app.anggota_aktif() untuk keanggotaan,
-- app.peran_aktif() (baru) untuk peran. Penulisan ke berkas tidak diubah: authenticated tidak punya hak tulis di public.berkas dan
-- lempar_berkas sudah memeriksa anggota_aktif. mcp_token_cabut (mencabut token milik sendiri) sengaja dibiarkan.

create or replace function app.peran_aktif() returns text
language sql stable security definer set search_path = '' as $$
  select a.peran from public.anggota a
   where a.perusahaan_id = app.pid() and a.user_id = (select auth.uid()) and a.aktif
$$;
revoke all on function app.peran_aktif() from public, anon;
grant execute on function app.peran_aktif() to authenticated;

alter policy anggota_baca on public.anggota
  using (user_id = (select auth.uid()) or (perusahaan_id = (select app.pid()) and (select app.anggota_aktif())));

alter policy aset_baca on public.aset using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
alter policy kebijakan_izin_baca on public.kebijakan_izin using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
alter policy pakai_topi_baca on public.pakai_topi using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
alter policy pengetahuan_baca on public.pengetahuan using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
alter policy periode_gaji_baca on public.periode_gaji using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
alter policy ringkasan_harian_baca on public.ringkasan_harian using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
alter policy tempat_baca on public.tempat using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
alter policy topi_baca on public.topi using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));

alter policy ekstraktor_baca on public.ekstraktor
  using (perusahaan_id is null or (perusahaan_id = (select app.pid()) and (select app.anggota_aktif())));

alter policy langganan_push_milik on public.langganan_push
  using (user_id = (select auth.uid()) and perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));
alter policy mcp_token_milik on public.mcp_token
  using (user_id = (select auth.uid()) and perusahaan_id = (select app.pid()) and (select app.anggota_aktif()));

alter policy audit_baca on public.audit_log
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) = 'pemilik');
alter policy keputusan_baca on public.keputusan
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
alter policy pemakaian_ai_baca on public.pemakaian_ai
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
alter policy usulan_baca on public.usulan
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) = any (untuk_peran));
alter policy berkas_baca on public.berkas
  using (perusahaan_id = (select app.pid()) and (select app.anggota_aktif())
         and ((select app.peran_aktif()) in ('pemilik', 'admin') or diunggah_oleh = (select auth.uid())));

alter policy berkas_unduh on storage.objects
  using (bucket_id = 'berkas' and (storage.foldername(name))[1] = ((select app.pid()))::text and (select app.anggota_aktif())
         and ((select app.peran_aktif()) in ('pemilik', 'admin') or owner_id = ((select auth.uid()))::text));
