# Desain Nadi: permukaan Persuade

Berlaku mulai 4 Nov 2026 untuk:
- landing (`/`, `/en`);
- halaman fitur (`/fitur/*`, `/en/fitur/*`);
- harga, video promo, teaser, potongan fitur, dan deck.

Untuk permukaan ini, berkas ini menggantikan DIRECTION.md. Aplikasi (permukaan Operate) tetap memakai DIRECTION.md, kecuali bagian craft floor di bawah.

Dasar:
- skill desain terbaru: Impeccable 4.8.0 (4 Nov 2026), Taste Skill v2 (25 Okt 2026), Emil Kowalski (2 Nov 2026);
- riset psikologi: docs/research/psikologi-persuasi.md;
- kerangka yang disetujui Tristan: artefak kerangka v2 yang disetujui Tristan.

## 1. Gagasan

**Dunia.** Poster jalanan warung Indonesia: spanduk kunyit, papan nama berhuruf sempit tebal, cap merah, map biru, daun hijau, nota di atas meja kasir.

**Kalimat ide.** Di halaman ini, kertas usaha yang berserakan (nota, kuitansi, chat, Excel) menjadi kartu rapi bercap di HP pemilik. Perubahan dari kacau ke rapi itulah gerak khasnya.

**Uji pesaing.** Masukkan Majoo, Mekari, atau Jurnal ke kalimat itu. Kalimatnya tidak lagi benar, karena tidak satu pun membaca nota foto menjadi usulan yang tinggal disetujui.

## 2. Mode dan tujuan

**Mode.** Persuade. Pengunjung harus paham dalam 5 detik, untuk siapa Nadi dan apa yang dikerjakannya, lalu menekan Coba usaha contoh.

**Pertanyaan yang dijawab dengan gambar** (psikologi-persuasi.md bagian 11):

| Pertanyaan | Jawaban |
|---|---|
| Untuk aku? | Benda dari dunia pengunjung sendiri |
| Bekerja? | Demonstrasi dengan data korpus asli |
| Aku tetap pegang kendali? | Setujui dan Tolak, plus "yang tidak dilakukan AI" |

## 3. Warna

**Strategi.** Palet penuh. Setiap bagian adalah satu lapangan warna yang menempel tepi ke tepi. Warna tidak ditaburkan di atas dasar netral.

Token ada di `apps/web/src/lib/tokens.ts` (POSTER, AKSEN) dan `globals.css` (`--poster-*`, `--sorot`, `--stempel`, `--lunas`). Kontras diuji di tokens.test.ts.

| Lapangan | Terang (latar / tinta) | Gelap (latar / tinta) | Peran |
|---|---|---|---|
| kunyit | #E9A825 / #1C1B18 | #3B2D0B / #F6D27A | pahlawan, ajakan, harga |
| tinta | #1C1B18 / #FBFAF6 | #0B0A09 / #ECE7DD | demonstrasi, hal hidup |
| cap | #A63225 / #FFFDF8 | #4C1B15 / #F6C3B8 | masalah, langkah setujui |
| laut | #1A3796 / #FFFDF8 | #101F55 / #CBD6FF | keamanan, kabar pagi |
| daun | #23704A / #FFFDF8 | #0F3321 / #B7E8CA | hasil, lunas |
| tulang | #F3F1EC / #1C1B18 | #171614 / #ECE7DD | jeda, satu hari |
| lembar | #FFFDF8 / #1C1B18 | #262420 / #ECE7DD | kertas di dalam gambar |

Aksen di dalam lapangan:
- **sorot:** #E9A825 terang, #F0B53D gelap. Baris kedua judul dan angka penting, ≥ 4,5:1 di tinta dan laut, ≥ 3:1 di cap (judul besar saja).
- **stempel:** #B4372A / #F08A76. Cap merah di lembar.
- **lunas:** #23704A / #6FCF9B. Cap hijau di lembar.

