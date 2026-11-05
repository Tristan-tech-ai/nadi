# Storyboard video demo Nadi v2 (V-06)

Ditulis 6 Nov 2026 dari RISET.md (V-01), SUARA.md (V-02), RUJUKAN.md (V-03, V-10), dan aset docs/promo/aset-demo (V-04). Video lama (D-21, D-28) tidak dipakai sebagai acuan.
Dikerjakan menjadi video di V-07, setelah V-12 (pelacakan Mata terlihat) dan T-01 (belajar format) selesai, karena keduanya tampil di layar dan tidak boleh digambar palsu.

## Satu hal yang diingat penonton

"Aku lempar berkas kerjaku yang berantakan, Nadi yang merapikan, dan aku cukup menyetujui."

- **Satu orang, satu hari:** Bu Sari, pemilik Toko Bu Sari (usaha contoh, data sintetis), dari pagi sampai tutup toko.
- **Data yang berjalan dari kait sampai akhir:** satu foto nota pemasok dan satu Excel karyawan berantakan.

## Bentuk

- **Dunia:** satu dunia utama, yaitu aplikasi Nadi di atas kertas hangat. Kamera mengikuti pekerjaan Bu Sari, dan setiap babak dimasuki lewat benda yang sudah ada di layar. Pola ini dari rujukan 8 dan 7: potongan keras jarang, gerak terjadi di dalam bingkai.
- **Tanpa narasi suara orang.** Kata-kata dibawa oleh teks produk asli dan satu baris judul per babak (≤ 10 kata, Bahasa Indonesia sehari-hari sesuai VOICE.md). 4 dari 8 rujukan juga tanpa narasi.
- **Panjang:** ±4 menit 45 dtk, dibagi 11 babak. Babak 0-2 berdiri sendiri sebagai potongan 50 dtk untuk media sosial.
- **Ritme:**
  - rata-rata 6-10 dtk per bingkai saat UI bekerja;
  - montase cepat 0,3-0,4 dtk per potongan hanya dua kali (babak 1 dan babak 10);
  - judul tahan 0,5 dtk + 0,3 dtk per kata, baris terakhir ≥ 2 dtk.

## Tampilan (dari DIRECTION.md, bukan bawaan alat)

| Hal | Nilai |
|---|---|
| Latar | kertas #F6F2EA; kertas-2 #EFE9DD untuk panggung kedua. Babak masalah memakai kertas yang lebih abu (#E4DED2) supaya terasa lelah |
| Tinta | #1C1B18; teks kedua #5B574F |
| Aksen | kunyit #E9A825 hanya sebagai stabilo di belakang satu kata per judul dan di angka hasil; cap #B4372A untuk cap stempel; daun #23704A untuk centang lunas |
| Huruf | Bricolage Grotesque 800 untuk judul (4-7% tinggi frame), Plus Jakarta Sans untuk teks, IBM Plex Mono untuk nomor dokumen dan rupiah di tabel; semua huruf OFL dan dimuat dari berkas |
| Kursor | panah tinta 5% lebar frame, tanpa cincin klik; klik menyebabkan perubahan pada bingkai yang sama |
| Dilarang | gradien ungu/biru, ruang gelap dengan benda melayang, UI dimiringkan 3D, tiga kartu sejajar, logo di pojok, judul yang terus bergeser setelah mendarat, loop bernapas pada UI, judul di atas tangkapan layar yang diredupkan, mengetik di kotak prompt sebagai pembuka |

**Transisi** (5 jenis, masing-masing punya penyebab di layar):
1. *benda menjadi dunia*: nota melebar menjadi layar Lempar;
2. *iris dari titik klik*: tombol Setujui membuka babak berikutnya;
3. *bawa menyeberang*: kartu hasil mengecil masuk ke layar berikutnya;
4. *whip* horizontal 0,2 dtk antarbab di babak 10;
5. *dip cut*: gelap 40% selama 3 bingkai sebelum kartu akhir.

**Suara:**
- Bed: "Inspiring Advertising - Upbeat Summer Corporate" (Rafael Krux, CC BY 4.0, 117 BPM), masuk di bar kuat (15 dtk). Babak masalah hanya ambience lirih dan tik jam; musik baru terbuka saat Nadi muncul.
- Efek dari docs/promo/audio-v2: klik, ketik, cap, lempar, notifikasi, transisi, sonic-logo. Serangan efek jatuh satu bingkai setelah gambarnya.
- Mix −14 LUFS, ≤ −1 dBTP.

## Babak

Kolom **DOM** menyebut layar asli yang ditangkap sebagai cuplikan DOM dari usaha contoh (Toko Bu Sari, akun uji B, data sintetis). Semua yang mengaku produk adalah produk.

