-- L-03 lanjutan: perusahaan_baca memeriksa tabel anggota langsung (bukan app.pid), sehingga sesi coba tidak melihat nama
-- usaha contoh (temuan e2e/mode-coba: kepala menampilkan "Perusahaan"). Sesi anonim hanya melihat baris usaha contoh itu.
create policy perusahaan_tamu on public.perusahaan for select to authenticated
  using ((select app.tamu()) and id = (select app.usaha_tamu()));
