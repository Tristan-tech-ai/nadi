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

## Merek dari manual resmi (W-10A, dibaca 6 Nov 2026)

| Merek | Lokal (RTSP/ONVIF)? | Alamat RTSP | Catatan | Sumber |
|---|---|---|---|---|
| Hikvision (kamera dan NVR) | Ya | `rtsp://pengguna:sandi@IP:554/Streaming/Channels/101` (kanal 1 utama), `102` (kanal 1 kecil); ID = kanal x 100 + jenis | Port bawaan 554 | supportusa.hikvision.com artikel 17000129064 |
| Dahua (kamera dan NVR) | Ya | `rtsp://pengguna:sandi@IP:554/cam/realmonitor?channel=1&subtype=0` (utama), `subtype=1` (kecil) | Kanal mulai 1; TCP dan UDP | Manual Dahua Security Radar V1.0.3; dahuawiki RTSP via VLC |
| EZVIZ | Ya, untuk model yang mendukung | `rtsp://admin:KODE@IP:554/ch1/main` | KODE = kode verifikasi 6 huruf di label, atau sandi enkripsi bila sudah diganti (sandi yang sama untuk RTSP, ONVIF, SADP); bel pintu pintar tidak mendukung | support.ezviz.com: webcam C6N/TY1/TY2, sandi fitur lokal |
| TP-Link Tapo | Ya, kecuali model baterai/surya | `rtsp://pengguna:sandi@IP:554/stream1` (utama), `stream2` (kecil) | Pakai Akun Kamera dari aplikasi Tapo (6-32 huruf), bukan akun TP-Link; batas jumlah penonton lokal | tp-link.com FAQ 2680, tapo.com FAQ 724 |
| Xiaomi Smart Camera C300 | Tidak | - | FAQ resmi: tidak mendukung ONVIF dan RTSP. Pakai HP lama sebagai kamera Mata | mi.com FAQ KA-515565 |
| Imou | Belum terverifikasi | - | Halaman produk resmi (Ranger 2) hanya menyebut bekerja dengan NVR ONVIF; pola alamat RTSP hanya dari forum pengguna, jadi tidak dipasang sebagai pilihan merek. Pemilik bisa memakai Alamat RTSP lengkap | imou.com Ranger 2 |

Di layar Mata, pilihan merek hanya yang terverifikasi (Hikvision, Dahua, EZVIZ, Tapo) ditambah "alamat RTSP lengkap". Alamat kamera harus IP pribadi, loopback, atau .local.

## Yang dibangun (W-10A)

- `apps/web/src/lib/mata/jembatan.ts`: alamat RTSP per merek, berkas `go2rtc.yaml`, dan pembuka WebRTC dari `http://127.0.0.1:1984`.
- Berkas go2rtc: modul hanya `api, rtsp, webrtc` (tanpa `exec`/`echo` yang bisa menjalankan program), API hanya di 127.0.0.1 dan hanya `/api/webrtc`, RTSP server hanya 127.0.0.1, WebRTC `:8555` tanpa STUN publik (`ice_servers: []`). CORS `*` dibutuhkan karena halaman Mata ada di domain Nadi; Chrome 142+ tetap meminta izin akses jaringan lokal.
- Berkas dibuat di peramban dan diunduh. Kata sandi kamera tidak dikirim dan tidak disimpan Nadi.
- Sumber langsung (kamera dan jembatan) kini memakai latar median bergulir (`LatarHidup`): 30 dtk pertama ditampung lalu dihitung, latar disegarkan tiap 10 dtk, irama 5 bingkai per detik tetap. Latar dari bingkai pertama goyah bila kamera mulai saat toko ramai (korpus pendek: 4 sampai 6 dari 5, tergantung detik mulai).
- Uji: `e2e/mata-jembatan.spec.ts` di produksi. Kamera RTSP sintetis dari korpus `mata-v2/pendek.webm`, lalu jembatan dijalankan dengan berkas yang diunduh dari layar. Hasilnya 5/5 kunjungan, dan permintaan ke luar komputer terbesar 991 bita.

## Yang belum

- Imou dari manual resminya; uji fisik dengan kamera merek sungguhan (belum ada perangkat).
- Penemuan kamera ONVIF otomatis (WS-Discovery) di jaringan toko.
- Uji fisik capture card.
