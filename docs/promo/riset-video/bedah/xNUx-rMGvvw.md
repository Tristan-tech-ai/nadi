# Bedah rujukan 1: xNUx-rMGvvw (Teamble, buatan studio Zelios)

Dibedah 6 Nov 2026 (V-13B) dengan cara yang sama seperti rujukan 8. Gambar analisis ada di scratchpad (bedah/r1):
- 26 lembar 6,25 bingkai/dtk;
- grafik gerak dan kurva easing;
- stem demucs dan jendela spektrogram per kejadian.

## Metadata

| Hal | Nilai |
|---|---|
| Durasi | 98 dtk, 1920×1080, 25 fps, VP9 |
| Suara | Opus, −17,6 LUFS terintegrasi, LRA 6,5 LU, puncak −0,6 dBFS |
| Kanal | studio animasi (portofolio), unggah 25 Feb 2025, ±333 rb tonton |
| Jenis | film produk animasi: UI dibangun ulang sebagai vektor bersih, bukan rekaman layar |

## Struktur

Potongan terdeteksi: 7,0, 9,8, 11,9, 14,2, 15,0, 17,2, 22,4, 26,1, 34,9, 38,9, 48,2, 57,4, 64,4, 67,9, 76,1, 88,6 dtk. Sebagian besar perpindahan bukan potongan, melainkan elemen yang berubah menjadi elemen berikutnya.

| Waktu | Isi | Teknik |
|---|---|---|
| 0-3,0 | logo muncul huruf per huruf dengan cahaya ungu, lalu tagline bergradien | ketik dengan blur-masuk per huruf (±2 bingkai per huruf) |
| 3,2-6,9 | "Introduces teamble ai" diketik dengan kursor teks di atas garis cakrawala bercahaya; kotak pil mengecil membungkus kata | ketik + bentuk yang mengecil ke isi |
| 7,0-12,0 | tipografi kinetik raksasa ("Give your team superpowers", "Help them unlock their potential"); kamera menggeser horizontal mengikuti kata baru; kursor mengeklik kata "superpowers" lalu kata itu berganti warna | geser kamera mengikuti teks, klik pada kata |
| 12,5-15,0 | cincin pil konsentris; angka "2x" menghitung naik sampai "10x better", lalu berganti ke kata "Feedback" | penghitung angka, bentuk berlapis |
| 15,0-17,2 | kartu notifikasi produk, kursor tangan menekan "Prepare" | potongan ke kartu |
| 17,2-19,0 | **bidang UI dimiringkan 3D dan berputar masuk sampai rata**; panel ikut menyusun diri (target, survei, asisten AI) | rotasi perspektif + tarik mundur 0,74× dalam 45 bingkai, ease-out (puncak di 9%) |
| 20,9-22,2 | kamera **menggeser dan mendorong 1,39× ke tombol "Help me craft feedback"** dalam 32 bingkai (ease-out) | geser + zoom ke titik klik |
| 22,5-24,5 | kalimat keterangan per kata di atas modal ("Even a simple observation"); teks umpan balik diketik | keterangan kinetik + ketik |
| 24,4-26,0 | **sekeliling meredup dan memudar, hanya tombol yang tersisa lalu membesar** | isolasi fokus |
| 26,1-27,5 | "Generating…" di atas gradien, ikon logo berubah bentuk | keadaan memuat bermerek |
| 27,5-34,8 | sebelum dan sesudah: skor umpan balik **menghitung naik 0→10**; kartu dimiringkan 3D; kata pengapit di kiri-kanan kartu ("Turns … into", "10x better … feedback"); persentase per kriteria menghitung naik | penghitung + kata pengapit |
| 34,8-39,0 | kartu skor bergeser naik dan berganti ke panel pertanyaan; skor 10→24 | geser vertikal 291 px, 15 bingkai, ease-out |
| 39-48 | tipografi kinetik ("Teamble AI helps your managers go from just managing to truly coaching"); kartu umpan balik awal vs kartu yang diperkaya AI; **skor menghitung 10→92/100** sambil kartu digulir | penghitung sebagai bukti |
| 48,2-51,8 | kartu bab gelap dengan gumpalan gradien ("Unlock actionable insights with teamble ai") | judul bab |
| 51,8-55,5 | dasbor naik dari bawah dengan kemiringan perspektif; kata keterangan memantul satu per satu | perspektif + teks memantul |
| 55,8-56,4 | dasbor meredup; satu kartu "360 Review Campaign" **terangkat keluar dari halaman**, kamera dorong 2,4× dalam 15 bingkai | angkat elemen + zoom |
| 57,4-64,0 | kartu skor; klik "Actionability"; panel tema spesifik mengalir | klik menyebabkan isi baru |
| 64,0-64,8 | **transisi fokus**: kartu membesar 1,44× sambil buram dan gelap, tombol "Share it" muncul tajam | buram kedalaman |
| 64,8-67,9 | tombol "Share it" **berubah bentuk** menjadi pemilih avatar, lalu dipilih, lalu menjadi lingkaran centang, lalu menyusut menjadi titik | morph satu elemen ke elemen berikutnya |
| 68-73 | judul bermerek + kalimat kinetik ("uncovers hidden trends before they become challenges") | tipografi |
| 73-79 | logo membesar, lalu menjadi kartu notifikasi, lalu orbit avatar di sekitar "Onboarding Survey", lalu kartu kutipan bertebaran | morph + orbit |
| 82,6-88,6 | tabel insight; satu baris "Operations" **diangkat dari tabel yang diredupkan** menjadi pil sendiri, lalu pembanding "Benchmarks" masuk di sampingnya | isolasi baris |
| 88,6-94,0 | kutipan menumpuk masuk, tombol "Create report" diklik, menyusut ke titik, lalu centang | morph |
| 94,0-98,0 | logo masuk dengan buram gerak dan tagline, tahan ±3 dtk | penutup |

