# Agen edge Mata (F5-04)

## Bukti (4 Nov 2026)
- Migrasi `20261104052000_agen_mata.sql`, md5 tanpa spasi `a89bf9fb`, sama dengan berkas repo.
- Tes SQL `supabase/tests/agen_mata.test.sql` 15/15. Merah dulu karena tabel belum ada. Yang diuji:
  - token `nma_` hanya disimpan hash-nya;
  - staf tidak bisa membuat token;
  - anon hanya membaca zona usaha pemilik token;
  - keadaan sama tidak dicatat ulang;
  - token usaha lain, token salah, dan token yang sudah dicabut ditolak.
- Tes Rust `cargo test --lib` 5/5: masker poligon, fraksi, gumpalan, histeresis, butir RPC. Catatan jujur: tes ini ditulis bersama kodenya dan tidak dijalankan merah lebih dulu.
- **Evaluasi korpus** `nadi-mata-agen evaluasi` (60 cuplikan, 3 meja, termasuk orang lewat): 167/177 = 94,4%, baik biner Windows (mingw) maupun Linux. Pembanding: pendeteksi peramban F5-01 91,7%.
- **Uji ujung Windows:** mediamtx v1.21.3 dan ffmpeg memutar video korpus lewat RTSP. Biner Windows menulis 8 kejadian `mata_agen` (4 terisi) ke Warung Uji A produksi dalam 75 detik, lalu token dicabut.
- **Uji ujung Linux (WSL):** biner Linux membaca RTSP dari mediamtx di WSL. Ia mencatat 3 kejadian keadaan awal, yang dibuktikan `agen_mata.terakhir_at` 16 detik setelah token dibuat. Ringkasan skrip tidak tercetak karena `process.exit` memotong keluaran, dan dua token uji tidak tercabut otomatis sehingga dicabut manual. Skrip sudah diperbaiki (`process.exitCode`).
- **Biner:** Linux 2,0 MB, Windows 1,9 MB (tanpa strip/LTO).

## Batas
- **Cara menilai:** beda terhadap latar kosong, bukan pendeteksi orang. Peka terhadap perubahan cahaya dan kamera yang bergeser, dan butuh kalibrasi ulang.
- **Antrean:** jumlahnya dari gumpalan, belum diuji pada korpus karena korpus hanya berisi zona meja.
- **Distribusi:** tidak ada layar untuk membuat token di aplikasi. Saat ini token dibuat lewat RPC `buat_token_agen_mata` (skrip uji); tombol di halaman Mata bisa menyusul.