Aturan:
- **Mode gelap.** Ikut perangkat (`prefers-color-scheme`).
- **Tombol dan teks.** Tombol di lapangan memakai tinta lapangan sebagai latar dan warna lapangan sebagai teks. Kelas `.medan-*` menyetel ulang `--tinta`/`--kertas`, jadi Tombol tetap benar. Teks isi selalu tinta penuh, tanpa abu.
- **Larangan.** Tanpa ungu, gradien, atau kaca buram.

## 4. Huruf

| Peran | Huruf | Setelan |
|---|---|---|
| Judul | Big Shoulders 800 (OFL, `font-papan`) | kapital, tracking -0,005em, leading 0,86 sampai 0,9, judul pahlawan clamp(64px, 11vw, 180px) |
| Teks | Plus Jakarta Sans (OFL) | 16 sampai 20 px, leading 1,5, 45 sampai 75 karakter per baris |

- **Jumlah keluarga.** Dua di landing. Bricolage dan IBM Plex Mono tidak dimuat di permukaan Persuade, karena tidak dipramuat.
- **Lima ukuran.** Judul pahlawan, judul bagian (clamp 40 sampai 88 px), kalimat pendukung (20 sampai 26 px), teks (17 px), kecil (14 px).
- **Judul.** Paling banyak 2 baris di 390/768/1440 px, ≤ 40 karakter (huruf sempit). Ditegakkan gerbang tulisan dan inspect.mjs.
- **Larangan.** Tanpa huruf mono, tanpa label kecil kapital di atas judul, tanpa kata yang diberi gaya berbeda di judul. Baris kedua bertinta sorot dihitung sebagai dua tinta pada pahlawan (blueprint Taste Skill), bukan kata bergaya.

## 5. Tata letak

**Bingkai.**
- Satu grid 12 kolom.
- Margin luar sama kiri dan kanan: 20 px di HP, 40 px di desktop.
- Lapangan warna menembus tepi layar.
- Isinya mengikuti batas lebar 1280 px.

**Ritme.** Jarak antarbagian ditentukan pergantian lapangan, ditambah 96 sampai 160 px ruang di dalam lapangan.

**Komposisi.** Tetangga selalu berbeda bentuk:
- pahlawan dengan judul raksasa;
- tiga panel menempel;
- penggeser selebar layar;
- mosaik petak;
- daftar besar;
- dua lapangan berdampingan.

**Larangan.**
- Tanpa garis tipis pemisah.
- Tanpa kartu sama besar berikon.
- Tanpa nomor 01/02/03 kecuali urutannya informasi (langkah halaman fitur).
- Tanpa bayangan pada benda diam.

Aturan P01 sampai P04 di cek-slop.py berlaku untuk `components/poster/` dan `app/fitur/`.

**Sudut.**
- Tombol 4 px.
- Gambar dan lembar di dalam ilustrasi 10 px.
- Dipakai sama di seluruh halaman.

**Navigasi.**
- Empat pilihan: Fitur, Harga, Masuk, dan tombol Coba usaha contoh.
- Menu Fitur berisi 9 pintu bergambar.
- Di HP, menu terbuka sebagai lembar selayar penuh, dan tombol Coba usaha contoh menempel di bawah.

## 6. Ilustrasi

**Gaya.** SVG buatan sendiri di `components/poster/ilustrasi/`:
- garis tinta 3 px, sambungan bulat;
- isian warna lapangan atau lembar, warna lewat token sehingga ikut tema gelap;
- tanpa gradien;
- tanpa foto stok.

**Benda.** Nota, kuitansi, chat WhatsApp, lembar Excel, surat dokter, HP, jempol, cap, buku kas, meja kasir, tablet absen, kamera, denah warung, slip gaji, tagihan dengan kode QR contoh (bukan QRIS sungguhan), kalender shift, gelombang suara.