## Gerak kamera (terukur)

| Jendela | Gerak | Besar | Durasi | Kurva |
|---|---|---|---|---|
| 17,2 | rotasi 3D masuk + tarik mundur | 0,74× | 45 bingkai | ease-out cubic (puncak di 9%) |
| 20,9 | geser + dorong ke tombol | 1,39×, −803/−626 px | 32 bingkai | ease-out cubic (puncak di 16%) |
| 34,8 | geser vertikal | 291 px | 15 bingkai | ease-out |
| 55,8 | dorong ke kartu terangkat | 2,42× | 15 bingkai | ease-out |
| 64,0 | dorong buram ke tombol | 1,44× | 20 bingkai | ease-out quint/cubic |

Batas pengukuran: pengukur kemiringan perspektif pada 52-54 dtk tidak andal, karena transformasi similaritas tidak bisa mengukur perspektif. Hasilnya tidak dipakai.

Polanya:
- Hampir semua gerak memakai **ease-out** dengan puncak kecepatan di 10-30% awal: datang cepat, mendarat pelan.
- Kemiringan 3D hanya dipakai saat UI masuk, lalu langsung diratakan untuk dibaca.

## Cara UI direkonstruksi

- **UI digambar ulang sebagai vektor sederhana:**
  - teks UI kecil, sebagian hanya garis abu sebagai pengganti teks;
  - hanya satu bagian yang perlu dibaca yang ditulis penuh.
- **Setiap komponen lapisan sendiri:** kartu, tombol, baris tabel, skor, dan avatar bisa diangkat, dibesarkan, diredupkan, dan diubah bentuknya.
- **Teknik yang berulang:**
  - isolasi fokus: sekeliling meredup atau buram, satu elemen tajam dan membesar;
  - angkat elemen keluar dari halaman;
  - morph tombol menjadi elemen berikutnya;
  - penghitung angka sebagai bukti hasil;
  - kursor tangan besar yang mengeklik.

## Bunyi (dibaca dari sinyal dan stem, bukan telinga)

- **Musik:**
  - elektronik ceria ±115 BPM dengan ketukan kick rata (stem drums, hentakan tiap ±0,52 dtk), bass panjang;
  - mix keras dan rapat: −17,6 LUFS, puncak −0,6 dBFS.
- **Bagian musik mengikuti bab:**
  - musik berhenti sebentar sekitar 1,7-2,5 dtk setelah logo, lalu masuk lagi;
  - ±25 dtk jatuh sebelum "Generating";
  - ±51 dtk kosong sesaat di kartu bab;
  - ±76-82 dtk bagian lebih tipis;
  - ±93-94 dtk isian drum cepat sebelum logo.
- **Aksen bernada di titik penting** (stem vocals berisi potongan synth/vokal bernada):
  - 17,2-18 dtk saat bidang UI 3D masuk;
  - 25,2-27 dtk saat "Generating";
  - 64-65 dtk saat transisi fokus "Share it";
  - 93-95 dtk penutup.
  - Ini cara menandai momen tanpa efek UI terpisah.
- **Sapuan menurun** (stem other 7-8,5 dtk): whoosh bernada yang turun mengikuti tipografi kinetik. Ada desis naik di bawah logo pembuka.
- **Efek klik UI tunggal hampir tidak terlihat terpisah dari musik.** Desain suaranya terutama dari musik dan aksen bernada, bukan foley UI.

## 5 hal yang layak ditiru Nadi

1. **Isolasi fokus.** Sekeliling diredupkan atau dibuat buram, lalu satu kartu usulan atau satu baris tabel diangkat keluar dan membesar. Gerak keluar dengan dorong 1,4-2,4× dalam 15-20 bingkai, ease-out.
2. **Morph satu elemen ke elemen berikutnya.** Contoh: tombol Setujui menjadi cap DISETUJUI, lalu centang, lalu titik yang membuka babak berikutnya.
3. **Penghitung angka sebagai bukti.** Contoh: token 600 turun ke 0 pada struk keempat, kunjungan 0 naik ke 11, lama kerja manual 2 jam turun ke 2 menit. Penghitung hanya dipakai bila angkanya nyata.
4. **Kata pengapit di kiri-kanan UI** (ukuran kecil, warna tinta kedua) sebagai pengganti narasi, dibaca bersama UI.
5. **Aksen musik bernada di titik penting**, bukan efek klik di setiap gerak.

## 3 hal yang tidak ditiru

1. **Gumpalan gradien ungu-merah muda dan latar gelap bercahaya.** Ini persis yang dilarang ANTI-SLOP S01-S03, dan Nadi memakai kertas, tinta, dan kunyit.
2. **Rotasi 3D yang sering.** DIRECTION melarang UI dimiringkan 3D. Paling banyak satu kali, atau tidak sama sekali.
3. **Tipografi kinetik pemasaran panjang** ("superpowers", "10x better"). Klaim angka tanpa sumber melanggar S34; Nadi hanya memakai angka dari data nyata.
