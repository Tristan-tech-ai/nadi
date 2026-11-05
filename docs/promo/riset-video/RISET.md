# Riset video SaaS kelas After Effects/Blender dengan alat yang ada (V-01)

Ditulis 6 Nov 2026. Bahan untuk V-06 (storyboard) dan V-07 (video demo ≤ 5 menit). Hal yang diukur dari sumber diberi sumbernya; hal yang
merupakan pilihan Nadi ditandai **pilihan**. Video lama (D-21, D-28) tidak dijadikan acuan.

## 1. Sumber yang dibaca penuh

| Sumber | Tanggal | Isi yang dipakai |
|---|---|---|
| Skill video-produksi, `references/code-rendered-product-films.md` (diadaptasi dari tulisan Inbox Zero, Okt 2026) | berkas 4 Nov 2026 | Setiap frame fungsi dari waktu `t`, UI asli berupa cuplikan DOM dari data contoh, aturan selera (pembuka mencapai hasil dalam ±2 dtk, tanpa rekap, kartu akhir logo tengah + satu kalimat + URL, teks ≥ 20 px di 1080p, keterangan sudah diam ≥ 0,4 dtk sebelum klik yang diterangkannya, tanpa crossfade panjang antar-UI ramai), audio (bed musik satu per format, potong di batas frasa, duck di bawah suara, −14 LUFS terintegrasi dan −1,2 dBTP), tinjauan dari lembar kontak |
| Skill video-produksi, `references/edit-anatomy.md`, `product-demo-recording.md` | 4 Nov 2026 | Membedah video rujukan menjadi tabel ketukan (potongan, keterangan, punch-in, suara) tanpa memakai ulang isinya; rekaman Playwright hanya untuk alur yang direkam ulang tiap rilis |
| Skill HyperFrames `references/motion.md` (diukur dari film peluncuran resmi HyperFrames) | 3 Nov 2026 | Angka gerak di bagian 3 dan 4 |
| HyperFrames `references/story.md`, `types/launch.md`, `types/explainer.md` | 3 Nov 2026 | Bentuk cerita (kait, ketegangan, pengungkapan, bukti, hasil, klaim, kartu akhir), "satu orang mengerjakan satu tugas nyata", tiga alur cerita sebelum memilih satu, ciri film buatan mesin |
| HyperFrames `references/film.md`, `look.md`, `sound.md` | 3 Nov 2026 | Tempo teks, musik dari pustaka berupa loop 15–30 dtk, aturan efek suara, tingkat kenyaringan |
| Skill media-use `references/mixing.md`, `references/audio.md` | 3 Nov 2026 | Rantai efek (highpass, peaking, kompresor, limiter, reverb, delay) dan otomasi volume di atribut `<audio>`; duck bed 0,3–0,4 saat ada suara |
| Skill motion-graphics `SKILL.md`, hyperframes-animation `techniques.md` | 3 Nov 2026 | Kategori grafis pendek (tipografi kinetik, hitung naik, logo), 13 teknik (gambar jalur SVG, tipografi per kata, klip-path, transisi yang kecepatannya cocok) |
| Adobe Help After Effects: Composition basics (shutter angle), Speed (Easy Ease), Time effects | dibaca 6 Nov 2026 | Lihat bagian 2 |
| Manual Blender 5.2 LTS: Cameras (depth of field), EEVEE Motion Blur, Vector Blur node, Defocus node | dibaca 6 Nov 2026 | Lihat bagian 2 |
| Wistia, State of Video 2026 (ringkasan blog) dan halaman panjang video | dibaca 6 Nov 2026 | Video < 1 menit rata-rata keterlibatan ±52%; 1–5 menit disarankan untuk konten edukasi; keterlibatan turun setelah menit ke-5 |

## 2. Teknik After Effects/Premiere/Blender dan padanannya di alat yang ada

