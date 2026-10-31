-- Q-23 (docs/quality/klaim-di-fungsi.md, docs/quality/klaim-kebijakan-sisa.md): sisa pemakaian klaim prn di JWT setelah Q-21.
-- JWT yang sudah terbit tetap membawa prn lama sampai kedaluwarsa walau anggota sudah diturunkan atau dicabut.
-- 1. Fungsi: definisi hidup gerbang_gaji dan lempar_berkas diambil dengan pg_get_functiondef, lalu HANYA ekspresi peran diganti
--    lewat replace teks persis dengan jumlah kemunculan yang diperiksa (gagal bila beda). create or replace mempertahankan tanda
--    tangan, security definer, search_path, pemilik, dan hak execute.
-- 2. Kebijakan: cabang pengelola di slip_gaji_baca, lembur_baca, pengajuan_izin_baca, berkas_ubah, berkas_hapus memakai
--    app.peran_aktif() (tabel anggota yang aktif), seperti Q-21. app.peran_aktif() dan app.orang_saya() sama-sama membaca anggota
--    dengan syarat aktif, jadi anggota yang dicabut mendapat null di kedua cabang. with check berkas_ubah tidak diubah.
-- app.prn() dan app.pengelola() tidak dipakai lagi oleh fungsi atau kebijakan mana pun, tetapi sengaja tidak di-drop.

create function pg_temp.ganti_teks(p_fungsi regprocedure, variadic p_pasangan text[]) returns void
language plpgsql as $$
declare d text := pg_get_functiondef(p_fungsi); lama text; baru text; n int; ada int;
begin
  for i in 1 .. array_length(p_pasangan, 1) / 3 loop
    lama := p_pasangan[3 * i - 2]; baru := p_pasangan[3 * i - 1]; n := p_pasangan[3 * i]::int;
    ada := (length(d) - length(replace(d, lama, ''))) / length(lama);
    if ada <> n then
      raise exception 'Q-23: % memuat pola % kali, bukan %: %', p_fungsi, ada, n, lama;
    end if;
    d := replace(d, lama, baru);
  end loop;
  execute d;
end $$;

select pg_temp.ganti_teks('public.gerbang_gaji(date)',
  $a$app.prn() = 'pemilik'$a$, $a$app.peran_aktif() = 'pemilik'$a$, '1');

select pg_temp.ganti_teks('public.lempar_berkas(text,text,text,bigint)',
  $a$app.pengelola()$a$, $a$app.peran_aktif() in ('pemilik', 'admin')$a$, '1');

drop function pg_temp.ganti_teks(regprocedure, text[]);

alter policy slip_gaji_baca on public.slip_gaji
  using (perusahaan_id = (select app.pid())
         and ((select app.peran_aktif()) in ('pemilik', 'admin')
              or (orang_id = (select app.orang_saya()) and not ditahan
                  and exists (select 1 from public.periode_gaji p where p.id = slip_gaji.periode_id and p.status = 'disetujui'))));

alter policy lembur_baca on public.lembur
  using (perusahaan_id = (select app.pid())
         and ((select app.peran_aktif()) in ('pemilik', 'admin') or orang_id = (select app.orang_saya())));

alter policy pengajuan_izin_baca on public.pengajuan_izin
  using (perusahaan_id = (select app.pid())
         and ((select app.peran_aktif()) in ('pemilik', 'admin') or orang_id = (select app.orang_saya())));

alter policy berkas_ubah on public.berkas
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));

alter policy berkas_hapus on public.berkas
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin'));