| # | Waktu | Yang terlihat | Judul di layar | DOM / aset | Suara | Transisi keluar |
|---|---|---|---|---|---|---|
| 0 Kait | 0:00-0:06 | Frame 0: foto nota pemasok di meja kasir (korpus nota-03). Dalam 1,5 dtk baris-barisnya "tercetak" berurutan menjadi kartu usulan asli: "Catat belanja Rp... di ...", dengan "Kalau disetujui: masuk ke uang keluar" | (tanpa judul) | fixtures/korpus/nota/nota-03.png; kartu Feed `/app` (KartuFeed, tujuan U-10) | kertas, lalu ketik pendek | kartu mengecil ke pojok meja: bawa menyeberang |
| 1 Masalah | 0:06-0:40 | Malam di toko. Excel karyawan berantakan dibuka apa adanya: judul bergabung, gaji "4,5 jt" di samping "Rp 4.200.000", Budi tercatat dua kali; stabilo kunyit menandai tiga masalah satu per satu. Daftar pelanggan ganda ("Ibu Sari" dan "Sari Wulandari"). CCTV toko diputar sementara Bu Sari menghitung pengunjung dengan turus di kertas. Kartu fakta harga | "Kerja malam yang sama, setiap hari" lalu "Otomatis mahal. Murah berarti manual" | docs/promo/aset-demo/karyawan-berantakan.xlsx (ditampilkan sebagai tabel HTML yang dibaca dari berkasnya), pelanggan-ganda.csv, cctv-toko.mp4. Kartu fakta: "Modul AI asisten dijual terpisah: Rp499.000 per outlet per bulan" dengan sumber kecil "halaman harga resmi majoo, dibaca 3 Nov 2026" (docs/bisnis/harga-pesaing.md; diperiksa ulang tanggalnya saat V-07) | ambience toko lirih, tik jam; tanpa musik | montase cepat 4 potongan 0,35 dtk (Excel, CSV, CCTV, turus), lalu potongan keras ke putih kertas |
| 2 Pengungkapan | 0:40-0:48 | Nadi muncul tanpa logo dulu: kotak Lempar kosong di layar | "Lempar berkasnya. Nadi yang merapikan" | `/app/lempar` keadaan kosong | musik masuk di bar | Excel dari babak 1 jatuh ke kotak: benda menjadi dunia |
| 3 AI-mu lewat MCP (V-11) | 0:48-1:35 | Excel karyawan, daftar harga, dan 2 foto nota dilempar ke jendela chat AI umum yang digambar netral (tanpa logo atau merek pihak ketiga), yang tersambung ke MCP Nadi. AI memanggil `tulis_draf`; pemilik mengetik "Budi pindah ke topi kasir pagi, yang dobel hapus saja"; AI memanggil `ubah_draf`. Lalu layar tinjau draf Nadi: baris Budi ganda ditandai Perlu dicek, gaji tidak tercentang otomatis, sel diubah di tempat. Satu klik "Terapkan 20 baris", lalu muncul jendela batal 10 menit | "AI-mu yang menyiapkan. Kamu yang menyetujui" | chat: panel netral buatan sendiri, berisi panggilan alat MCP sungguhan (tulis_draf, baca_draf, ubah_draf, src/lib/mcp/protokol.ts) yang dijalankan saat produksi dan direkam keluarannya; Nadi: `/app/siapkan/draf/[id]` (tinjau-draf.tsx) dari draf sungguhan | ketik pada pesan, notifikasi saat draf tiba, cap pada Terapkan | tombol Terapkan memancarkan iris ke Hari ini |
| 4 Lempar dan Feed | 1:35-2:10 | Pagi berikutnya: nota, slip gaji, struk dilempar dari HP. Status asli Membaca, lalu Siap ditinjau. Di Hari ini, kartu usulan dengan "Kalau disetujui" dan "Lihat rincian" (tabel Sekarang → Jadi; pelanggan "Ibu Sari" Dilewati karena sudah ada). Setujui: kartu dicap DISETUJUI lalu bergeser keluar | "Setiap usulan bilang ke mana datanya masuk" | `/app/lempar`, `/app` (KartuFeed, RincianUsulan U-13, cap), korpus nota/slip_gaji/struk-foto, aset pelanggan-ganda.csv | lempar ×3 (variasi), cap, klik | kartu tersetujui terbawa ke Uang: bawa menyeberang |
| 5 Invoice + QRIS | 2:10-2:35 | Invoice baru untuk katering langganan; tagihan publik dengan QRIS; saat ditandai lunas, centang daun dan jurnal tercatat | "Tagih, terima QRIS, tercatat sendiri" | `/app/invoice` (Invoice baru), halaman publik `/i/[kode]` dengan QRIS sintetis | ketik, notifikasi pembayaran | iris dari QR |
| 6 Gaji | 2:35-3:00 | Draf gaji bulan ini: PPh 21 dan BPJS terhitung; satu nama ditahan Gerbang Gaji dengan alasannya; Bu Sari menyetujui sisanya | "Gaji dihitung, yang janggal ditahan" | `/app/gaji` (slip, gerbang gaji) | klik, cap | dip ke CCTV toko |
| 7 Mata | 3:00-3:40 | CCTV toko yang sama dengan babak 1, kini di Mata: setiap orang punya nomor anonim dan garis lintasannya mengikuti gerak; hitungan masuk/keluar bertambah saat jejak melewati pintu; zona kasir menyala saat ada antrean; lalu peta panas di Peta Usaha terisi. Gambar diproses di perangkat; yang tersimpan hanya rekap per jam | "Kamera menghitung. Wajah tidak disimpan" | `/app/mata` (hitung-kunjungan.tsx; **jejak bernomor, garis, dan hitungan live dibangun di V-12**), `/app/peta-usaha` (peta-panas.tsx); aset cctv-toko.mp4 + cctv-jawaban.json (hitungan di layar dicocokkan dengan jawaban) | pop kecil setiap hitungan bertambah, bed turun 3 dB | peta panas menjadi warna dasar babak berikut: banjir warna |
| 8 Otomasi + tanya data | 3:40-4:05 | Alur: "Kalau invoice lunas, buat kartu di Hari ini" disusun dari pilihan; Tanya data: "laba bulan ini berapa?" dijawab angka dari laporan dengan tautan ke sumbernya | "Atur sekali, jalan sendiri" lalu "Tanya, dijawab dari datamu" | `/app/alur` (pembuat alur M-20), `/app/tanya` (M-22) | ketik, klik | jawaban angka terbawa ke babak 9 |
| 9 Belajar format | 4:05-4:20 | Nota dari pemasok yang sama, untuk kedua kalinya. Pertama: "Nadi sedang mempelajari format baru, sekali saja". Kedua: terbaca tanpa AI, token 0 | "Format yang sama, dibaca tanpa AI" | `/app/lempar` dengan status belajar format (**T-01**), hasil baca-berkas sumber aturan | ketik, notifikasi | whip ke babak 10 |
| 10 Satu kerangka, semua layar | 4:20-4:32 | Hari ini yang sama di 1440 (sidebar dengan Disematkan), 768 (rail), dan 390 (bilah bawah), berganti setiap 0,35 dtk; lalu tahan di HP | "Di laptop dan HP, tempatnya sama" | kerangka.tsx, cuplikan DOM `/app` pada 3 lebar | transisi ×2 (variasi) | dip cut 3 bingkai |
| 11 Kartu akhir | 4:32-4:45 | Logo Nadi di tengah dicap masuk; satu kalimat; URL; atribusi musik kecil | "Lempar berkasnya. Nadi yang merapikan" + nadi-swart.vercel.app/demo + "Musik: Rafael Krux, CC BY 4.0" | logo dari apps/web/public | sonic-logo (2 dtk), musik berakhir di bar | (akhir) |

