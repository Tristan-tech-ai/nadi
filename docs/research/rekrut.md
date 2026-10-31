# Rekrut: lowongan per topi dan lamar tanpa akun (F2-01)

Ditulis 31 Okt 2026 sebelum kode. Masalah P01: lowongan disebar lewat WhatsApp, CV masuk ke chat pribadi, tercecer, dan pemilik membaca satu per satu. Nadi menerima lamaran di halaman publik dan mengubah CV menjadi profil kandidat lewat pembaca berkas yang sudah ada.

## Kriteria terima (dari antrean, diperjelas)
1. Kandidat melamar dari HP dalam waktu kurang dari 2 menit: buka tautan, isi nama dan nomor HP, foto atau unggah CV, kirim. Diuji e2e dengan stopwatch di viewport 390 px.
2. CV terurai menjadi profil: usulan `rekrut.pelamar` berisi nama, posisi, pengalaman, keahlian muncul di Feed pemilik; setelah disetujui menjadi `orang` berjenis kandidat (alur `putuskan_usulan` yang sudah ada).

## Data
- `public.lowongan`: usaha, topi (posisi), judul, kode publik 8 huruf, ringkasan tugas, `buka` boolean, batas harian lamaran (bawaan 50), dibuat_at.
- `public.lamaran`: lowongan, nama, telepon (bentuk normal +62), berkas_id, status `masuk | diproses | usulan | gagal`, dibuat_at. Tidak ada akun pelamar.
- Berkas CV memakai tabel `berkas` dan bucket `berkas` yang sama (jalur `{usaha}/lamar/{sha256}.{ext}`), sumber `lamar`.

## Alur
1. Pemilik membuat lowongan dari topi yang ada (Orang atau halaman Lowongan), mendapat tautan `/lamar/<kode>` untuk disebar lewat WhatsApp.
2. Halaman publik `/lamar/<kode>` (tanpa akun, tanpa cookie sesi) menampilkan judul, nama usaha, ringkasan, dan formulir.
3. Browser memanggil RPC anon `lamar_daftar(kode, nama, telepon, sha256, mime, ukuran)`: lowongan harus buka, kuota harian belum habis, berkas sama di lowongan yang sama tidak dihitung dua kali, nomor HP yang sama paling banyak 3 kali per lowongan. Fungsi mendaftarkan `berkas` (status `unggah`) dan `lamaran`, lalu mengembalikan jalur.
4. Browser mengunggah ke Storage. Kebijakan INSERT untuk `anon` hanya mengizinkan jalur berkas `lamar` yang berstatus `unggah` dan dibuat kurang dari 10 menit lalu; ukuran 10 MB dan jenis berkas mengikuti bucket.
5. Browser memanggil `lamar_selesai(berkas_id)`. Database (pg_net, pola fungsi push) memanggil Edge Function `baca-berkas` dengan header `x-nadi-token` dari Vault, jalur internal baru yang memeriksa token lalu membaca berkas dengan kunci bawaan runtime. Hasil jenis `cv` menghasilkan usulan `rekrut.pelamar` bersumber `lamar`.
6. Pelamar melihat "Lamaran terkirim" beserta nama usaha. Tidak ada email atau pesan keluar dari Nadi.

## Keamanan dan privasi
- RPC anon hanya menulis ke lowongan yang buka; tidak ada pembacaan data usaha selain judul lowongan, nama usaha, dan ringkasan.
- Batas laju di database (kuota per lowongan per hari, per nomor HP); kode lowongan 8 huruf acak tanpa karakter mirip.
- Berkas CV dibaca pengelola saja (RLS `berkas` yang ada). Telepon tidak tampil di halaman publik.

## Tes yang direncanakan
SQL: lowongan tutup menolak; kuota harian dan batas per nomor HP; anon tidak bisa membaca lamaran atau berkas; isolasi usaha; `lamar_selesai` hanya untuk berkas lamar berstatus unggah. Edge Function: jalur token menolak token salah. e2e: melamar dari 390 px di bawah 2 menit dengan PDF CV korpus, usulan pelamar muncul di Feed, setujui menjadi kandidat.
