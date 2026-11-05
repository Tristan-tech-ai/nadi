# Mata dari perangkat apa pun yang menangkap gambar langsung (W-10)

Riset 6 Nov 2026, atas pertanyaan Tristan: bisakah Mata disambungkan ke CCTV yang sudah ada, tanpa mitra dan tanpa software kamera yang boros?

Jawaban singkat: bisa. Semua perangkat pada akhirnya masuk ke halaman Mata di peramban. Penghitungan tetap di perangkat itu (Mata v2, docs/research/mata-v2.md). Hanya rekap per jam yang dikirim ke Nadi.

## Jenis perangkat dan caranya

| Perangkat | Bisa? | Cara | Sumber |
|---|---|---|---|
| Kamera HP atau laptop | Ya, sudah jalan | `getUserMedia` di halaman Mata; wajib HTTPS (konteks aman) dan izin pengguna, dengan indikator kamera menyala | MDN getUserMedia |
| Webcam USB | Ya | Tampil sebagai kamera biasa di `getUserMedia`/`enumerateDevices`; pilih perangkat di Mata | MDN getUserMedia |
| Kamera aksi atau DSLR lewat capture card HDMI | Ya | Capture card USB tampil sebagai kamera biasa (UVC) | Kelas perangkat UVC; belum diuji fisik |
| CCTV IP (RTSP) | Ya, lewat jembatan lokal | Peramban tidak bisa membuka RTSP langsung. Jembatan di jaringan toko mengubahnya menjadi WebRTC, lalu halaman Mata di jaringan yang sama membacanya | MDN; go2rtc dan MediaMTX (MIT) |
| CCTV ONVIF | Ya, lewat jembatan | ONVIF Profile S (streaming video) sedang dihentikan; pendaftaran kesesuaian produk ditutup 31 Mar 2027. Profile T mencakup H.264/H.265. Jembatan membaca alamat stream dari kamera | onvif.org Profile S dan T |
| NVR/DVR | Ya, bila meneruskan RTSP per kanal | Sama seperti CCTV IP, lewat jembatan | Manual merek (belum diverifikasi per merek, W-10A) |
| CCTV yang hanya lewat aplikasi cloud mereknya | Tidak langsung | Tidak ada stream lokal yang bisa dibaca. Jalan keluarnya HP lama sebagai kamera Mata | Belum diverifikasi per merek (W-10A) |

## Jembatan lokal: pilihan gratis berlisensi terbuka

- **go2rtc** (MIT): satu berkas tanpa dependensi untuk Windows 10+, macOS, dan Linux termasuk Raspberry Pi. Masukannya RTSP, ONVIF, MJPEG, HomeKit, dan beberapa kamera merek (Tapo, Wyze, Xiaomi). Keluarannya ke peramban berupa WebRTC, MSE, HLS, dan MJPEG. FFmpeg hanya dibutuhkan untuk transcoding. Sumber: github.com/AlexxIT/go2rtc, dibaca 6 Nov 2026.
- **MediaMTX** (MIT): satu berkas tanpa dependensi untuk Linux, Windows, dan macOS; protokol diubah otomatis, termasuk RTSP ke WebRTC dan HLS. Sumber: github.com/bluenviron/mediamtx, dibaca 6 Nov 2026.

Pilihan Nadi: go2rtc sebagai bawaan, karena satu berkas Windows paling dekat dengan komputer kasir di toko, dan bisa membaca beberapa kamera merek tanpa RTSP.

## Rancangan

1. Pemilik menjalankan satu berkas jembatan di komputer toko yang selalu menyala. Mata memberi berkas konfigurasi siap pakai berisi alamat kamera yang diketik pemilik.
2. Halaman Mata di komputer yang sama membuka stream WebRTC dari `localhost` jembatan, lalu menghitung di peramban.
3. Video tidak pernah keluar dari jaringan toko. Server Nadi tidak menarik stream lewat internet, karena itu menuntut port terbuka, dan port terbuka adalah celah yang paling sering dibobol.
4. Papan informasi tetap wajib sebelum rekap diterima (UU 27/2022 Pasal 17, sudah ditegakkan database di W-02).

## Yang belum

- W-10A (bangun): langkah pasang, Mata membaca stream jembatan, uji dengan stream RTSP sintetis dari video korpus, e2e.
- Verifikasi per merek dari manual resmi (Hikvision, Dahua, EZVIZ, Imou, Xiaomi, TP-Link Tapo): mana yang membuka RTSP/ONVIF dan mana yang hanya lewat cloud.
- Uji fisik capture card.