**Isi.** Angka dan nama di dalam gambar diambil dari korpus sintetis (UD Sumber Rejeki Rp376.500, Fitri Astuti 3 hari, Ketut Rahmawati Rp7.196.000, tagihan Rp750.000, kabar pagi Rp716.000).

**Potongan layar Nadi.** Di halaman fitur, potongan antarmuka dibangun ulang sebagai HTML dari komponen asli, dengan atribut `data-ui`.

## 7. Gerak

Anggaran (Taste Skill references/motion.md):

| Unsur | Isi |
|---|---|
| Adegan gulir | Paling banyak 3 per halaman. Landing: pengait kacau ke rapi (digerakkan gulir), penggeser sebelum/sesudah (digerakkan pengunjung) |
| Gerak khas | Cap yang turun dan kertas yang tersedot ke HP |
| Masuk per bagian | Judul, teks, gambar berurutan 70 sampai 90 ms, naik 16 sampai 32 px, sekali |
| Umpan balik | Tekan `scale(0.97)` 140 ms, sorot 180 ms |
| Gambar bergerak | Ilustrasi petak fitur (kode absen berkedip, slip tersusun, meja berganti, angka menghitung) |

Kurva:
- `--ease-keluar` (0,22, 1, 0,36, 1) untuk masuk dan UI < 600 ms;
- `--ease-expo` (0,16, 1, 0,3, 1) untuk muncul ≥ 800 ms;
- `--ease-tempuh` (0,76, 0, 0,24, 1) untuk benda yang berpindah;
- `--ease-pergi` hanya untuk yang pergi.

Larangan dan batas:
- Tanpa ease-in untuk yang ditunggu.
- Tanpa pantulan.
- Tanpa animasi properti tata letak.
- Durasi: tekan 100 sampai 160 ms, menu 150 sampai 250 ms, muncul 500 sampai 900 ms, pembukaan gambar 1.100 sampai 1.600 ms.

Gerak dikurangi:
- Keadaan awal tersembunyi hanya di dalam `@media (prefers-reduced-motion: no-preference)`.
- Halaman yang diam adalah halaman jadi.
- Adegan gulir menampilkan keadaan akhirnya.

Kinerja:
- Hanya `transform`, `opacity`, `clip-path`, dan `filter` ringan.
- Gerak gulir memakai CSS scroll-driven animation (`animation-timeline: view()`) bila didukung. Bila tidak didukung, tampil keadaan akhir.
- Tanpa pustaka gerak di bundel landing.

## 8. Tulisan

- **Gerbang.** Mode web di `scripts/cek-tulisan.py`: judul ≤ 40 karakter, kalimat ≤ 20 kata, rerata ≤ 12 kata per bagian.
- **Panjang.** Landing ≤ 150 kata di luar harga dan pertanyaan. Penjelasan pindah ke halaman fitur.
- **Suara.** VOICE.md tetap: "kamu", kata kerja di depan, angka sebagai bukti, istilah akuntansi sebagai keterangan kedua.
- **Bukti.** Bukti hanya yang nyata. Angka uji internal boleh, angka karangan tidak.

## 9. Craft floor (juga untuk aplikasi)

- **Permukaan browser.** Seleksi teks, caret, cincin fokus, dan offset garis bawah tautan memakai token (Impeccable craft-floor.md).
- **Keadaan.** Sorot, fokus, aktif, nonaktif, memuat, galat, kosong.
- **Teks isi.** Kontras ≥ 4,5:1, teks besar ≥ 3:1.

## 10. Gerbang permukaan Persuade

1. `node <taste-skill>/scripts/inspect.mjs <url>`: 0 FAIL di 1440/768/390.
2. axe 0 pelanggaran serius terang dan gelap, 390 dan 1440.
3. Lighthouse mobile performa ≥ 90.
4. `python -I scripts/cek-tulisan.py` dan `cek-slop.py` LOLOS.
5. Tangkapan layar dilihat, dikritik dengan format critique.md Taste Skill, perbaikan tiga teratas, paling banyak tiga putaran.
