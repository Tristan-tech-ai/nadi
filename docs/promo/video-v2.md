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

## v3 (UAT-02C, 12 Nov 2026): direkam ulang dan disusun dengan motion design

Masukan Tristan untuk v2: tanda klik oranye, penunjuk dobel, kamera diam, musik sintetis jelek, tampilan datar. Perubahan v3:

- Rekaman: cursorcam 1.1.0 di produksi dengan login yang dimasukkan Tristan sendiri (cookie, bukan sandi). Kursor halus dan zoom per klik, tanpa riak, tanpa bilah browser, di atas latar kertas buatan sendiri. Usaha baru Dapur Pandan dibuat lewat onboarding. Setiap babak dibuka dengan pindah usaha (dipotong) karena cookie tersimpan membuka usaha lama.
- Penyusunan: HyperFrames 0.9.37 dengan aturan motionmaxxing (ide milik merek, demo fisik, potong saat bergerak, tanpa label pojok atau layout slide, kartu penutup paling lama 1,4 dtk). Pembuka berupa berkas nyata (nota, foto struk, Excel, baris mutasi) jatuh ke meja kertas. Caption tercetak di secarik nota thermal bertepi sobek (bentuk logo Nadi), muncul kata per kata, dengan stabilo kunyit pada satu kata kunci. Sambungan antarbabak memakai sapuan nota thermal. Tiga cap: DITERIMA di Feed, TERBIT saat invoice, AKTIF saat fitur buatan sendiri diterapkan. Penutup: tanda Nadi dan cap alamat.
- Suara: lima jenis efek turunan CC0 (klik, ketik, kertas/lempar, transisi, cap, notifikasi), ditaruh dari waktu langkah cursorcam yang dipetakan, bukan ditebak. Lagu "Podcast Interview Background Music" HitsLab (Pixabay, pilihan Tristan) diturunkan 14 dB tepat sebelum cap pertama dan 7 dB di cap lain, lalu disambung ke ujung aslinya. Dua versi: dengan lagu (-16 LUFS) dan efek saja (tingkat efek sama).
- Ditolak: merekam pratinjau Envato Elements, karena lisensinya mewajibkan langganan aktif (Envato Elements License, revisi 6 Okt 2026).
- Cacat aplikasi baru dari rekaman: Q-50, isian porsi tim dan pilihan orang rapuh saat diketik ulang.

## v4 (UAT-02D, 12 Nov 2026): dibuat dari awal, dua potongan untuk dibandingkan

Masukan Tristan untuk v3: buka dengan Nadi, bukan nama usaha; studi kasus Dapur Pandan ditulis jelas; fleksibilitas untuk banyak jenis usaha; penjelasan tiap langkah; alur jelas; babak MCP lebih jelas; versi lagu. Rujukan gaya yang ditonton penuh: penjelas SaaS Benefyr dan Flike (What a Story). Dari Flike diambil: selalu ada yang bergerak, UI dibangun ulang untuk video (baris terangkat, kedalaman kabur, ikon mengorbit, pita warna merek, konfeti), ide visual baru sekitar tiap 2 detik.

- v4a: pembuka pemilik dengan berkas mengorbit dan lencana angka, cincin empat warna merek yang menjadi tanda Nadi, rekaman halaman depan, cara kerja (tiga lingkaran disambung pita), 14 jenis usaha mengalir ke 21 paket lalu kamera menembus ke rekaman katalog, kartu studi kasus, 10 langkah bernomor. Setiap langkah: rekaman asli dalam jendela mengambang yang bergerak, lalu momen sorot yang dibangun ulang dari teks dan angka rekaman (usulan Lempar, cap DITERIMA dan konfeti di Feed, invoice Hotel Segara + QRIS, baris gaji yang ditahan lalu dilepas dengan alasan tertulis, kartu kerja + checklist, jawaban Tanya data). Babak MCP: tangkapan asli permintaan izin alat di aplikasi AI Tristan, obrolan sungguhan yang dibangun ulang (pesan pemilik, alat Aturan fitur tambahan, Uji manifest gagal lalu lolos, JSON), lalu manifest yang sama ditempel di Tambah fitur, lolos pengawas, diterapkan, dan fitur Catatan minyak jelantah langsung muncul. 290,9 dtk, rekaman aplikasi 67%, -16 LUFS.
- v4b: "Satu hari di Dapur Pandan" per peran: setiap bab memakai jam dan lencana POV (pemilik, staf, akuntan). Tambahan: absen staf sebagai animasi HP dengan foto berlisensi bebas mengikuti alur absen asli (QR tablet berganti tiap 15 detik, kedip dan toleh, lokasi dicatat, gambar wajah tidak dikirim), Nadi belajar format asing (berkas produk aplikasi kasir lama berkolom bahasa Inggris dibaca AI hanya dari judul kolom, peta dicocokkan ulang, lalu aturan aktif dan berkas berikutnya dibaca tanpa AI; peta kolom di momen sorot diambil dari data produksi), sorot Mata dari bingkai kamera atas dengan zona dan perubahan tercatat asli. Klip pemilik dipadatkan dengan memotong langkah yang tidak perlu (bukan hanya dipercepat). Bab staf (Nyoman: kerja dan checklist di HP; Putu: kasir dan izin) dan akuntan (Ruang Akuntan, laporan keuangan) direkam dari build produksi Nadi yang dijalankan lokal dengan Supabase lokal dan usaha tiruan Dapur Pandan (30 nama dari berkas Excel yang sama, menu, kerja, invoice Hotel Segara), karena asisten tidak boleh membuat akun atau mengetik PIN dan sandi di produksi; akun uji dibuat lewat RPC aplikasi yang sama (buat_akun_staf, tambah_akuntan). Klip HP memakai tampilan seluler asli (navigasi bawah staf) dalam bingkai HP tegak. 298,8 dtk, 15 bab, rekaman aplikasi 60%.
- Temuan dari rekaman: teks "sekali saja" pada pesan belajar format tidak sesuai perilaku (AI dipakai sampai peta cocok dua kali), menjadi tugas Q-51.