| Teknik di alat berat | Yang sebenarnya dikerjakan (sumber primer) | Padanan Nadi |
|---|---|---|
| Motion blur dengan shutter angle (AE) | Shutter angle dalam derajat mensimulasikan pencahayaan; 180° pada 24 fps = 1/48 dtk; motion blur dinyalakan per layer dan per komposisi (Adobe, Composition basics) | `data-motion-blur="on"` di akar komposisi HyperFrames (shutter bisa diatur); untuk gerak cepat 2D cukup blur 6–12 px pada elemen seukuran teks di frame tercepat (motion.md) |
| Easy Ease dan Graph Editor (AE) | Easy Ease membuat kecepatan 0 di keyframe dengan pengaruh 33,33% di kedua sisi (Adobe, Speed) | Kurva per peran: datang `expo.out`/`power4.out`, kamera `power2.inOut`, keluar `power3.in`; pegas dengan rasio redaman 0,7–0,85 dihitung tertutup dari `t` |
| Kamera 2.5D dan parallax (AE camera, null) | Lapisan di kedalaman berbeda bergerak dengan kecepatan berbeda | Pembungkus ber-`transform` skala dan translasi per lapisan pada satu timeline; tidak memiringkan UI produk 3D (launch.md melarang) |
| Track matte dan mask (AE) | Isi terlihat hanya di dalam bentuk lain | `clip-path` (lingkaran dari titik klik untuk transisi iris, 0,15 dtk) dan `mask-image` di pembungkus |
| Kinetic type (AE text animators) | Animator per huruf/kata | Rentang per kata: blur 6 px ke 0 dan opacity 0 ke 1 dalam 0,13 dtk, jeda 0,067 dtk; atau dari abu ke tinta |
| Speed ramp dan time remap (Premiere/AE) | Kecepatan klip berubah sepanjang waktu | Lajur `rate` di `data-automation` (0,1–10) |
| Motion tracking (AE tracker) | Elemen menempel pada titik yang bergerak di video | Untuk Mata: kotak pelacak digambar dari keluaran pelacak Nadi sendiri (koordinat nyata dari `src/lib/mata`), bukan dilacak ulang |
| Depth of field (Blender camera) | Titik fokus dari jarak atau objek fokus, F-Stop kecil = kabur kuat (manual Blender, Cameras) | Kabur latar 8–15 px pada UI di sekitar elemen yang didorong maju, hanya saat kamera berpindah; elemen yang dibaca tidak pernah dikaburkan |
| Vector blur pasca-render (Blender compositor) | Blur 2D dari pass kecepatan, Shutter dalam detik (manual Blender, Vector Blur) | Sama dengan baris pertama; dirender ulang per frame karena tiap frame murni fungsi `t` |
| Color grade (Lumetri, Blender color management) | Menyamakan tampilan semua klip | Video kamera (CCTV) lewat `hyperframes media-treatment`, bukan filter CSS; UI tidak di-grade karena warnanya token desain |
| Sound design (Audition/Premiere) | EQ, kompresi, reverb, duck, normalisasi | `data-fx-chain` (highpass 80 Hz, peaking, compressor, limiter −1 dB, reverb), otomasi volume, normalisasi dua lintasan dengan ffmpeg `loudnorm` ke −14 LUFS / −1 dBTP (rantai lengkap di V-02) |

Kesimpulan: tidak ada teknik di daftar yang menuntut After Effects atau Blender. Bedanya tinggal pada keputusan angka, dan angka itu tertulis di bagian 3.

## 3. Angka gerak yang dipakai (dari motion.md, diukur pada film resmi)

