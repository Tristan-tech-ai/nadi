-- Q-01 temuan S4: baris berkas hanya dibuat dan diubah lewat fungsi server (lempar_berkas, lamar_daftar, simpan_ocr, baca-berkas).
-- Tanpa ini pengguna bisa mendaftarkan jalur, teks OCR, atau status sendiri lalu meminta baca-berkas memprosesnya.
revoke insert, update, delete on public.berkas from authenticated;
