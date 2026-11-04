# Rencana kerja desain, tulisan, dan video (mulai 4 Nov 2026)

Perintah Tristan 4 Nov 2026, setelah kerangka versi 2 (artefak kerangka v2 yang disetujui Tristan) disetujui:

- Animasi kelas tinggi: kamera, suasana, gerak, dihitung sampai detail dan menurut cara otak menerima informasi.
- Musik iklan yang dianalisis seperti penata audio profesional; efek suara dari bunyi biasa yang diolah (pukulan meja, denting garpu) sampai cocok konteks.
- Hanya memakai skill terbaru (Oktober 2026 ke atas). Kebiasaan lama, termasuk aturan DIRECTION.md yang bertentangan dengan skill itu, tidak dipakai.
- Narasi profesional dengan psikologi per bahasa (Indonesia, Inggris).
- Gerbang bahasa seperti di proyek research startup: aturan keras, mode email, dan lainnya, disesuaikan untuk tulisan SaaS.

Keputusan yang sudah dikunci di kerangka:
- Landing visual dulu.
- 9 halaman fitur.
- Navigasi empat pilihan.
- Aset digambar sendiri.
- Tema ikut perangkat.
- Video 58 detik mengikuti ketukan musik.

## Urutan (setiap langkah selesai dan terbukti sebelum langkah berikutnya)

| No | Tugas | Isi | Bukti selesai |
|---|---|---|---|
| 1 | D-23 riset psikologi | Persepsi visual dan keputusan: kesan 50 ms, fluency, gambar lawan teks, beban kognitif, prediksi imbalan, puncak-akhir, efek IKEA, penghindaran kerugian. Psikologi bahasa Indonesia dan Inggris untuk tulisan produk. Audio: standar kenyaringan, teknik olah efek suara. Semuanya dari sumber primer bertanggal. | docs/research/psikologi-persuasi.md, docs/research/audio-iklan.md, baris LEARN.md |
| 2 | Q-40 gerbang tulisan | Port cek_gaya_ai.py dan cek_en2.py ke scripts/cek-tulisan.py. Mode: ui, web, video, deck, email. Batas per mode: judul ≤ 32 karakter, tombol 1 sampai 3 kata, kalimat web ≤ 20 kata rata-rata, email ≤ 35 kata per kalimat. Dijalankan atas kamus id/en dan naskah video/deck. Dibuat merah sengaja sekali. Langkah `tulisan` di gate.sh. | selftest lulus, gate merah pada contoh buruk, LULUS pada kamus |
| 3 | D-24 sistem desain | docs/design/DESIGN.md menggantikan DIRECTION.md untuk permukaan Persuade. Isinya: token poster terang/gelap, Big Shoulders dan Plus Jakarta Sans, token gerak (expo out, durasi, stagger), gaya ilustrasi SVG, aturan rumah Taste Skill dan craft floor Impeccable. cek-slop.py ditambah: garis tipis, mono, eyebrow. | DESIGN.md, token di globals.css dan tokens.ts dengan tes kontras kedua tema |
| 4 | D-20 landing | Dibangun ulang dari kerangka, dalam bahasa id dan en. Isinya: pengait gulir (kacau lalu rapi), Foto Setujui Beres, geser sebelum/sesudah, petak fitur bergerak, aman, harga, mulai. | inspect.mjs 0 FAIL di 1440/768/390, axe 0 serius terang/gelap, Lighthouse mobile ≥ 90, e2e lulus di produksi |
| 5 | D-25 halaman fitur + navigasi | 9 halaman /fitur/*. Templat lima bagian: pahlawan bergerak, masalah lawan Nadi, tiga langkah, yang tidak dilakukan AI, dua pintu. Menu Fitur bergambar; lembar penuh di HP. | e2e navigasi, inspect dan axe per halaman, gerbang tulisan |
| 6 | D-21 video | Musik CC BY 3.0 dipilih lewat analisis: tempo, ketukan, bagian, kenyaringan, spektrum. Efek suara diolah dari bunyi CC0/CC BY. Adegan dibangun di HyperFrames 0.9.10 dengan blueprint dan kamera. Campuran −14 LUFS ±1, puncak sebenarnya ≤ −1 dBTP. Teaser dan potongan fitur diturunkan dari sistem yang sama. | hyperframes check 0 galat, lembar kontak diperiksa, ebur128 terukur, kredit di ASSETS.md dan kartu akhir |
| 7 | D-22 deck | Ditulis ulang dengan pola assertion-evidence dan gerbang tulisan mode deck. | validate.py, render PDF diperiksa |

Langkah 4 dan 5 berbagi komponen. Langkah 6 memakai ilustrasi dan token dari langkah 3 supaya video dan situs satu dunia.

## Yang tidak dipakai lagi (pengetahuan sebelum Oktober 2026 atau aturan lama)

- **Warna dan huruf lama:** krem #F6F2EA sebagai latar landing; garis rambut buku kas; IBM Plex Mono sebagai kostum; Bricolage Grotesque.
- **Gerak lama:** batas gerak "satu gerak per layar" untuk permukaan Persuade. Penggantinya: anggaran gerak Taste Skill, yaitu adegan gulir, satu gerak khas, masuk berurutan, umpan balik, dan satu gambar bergerak.
- **Video lama:** tangkapan layar PNG di video. Penggantinya UI HTML yang dibangun dari komponen asli.
- **Pola di landing:** kartu ikon berjajar, label kecil di atas judul, nomor 01/02/03.

Aplikasi (permukaan Operate) tetap tenang. Perubahannya hanya pada hal yang disyaratkan craft floor: tema permukaan browser, keadaan, dan cincin fokus.

## Batas yang tidak berubah

- **Isi dan data:** tanpa ungu, gradien, atau emoji. Bukti hanya yang nyata. Data sintetis.
- **Lisensi aset:** semua tercatat di docs/ASSETS.md.
- **Jejak dan biaya:** tanpa jejak asisten di repo. Tidak ada paket berbayar.
- **Musik:** katalog HeyGen tidak dipakai untuk promo karena paket gratis melarang iklan (Ketentuan HeyGen Bagian 4, diperbarui 16 Okt 2026).
