# Belajar desain dan menulis, 4 Nov 2026

Permintaan Tristan 4 Nov 2026: landing masih jelek, video statis seperti PPT lama. Sebelum membuat apa pun, pelajari skill desain AI terbaru (setelah Oktober 2026) dan cara penulis profesional menulis untuk web, video, dan deck, lalu bawa skill itu ke Nadi.

Berkas ini berisi tiga bagian. Pertama, apa yang dipelajari dan dari mana. Kedua, diagnosis jujur atas landing dan video yang sekarang, diukur dengan alat dari skill itu. Ketiga, aturan baru yang mengikat pekerjaan berikutnya (D-20 landing, D-21 video, D-22 deck).

## 1. Sumber yang dibaca (semua dibaca isinya, bukan ringkasan)

| Skill | Versi / commit | Lisensi | Isi yang dipakai |
|---|---|---|---|
| Impeccable (pbakaus/impeccable) | v4.8.0, engine 0.1.18, commit f864521, 4 Nov 2026 | Apache-2.0 | mode Persuade/Operate/Read, craft floor, alur new-work (tujuh kandidat dunia visual dari budaya pengguna, lalu undian arah), daftar huruf bawaan AI |
| Taste Skill v2 (Leonxlnx/taste-skill) | commit 12af471, 25 Okt 2026 | MIT | studi 247 situs galeri, aturan rumah yang diukur `inspect.mjs`, cara menulis argumen halaman, anggaran karakter judul |
| Emil Kowalski design engineering (emilkowalski/skill) | commit f1090be, 2 Nov 2026 | MIT | kerangka keputusan animasi, kurva, durasi, tekan tombol, clip-path |
| Ogilvy copywriting, Stop Slop, Better Writing, Landing Page (boraoztunc/skills) | commit 1209fb6, 4 Nov 2026 | MIT/Apache-2.0 | posisi, janji, judul, aturan video; pola tulisan AI yang dibuang |
| Copywriting dan Video (coreyhaines31/marketingskills) | commit 88c79f6, 30 Okt 2026 | MIT | kerangka salinan, film produk yang dirender dari kode (DOM asli, bukan tangkapan PNG) |
| HyperFrames animation | CLI 0.9.10 (rilis 4 Nov 2026) | Apache-2.0 | 22 blueprint adegan (overwhelm-surround, cursor-ui-demo, camera-journey, kinetic-type-beats, fixed-anchor-cycle) |
| Assertion-evidence (Michael Alley, Penn State) | Alley dan Neeley 2005, Garner dan Alley 2013 | riset | judul slide berupa kalimat klaim, bukti visual, bukan poin-poin |

Skill dipasang di folder skill pengguna di luar repo (aturan TANPA JEJAK). Skill `/design` resmi penyedia asisten (rilis Agustus 2026, pratinjau) tidak tersedia di lingkungan ini, jadi tidak dipakai.

## 2. Diagnosis: kenapa landing terasa jelek

Diukur dengan `inspect.mjs` Taste Skill pada https://nadi-swart.vercel.app/ (4 Nov 2026, 1440/768/390 px): **11 FAIL, 8 WARN**.

| Temuan | Angka | Artinya |
|---|---|---|
| Judul pahlawan | 10 kata, 4 baris di 1440 px, 60 px (4,2vw) | judul adalah kalimat, bukan judul; situs galeri terbaik memakai median 5 kata dan huruf terbesar 8,4vw |
| Gambar | 0 foto, 0 rekaman, 0 potongan antarmuka asli | halaman hanya teks; studi: situs skor tinggi memberi gambar ≥ setengah layar pertama 68% kali |
| Garis tipis | 51 garis pemisah | buku kas diterjemahkan jadi garis rambut di mana-mana, terbaca sebagai tabel, bukan halaman |
| Gerak | 7 elemen bergerak | halaman diam; batas bawah skill 8, saran 16 |
| Layar kosong | 2 dari 7 layar desktop hampir kosong | bagian kurang isi |
| Huruf | 3 keluarga, 10 ukuran, mono sebagai kostum | IBM Plex Mono di nota; Plus Jakarta Sans masuk daftar huruf bawaan AI di Impeccable |
| Latar | #F6F2EA krem kuning | "palet asisten": krem + aksen merah bata adalah tampilan yang dihasilkan hampir semua model untuk subjek hangat |
| Teks isi | abu-abu 6,4:1 | halaman terasa belum selesai |
| Gerak dikurangi | 6 blok teks pahlawan tetap tak terlihat | aksesibilitas rusak saat prefers-reduced-motion |

Pelajaran terbesar: arah "kertas kerja yang hidup" benar, tetapi dirender dengan versi paling lembut dari dunianya (krem, garis rambut, huruf mono). Impeccable menyebutnya "dunia yang dikunci brief mengunci dunianya, bukan versi terlembutnya". Dunia kertas kerja warung di Indonesia justru penuh warna jenuh: sampul buku kas hijau tua dan merah marun, map snelhecter biru, kuning, merah, nota rangkap putih-merah muda-kuning, stabilo, cap merah, kertas thermal, papan harga kapur. Itu semua belum dipakai.

## 3. Diagnosis: kenapa video terasa PPT

Lembar kontak 16 bingkai docs/promo/nadi-promo.mp4:

- Setiap adegan susunannya sama: judul kiri, tangkapan layar kecil kanan, latar krem. Tidak ada perubahan skala, sudut, atau warna antaradegan.
- UI yang ditampilkan terlalu kecil untuk dibaca lebih dari 1 detik (aturan film produk: teks ≥ 20 px pada 1080p).
- Tangkapan layar berupa PNG beku. Tidak ada kursor, ketikan, angka yang menghitung, atau kamera yang mendorong ke bagian penting.
- Masalah (kertas berserakan) hanya empat kartu kecil yang miring, bukan rasa kewalahan.
- Gerak hanya muncul dan cap DISETUJUI. Blueprint HyperFrames untuk masalah (overwhelm-surround), demo (cursor-ui-demo), dan perjalanan kamera (camera-journey) tidak dipakai padahal sudah terpasang.

## 4. Aturan baru desain (mengikat D-20, D-21, D-22)

**Proses**
1. Tentukan mode permukaan dulu. Landing, harga, video, deck = Persuade. Aplikasi = Operate (tenang, presisi). Panduan = Read.
2. Untuk Persuade: inventaris 8-12 hal yang hanya milik Nadi dan dunianya, tulis kalimat ide "Di halaman ini, [benda dari dunia warung] menjadi [perangkat komposisi]", uji dengan pesaing (kalau kalimat tetap benar untuk Majoo atau Mekari, itu ide kategori).
3. Tulis argumen halaman (klaim + bukti per bagian) sebelum markup. Bagian tanpa klaim dihapus.
4. Satu hal hidup yang bisa dilakukan pengunjung, dari isi nyata Nadi, jalan dengan jempol di HP.
5. Ukur dengan `inspect.mjs` sampai 0 FAIL, lihat tangkapan layar sendiri, kritik, perbaiki tiga teratas, ulang maksimal tiga putaran.

**Larangan baru di landing (di atas ANTI-SLOP.md)**
- Tanpa garis rambut sebagai pemisah (kecuali tabel sungguhan dan isian formulir). Pisahkan dengan ruang, langkah nada, atau skala.
- Tanpa huruf mono di luar kode atau nomor dokumen asli.
- Tanpa label kecil di atas judul (eyebrow), tanpa nomor 01/02/03, tanpa deretan kartu sama besar.
- Tanpa bayangan pada benda diam.
- Judul paling banyak dua baris di 390, 768, dan 1440 px: sekitar 32 karakter.
- Maksimal dua keluarga huruf, lima ukuran.
- Teks isi memakai tinta penuh, bukan abu-abu.
- Minimal empat gambar nyata (foto dunia warung berlisensi bebas, atau potongan antarmuka Nadi asli yang dirender sebagai HTML, bukan PNG kabur).
- Gerak: satu gerak khas, masuknya bagian berurutan 60-90 ms, umpan balik di setiap kontrol, satu gambar bergerak. Keadaan awal tersembunyi hanya di dalam `prefers-reduced-motion: no-preference`.

**Gerak di aplikasi (Emil Kowalski)**
- Yang dipakai ratusan kali sehari tidak dianimasikan. Feed: cap hanya saat menyetujui.
- Kurva ease-out kuat `cubic-bezier(0.23, 1, 0.32, 1)`, tanpa ease-in; UI < 300 ms; tombol `scale(0.97)` saat ditekan; tidak pernah dari `scale(0)`.

## 5. Aturan baru menulis

**Web (Ogilvy, Taste Skill copy, Stop Slop, VOICE.md)**
- Posisi dulu: apa yang dikerjakan Nadi dan untuk siapa. Satu janji yang spesifik dan bisa ditepati.
- Judul pahlawan: bentuk "apa ini" atau "klaim yang tidak bisa ditandatangani pesaing", ±32 karakter. Kalimat pendukung satu, ≤ 22 kata, menyebut untuk siapa.
- Fakta menjual, kata sifat tidak. "Nota pemasok jadi jurnal dalam 9 detik" lebih baik dari "pembukuan otomatis".
- Buang: kontras "bukan X, tapi Y", daftar tiga sejajar di mana-mana, kalimat pengantar ("Inilah..."), kata keterangan pengisi, agensi palsu ("data berbicara").
- Tombol menyebut aksinya, satu nama untuk aksi utama di seluruh halaman.

**Video (Ogilvy TV, film produk dari kode)**
- Pembukaan kuat: produk atau masalah terlihat dalam 2 detik pertama.
- Masalah-solusi-bukti: tunjukkan masalah yang dikenali, tunjukkan Nadi menyelesaikannya, buktikan di layar sungguhan.
- Yang ditunjukkan lebih penting dari yang dikatakan. Satu teks per adegan, terbaca, menetap ≥ 0,4 detik sebelum aksi yang dijelaskannya.
- UI direkonstruksi sebagai HTML dari komponen Nadi asli agar bisa diketik, diklik kursor, dihitung, dan didorong kamera. Data sintetis.
- Tanpa rangkuman di akhir. Kartu akhir: logo, satu kalimat, satu URL.
- Komposisi berganti tiap adegan (skala, sudut kamera, warna latar), mengikuti blueprint.

**Deck (assertion-evidence)**
- Judul slide adalah kalimat klaim, rata kiri, ≤ 2 baris. Isinya bukti visual (layar, angka, bagan), bukan poin-poin.
- Satu pesan per slide; urutan piramida: klaim utama di depan.

## 6. Yang tetap

Larangan ungu, gradien, emoji, tanda pisah panjang; sapaan "kamu"; format rupiah; bukti hanya yang nyata (tanpa logo pelanggan, testimoni, atau angka pengguna karangan). Token aplikasi (Operate) tidak diganti di tugas landing; perubahan identitas yang menyentuh aplikasi dicatat terpisah di DECISIONS.