- Gerak cepat 0,3–0,6 dtk dengan blur pada frame tercepat; datang lebih lama dari pergi; keluar 40–50% lebih pendek dari masuk.
- Elemen berikut mulai saat elemen sebelumnya 30–50% jalan; jeda kata 60–120 ms, butir daftar 40–80 ms.
- Judul yang sudah mendarat diam total; tahan 0,5 dtk + 0,3 dtk per kata, baris terakhir film ≥ 2 dtk.
- Ukuran judul 4–9% tinggi frame; satu kata beraksen per baris.
- Ritme: montase potong tiap 0,13–0,8 dtk; demo menahan satu bingkai 7–10 dtk saat UI bekerja; rata-rata potongan 1,8–3 dtk; jeda 0,3–0,75 dtk sebelum hasil, hasil diputar kecepatan normal.
- Ketukan: frame per ketukan = fps × 60 / BPM, dihitung dari indeks ketukan (tidak dijumlah berulang); potong di ketukan, ganti tata letak di bar.
- Transisi 3–5 jenis per film, masing-masing ada penyebab di layar (zoom menembus tombol, objek menjadi dunia, iris dari klik, whip, dip cut); paling banyak sepertiga sambungan berupa potongan keras.
- Kursor besar (4–7% lebar frame), klik menyebabkan hal berikutnya pada frame yang sama; tanpa cincin klik.

## 4. Daftar periksa video demo SaaS untuk Nadi

1. **Kait 2 detik**: frame 0 adalah gambar kecilnya, bukan hitam dan bukan logo. Pembuka memperlihatkan Nadi sedang bekerja pada sesuatu yang dikenal pemilik usaha (foto nota menjadi usulan).
2. **Masalah terlihat gagal di layar** sebelum Nadi muncul: Excel berantakan, data ganda, CCTV yang ditonton manual (aset V-04). Pesaing tidak diejek; harga pesaing hanya dari halaman resmi bertanggal.
3. **Satu orang, satu tugas nyata**, dengan satu data yang berjalan dari kait sampai hasil (pemilik toko contoh, Toko Bu Sari).
4. **UI asli**: cuplikan DOM dari usaha contoh dengan data sintetis, tidak ada tombol karangan; label sama dengan kode (diperiksa terhadap sumber).
5. **Satu ide per adegan**, setiap adegan dimasuki lewat objek yang sudah ada di layar.
6. **Tanpa narasi** kecuali diputuskan lain di V-06; teks besar dan teks produk membawa kata-kata, ≥ 26 px setelah didorong.
7. **Bukti sebagai kata kerja**: lempar, baca, setujui, tagih, hitung; tiap kata kerja satu ketukan.
8. **Hasil sekali, paling besar**, pada 60–80% durasi bagian itu.
9. **CTA**: kartu akhir logo tengah, satu kalimat, URL nadi-swart.vercel.app/demo, tahan 2–3 dtk; tanpa rekap.
10. **Panjang**: ≤ 5 menit (permintaan Tristan), dibagi bab. Data Wistia 2026: keterlibatan turun setelah menit ke-5, jadi bab pertama harus berdiri sendiri sebagai potongan ±60 dtk.
11. **Suara**: bed musik, efek hanya pada aksi yang terlihat (klik, whoosh pada potongan, pop pada angka), puncak efek satu frame setelah gambarnya, −14 LUFS / −1 dBTP diukur.
12. **Tinjauan**: lembar kontak 2×2 dilihat sendiri, keterangan tidak terpotong tepi, tidak ada data asli bocor (zona waktu, nama, email).

## 5. Ciri film buatan mesin yang dilarang untuk V-07 (story.md, motion.md, launch.md)

Ruang gelap dengan benda kecil melayang; cahaya dan partikel; semua elemen pudar dan naik; tiga kartu sejajar; logo di pojok; judul yang terus bergeser setelah mendarat; loop bernapas pada UI; setiap adegan masuk dengan cara sama; judul di atas tangkapan layar yang diredupkan; mengetik di kotak prompt sebagai pembuka; UI dimiringkan 3D. Video lama Nadi (D-21) jatuh ke dua ciri terakhir dan susunan judul kiri + panel kanan; itu sebabnya dibuang.

## 6. Yang belum dan diteruskan

- V-02: rantai olah suara (unduh mentah berlisensi bebas, EQ, kompresi, reverb, duck, normalisasi) diuji dengan pengukuran.
- V-03 dan V-10: bedah 8 rujukan (lembar kontak, peta potongan, BPM, LUFS) untuk menurunkan angka tempo dan kerapatan teks Nadi.
- V-06: tiga alur cerita, pilih satu, lalu SPEC.md dengan angka.