## Pemetaan fitur wajib ke babak

| Fitur | Babak |
|---|---|
| Lempar | 2, 4, 9 |
| Feed setujui + tujuan + rincian | 0, 4 |
| Invoice + QRIS | 5 |
| Gaji | 6 |
| Mata (pelacakan jelas + peta panas) | 7 |
| Otomasi | 8 |
| Tanya data | 8 |
| Belajar format / self-improvement | 9 |
| Kerangka adaptif | 10 |
| MCP AI-mu | 3 |

## Aset dan tempatnya

| Aset (docs/promo/aset-demo) | Babak |
|---|---|
| karyawan-berantakan.xlsx | 1, 3 |
| harga-berantakan.xlsx | 3 |
| pelanggan-ganda.csv | 1, 4 |
| cctv-toko.mp4 + cctv-jawaban.json | 1, 7 |

## Prasyarat sebelum V-07

- **V-12:** Mata menggambar jejak bernomor anonim dengan garis lintasan, hitungan masuk/keluar live, dan zona menyala di perangkat. Saat ini hanya titik kunyit (hitung-kunjungan.tsx `gambarTitik`), jadi adegan 7 tidak boleh dibuat sebelum V-12 selesai.
- **T-01:** status belajar format tampil di Lempar.
- Harga pembanding di babak 1 diperiksa ulang dari halaman resminya pada hari render, lalu tanggal di layar diperbarui.
