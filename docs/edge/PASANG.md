# Pasang agen Mata di kotak lokal (F5-04)

Agen ini membaca kamera CCTV lewat RTSP di jaringan toko. Ia menilai setiap zona yang digambar di Nadi (meja terisi atau kosong, jumlah orang antre), lalu mengirim **perubahan keadaan saja** ke Nadi.

Video tidak pernah dikirim ke Nadi. Yang terkirim hanya baris seperti "Meja tengah: terisi".

## Yang dibutuhkan
- Komputer kecil yang menyala terus di jaringan yang sama dengan kamera, dengan Windows 10/11 64-bit atau Linux x86-64.
- **ffmpeg** di PATH. Di Windows, unduh build resmi dari https://ffmpeg.org/download.html. Di Ubuntu: `sudo apt install ffmpeg`.
- **Alamat RTSP kamera.** Biasanya `rtsp://user:sandi@192.168.1.20:554/...` dari buku petunjuk kamera.
- **Zona sudah digambar** di Nadi, halaman Mata (pemilik atau admin).
- **Token agen** (berawalan `nma_`), dibuat pemilik atau admin. Token hanya bisa membaca zona dan mencatat keadaan zona usaha itu, dan bisa dicabut kapan saja. Ini bukan kunci rahasia server.

## Membangun biner
Biner dibangun di Linux/WSL dengan rustup (https://rustup.rs):
```
cd edge/mata-agen
cargo build --release                                   # Linux: target/release/nadi-mata-agen
rustup target add x86_64-pc-windows-gnu                  # Windows, dari Linux: butuh paket gcc-mingw-w64-x86-64
CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc cargo build --release --target x86_64-pc-windows-gnu
```
- Build Windows langsung dengan toolchain gnu gagal karena crate TLS (`ring`) butuh gcc.
- Biner Windows yang di-strip/LTO ditandai Windows Defender sebagai "potentially unwanted software", jadi profil release sengaja tanpa strip/LTO.

## Setelan (env)
| Nama | Isi |
|---|---|
| `NADI_SUPABASE_URL` | alamat proyek Supabase Nadi (`https://<proyek>.supabase.co`) |
| `NADI_KUNCI_PUBLIK` | kunci publishable Supabase (kunci publik yang sama dengan aplikasi web) |
| `NADI_TOKEN_AGEN` | token `nma_...` dari pemilik/admin |
| `NADI_RTSP` | alamat RTSP kamera |
| `NADI_LATAR` | berkas gambar latar saat ruangan kosong (mis. `latar.png`) |
| `NADI_DETIK` | jeda antar cuplikan, bawaan 2 detik |
| `NADI_FFMPEG` | jalur ffmpeg bila tidak di PATH |

## Langkah
1. **Kalibrasi**, saat ruangan kosong: `nadi-mata-agen kalibrasi`. Satu cuplikan kamera disimpan ke `NADI_LATAR`. Ulangi bila kamera bergeser atau tata letak berubah.
2. **Jalankan**: `nadi-mata-agen jalan`. Agen memuat zona dan membaca kamera.
   - Keadaan baru dikirim setelah terbaca sama 2 cuplikan berturut-turut, supaya orang yang lewat tidak ikut terhitung.
   - Kalau aliran putus, agen menyambung ulang setelah 5 detik.
   - Zona dimuat ulang tiap 10 menit.
3. **Nyalakan otomatis**:
   - Windows: Task Scheduler, pemicu "At startup", aksi `nadi-mata-agen.exe jalan`, env di skrip `.cmd`.
   - Linux: layanan systemd dengan `Restart=always` dan `EnvironmentFile=/etc/nadi-mata.env` (izin berkas 600).

## Cara kerja dan batasnya
- **Cara menilai:** setiap cuplikan diperkecil ke 160x120 abu-abu lalu dibandingkan dengan latar.
  - Meja terisi bila lebih dari 12% piksel zonanya berubah.
  - Antrean dihitung dari gumpalan perubahan yang cukup besar.
  - Cara ini lebih sederhana dari pendeteksi orang di peramban (F5-01) dan cocok untuk kamera tetap.
- **Yang membuat agen salah membaca:** perubahan cahaya besar, kamera bergeser, atau barang yang ditinggal di meja. Kalibrasi ulang mengatasinya.
- **Ukuran (docs/quality/agen-mata.md):** 94,4% keadaan meja benar pada korpus fixtures/korpus/mata, sama untuk biner Windows dan Linux.

## Uji (pengembang)
- **Windows:** jalankan mediamtx (https://github.com/bluenviron/mediamtx, MIT), lalu terbitkan video korpus:
  ```
  ffmpeg -re -stream_loop -1 -i fixtures/korpus/mata/video.webm -c:v libx264 -preset veryfast -tune zerolatency -g 4 -f rtsp rtsp://127.0.0.1:8554/meja
  ```
  Setelah itu, dari apps/web: `AGEN=<biner> node scripts/uji-agen-mata.ts`. Skrip ini menyimpan zona korpus dan membuat token untuk akun uji A, menjalankan agen 75 detik, menghitung kejadian `mata_agen`, lalu mencabut token.
- **Linux (WSL):** `AGEN_WSL=1 AGEN=/root/target-nadi/release/nadi-mata-agen node scripts/uji-agen-mata.ts`. Skrip ini memakai `edge/mata-agen/uji/rtsp-linux.sh` untuk menyalakan mediamtx, penerbit, dan agen di dalam WSL.
- **Akurasi:** `nadi-mata-agen evaluasi fixtures/korpus/mata/video.webm fixtures/korpus/mata/sumber/latar.jpg fixtures/korpus/mata/zona.json fixtures/korpus/mata/jawaban.json`.
