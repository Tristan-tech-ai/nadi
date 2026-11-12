# Video demo Nadi v2 (UAT-02)

Berkas hasil: `proposal/nadi-demo-v2.mp4` di luar repo (282,6 dtk, 1920x1080 30 fps, H.264 + AAC, -15,9 LUFS, 18,8 MB). Dikirim ke Tristan 12 Nov 2026.

## Kekurangan video lama (docs/promo/nadi-demo.mp4, 204 dtk, ditonton ulang 12 Nov 2026)

1. Bukan satu cerita. Usaha di layar berganti-ganti (Toko Bu Sari, Kafe Senja Sanur, Hotel Segara), jadi penonton tidak melihat satu pemilik menyelesaikan satu hari kerja.
2. Sebagian besar adegan adalah susunan ulang layar (potongan DOM yang dianimasikan), bukan rekaman aplikasi yang sedang dipakai. Kursor dan klik tidak pernah menghasilkan perubahan sungguhan.
3. Layar aplikasi tampil kecil di tengah bidang kertas kosong (sekitar 40% lebar bingkai), sehingga angka dan isian tidak terbaca di 1080p.
4. Tidak ada awal: tidak ada daftar atau onboarding, langsung ke fitur.
5. Gaji hanya kartu judul ("Gaji dihitung sendiri"), tidak ada draf atau Gerbang Gaji yang menahan nama.
6. Tidak ada kerja tim, proyek, maupun fitur tambahan (paket resmi atau buatan sendiri). AI milik pengguna hanya disebut lewat kartu judul.
7. Mata hanya satu jenis sumber, dan rekaman CCTV yang dipakai tidak boleh untuk promo (lihat docs/ASSETS.md).
8. Judul di atas layar berupa kalimat pendek abu-abu kecil yang mudah terlewat; tidak ada caption per langkah.

## Cara v2 dibuat

- Satu usaha sintetis, Dapur Sanur (rumah makan dan katering, Denpasar, WITA, 30 orang), dibuat dari onboarding di produksi nadi-swart.vercel.app memakai akun yang dimasukkan sendiri oleh Tristan di Chrome. Asisten tidak mengetik kata sandi.
- Alur dijalankan lewat alat kendali peramban; jendela Chrome direkam dengan ffmpeg `gfxcapture` (Windows Graphics Capture) per babak, dipotong ke area halaman 1600x900 (bilah tab dan alamat tidak ikut).
- Tema terang dipaksa lewat `data-tema="terang"` yang memang didukung globals.css (OS perekam memakai mode gelap). Kilas gelap sesaat setiap halaman dimuat penuh dibuang otomatis dari bingkai (YAVG < 140).
- Bagian diam dibuang otomatis: hanya bingkai dengan skor perubahan > 0,0006 beserta 0,3 dtk sebelum dan 1,1 dtk sesudahnya yang dipakai, lalu babak panjang dipercepat 1,15x sampai 1,6x.
- Caption bahasa Indonesia dibakar di pita bawah (Plus Jakarta Sans), rekaman diperbesar 1,06x di atasnya; musik latar sintetis lokal di-master -16 LUFS.
- Skrip penyusun ada di scratchpad sesi (susun_nadi.py, aktif.py, gelap.py) dan tidak masuk repo.

## Babak

| Babak | Isi | Dtk |
|---|---|---|
| Pembuka | kartu: satu usaha, satu alur, rekaman produksi, data sintetis | 5,0 |
| 1 Mulai | nama usaha, jenis, 16 sampai 50 orang, Denpasar, WITA, saran fitur | 24,1 |
| 2 Lempar | Excel 30 karyawan, nota UD Sumber Rejeki, foto struk SPBU, mutasi bank CSV sekaligus | 22,9 |
| 3 Feed | rincian nota per baris, cap DITERIMA, 30 orang dari Excel disetujui | 39,7 |
| 4 Invoice | stiker QRIS sintetis terbaca, invoice Hotel Segara Rp5.160.000, halaman tagihan ber-QRIS | 40,1 |
| 5 Gaji | draf 30 orang, Gerbang Gaji menahan tanpa absen, satu slip dilepas beralasan | 17,9 |
| 6 Kerja tim | usulan pelaksana paling ringan, 24 poin, tim 60/40, checklist | 35,1 |
| 7 Mata | rekaman kamera atas nyata, zona usulan AI, zona Pintu, pantau di perangkat, CCTV/NVR lewat jembatan | 47,3 |
| 8 Fitur tambahan | paket resmi Pesanan katering, Cek suhu kulkas buatan sendiri, jalur AI-mu | 45,5 |
| Penutup | kartu alamat produksi | 5,0 |

Rekaman aplikasi 272,6 dari 282,6 dtk (96%).

## Yang belum dan cacat yang ditemukan saat merekam

- Obrolan dengan AI milik pengguna lewat MCP belum direkam: menambah konektor kustom di akun aplikasi AI Tristan ditolak penjaga asisten, jadi menunggu Tristan menambah konektornya sendiri (UAT-02B).
- Dua penunjuk tampak di beberapa bingkai: alat kendali peramban sudah menggambar penunjuknya sendiri, dan penunjuk tambahan yang disuntikkan untuk rekaman ikut tampil. Rekaman berikutnya tanpa penunjuk suntikan.
- Cacat aplikasi menjadi tugas: Q-45 label jenis zona selalu Rak, Q-46 Hitung kunjungan baru mengenali zona Pintu setelah muat ulang, Q-47 hasil hitung kosong tanpa kalimat bila belum ada kunjungan lengkap, Q-48 isian Pelanggan wajib buntu saat daftar pelanggan kosong, Q-49 usulan denah AI memberi jenis lorong untuk zona bernama Pintu.
