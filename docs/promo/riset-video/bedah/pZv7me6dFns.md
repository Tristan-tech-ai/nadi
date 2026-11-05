# Bedah rujukan 6: pZv7me6dFns (pembuat aplikasi dengan AI, buatan studio Zelios)

Dibedah 6 Nov 2026 (V-13G). Gambar analisis ada di scratchpad (bedah/r6):
- 13 lembar 6 bingkai/dtk;
- grafik gerak dan kurva;
- stem demucs dan jendela spektrogram.

Transkrip diambil dari takarir otomatis YouTube.

## Metadata

| Hal | Nilai |
|---|---|
| Durasi | 53 dtk, 1920×1080, 30 fps, AV1 |
| Suara | Opus, −17,8 LUFS terintegrasi, LRA 3,5 LU, puncak −0,5 dBFS |
| Kanal | studio animasi (portofolio), unggah 9 Jan 2026, ±140 rb tonton |
| Narasi | **ada**: suara narator yang hangat, satu kalimat per adegan ("What if building software felt as effortless as having an idea? … So, what will you create today?"); stem vocals terkeras (−19,5 dBFS rms) |

## Struktur

Ciri utamanya: **satu latar foto nyata yang tenang** (tembok beton dengan bayangan daun dan tanaman) dipakai sebagai "meja" untuk UI kaca, bergantian dengan latar biru tua bercahaya.

| Waktu | Isi | Teknik |
|---|---|---|
| 0-1,0 | bintang kecil di latar gelap berubah menjadi bunga logo | logo sebagai benih |
| 1,0-1,8 | **bunga logo menjadi lubang topeng** yang membesar 3,9× dalam 23 bingkai (ease-out) dan membuka foto tembok berbayang daun | transisi topeng berbentuk logo |
| 1,8-3,5 | tombol kaca bulat muncul di foto; ikon "+" lalu pil "Public" mengembang | komponen UI berdiri sendiri di dunia nyata |
| 3,5-5,3 | **tarik mundur 0,74× dalam 53 bingkai (ease-out expo)**: tombol ternyata bagian kotak tanya "Build something lovio" | dari detail ke komponen utuh |
| 5,3-6,3 | sangat dekat ke kotak, "I have an idea" diketik; kata "idea" tertinggal dan memudar ke latar gelap | ketik, lalu kata dibawa ke adegan berikutnya |
| 6,3-9,4 | "idea" di atas latar biru-ungu yang mengalir, lalu bunga logo, lalu "lovio" | judul produk |
| 9,4-11,0 | laptop di ruang studio terang, situs produk di layar; **tarik mundur 0,51× dalam 48 bingkai (ease-out expo, galat 0,02: sangat cocok)** | UI di perangkat nyata |
| 11,0-12,8 | ponsel di tangan sungguhan dengan percakapan di layarnya | foto nyata + UI |
| 12,8-14,4 | jendela "Spinning up preview" di bidang biru | |
| 14,4-15,0 | orang sungguhan mengetik di laptop | foto orang |
| 15,0-16,6 | kotak tanya meluncur masuk dari kiri sambil orang tetap terlihat; "Build a web app marketplace with user accounts and payments" diketik; kursor menekan kirim | **UI di samping foto orang** |
| 16,6-18,0 | kotak tanya menjadi kartu "Generating response…" dengan bilah progres yang **menghitung 1%→73%** | progres angka |
| 18,0-20,0 | jendela editor kode; kamera dorong ke berkas yang terisi baris demi baris | |
| 20,0-23,9 | **dinding hasil**: bentuk kosong biru berubah satu per satu menjadi kartu produk, landing page, dasbor; satu kartu ("Professional Gradients") membesar penuh layar lalu kembali ke dinding yang makin padat | dinding contoh nyata |
| 24,0-27,0 | halaman produk hijau di layar laptop, tarik mundur sampai laptop di meja gelap | |
| 26,7-28,0 | kata pengapit "Beautifully … designed" mengapit laptop yang mengecil | kata pengapit |
| 28,0-29,8 | huruf "ready to launch" muncul acak per huruf | ketik acak |
| 29,8-30,6 | huruf "ready" dan "to launch" terdorong ke samping oleh bilah alat (Share, Upgrade, Publish) yang mengembang di antaranya | kata berubah menjadi UI |
| 30,6-35,8 | kembali ke foto tembok; editor kaca dengan obrolan "Include a filter bar above the Campaigns Table"; kode berubah; "in any direction" | |
| 35,8-38,4 | kartu menyusut menjadi bintang; "What starts as an idea" | |
| 38,4-41,5 | laptop muncul, kamera dorong ke kartu produk (1,88× dalam 35 bingkai, ease-in), kursor menekan "Share" | |
| 41,5-45,3 | kembali ke foto tembok: deretan kartu hasil bergeser horizontal; satu kartu diapit kurung kurawal `{ }` raksasa lalu diganti kartu berikutnya | kurung sebagai bingkai pilihan |
| 45,3-47,5 | kotak kaca memudar, "More about what's next" | |
| 47,5-49,4 | "What will you create today" di atas cahaya biru | |
| 49,4-53,0 | bunga 3D berputar, menyusut ke logo, lalu "lovio" | penutup |

## Gerak kamera (terukur)

| Jendela | Gerak | Besar | Durasi | Kurva |
|---|---|---|---|---|
| 1,0 | topeng logo membuka | 3,87× | 23 bingkai | ease-out cubic |
| 3,5 | tarik mundur | 0,74× | 53 bingkai | ease-out expo |
| 9,4 | tarik mundur | 0,51× | 48 bingkai | **ease-out expo** (galat 0,019, paling bersih dari semua pengukuran) |
| 12,8 | tarik mundur | 0,66× | 48 bingkai | linear sampai potongan |
| 18,6 | geser | 676 px | 40 bingkai | ease-out expo |
| 25,5 | tarik mundur | 0,40× | 45 bingkai | mempercepat (linear/ease-in) sampai potongan |
| 30,6 | tarik mundur | 0,74× | 40 bingkai | ease-out cubic |
| 38,5 | dorong | 1,88× | 35 bingkai | ease-in (mempercepat) |

Polanya:
- **Tarik mundur ease-out expo ±1,5 dtk adalah tanda tangan film ini**: mulai sangat cepat, lalu melambat lama sebelum diam.
- Gerak yang berakhir di potongan memakai kurva linear atau mempercepat, supaya momentum terbawa ke adegan berikutnya.

## Bunyi (dibaca dari sinyal dan stem)

- **Mix:**
  - narasi di depan, vocals −19,5 dBFS rms;
  - bass kuat (−20) dan drum lebih lirih (−27,5);
  - mix −17,8 LUFS dengan LRA 3,5: rapat, narasi dan musik dipadatkan.
- **Tempo:** ±140 BPM menurut pembaca tempo, tetapi drum di jendela 14-21 dtk berjarak ±0,43 dtk, jadi ketukan nyatanya kemungkinan ±70 BPM ganda (alas santai).
- **Struktur musik mengikuti cerita:**
  - 0-2,3 dtk: hanya pad dan dengung (stem other), tanpa drum, saat logo menjadi topeng;
  - ±2,3 dtk: narasi masuk;
  - ±5-8 dtk: drum hampir diam (−57 dBFS) saat "idea" dan logo;
  - ±14 dtk: drum dan bass masuk penuh saat orang mengetik;
  - ±28,5-29,6 dtk: drum berhenti, lalu masuk lagi tepat saat bilah alat Publish muncul (29,7 dtk);
  - ±50 dtk: drum terakhir, lalu pad memudar di logo.
- **Efek suara:** tidak tampak efek UI terpisah yang menonjol. Penekanan dibuat dengan masuk-keluarnya drum di titik cerita.

## 5 hal yang layak ditiru Nadi

1. **Tarik mundur ease-out expo ±48-53 bingkai** dari satu komponen (tombol Lempar, kartu usulan) ke layar utuh. Ini kurva yang paling bersih terukur di semua rujukan.
2. **Satu latar dunia nyata yang tenang dan hangat** sebagai panggung UI. Untuk Nadi, foto nyata berlisensi bebas: meja kasir warung dengan cahaya pagi atau buku kas di meja, dipakai sangat redup di belakang kertas Nadi. Ini juga bisa menjadi jalan keluar untuk adegan CCTV asli.
3. **Komponen UI muncul dulu sendirian, lalu ternyata bagian dari layar utuh** (tombol, lalu kotak tanya, lalu halaman). Penonton belajar komponennya sebelum melihat layar penuh.
4. **Kata yang tertinggal dari adegan sebelumnya**, misalnya "idea" tetap di layar saat dunia berganti. Contoh untuk Nadi: kata "nota" dari kalimat masalah tetap ada saat nota asli jatuh ke Lempar.
5. **Drum berhenti dan masuk lagi tepat saat aksi kunci terlihat** (Publish 29,7 dtk). Penekanannya dari aransemen, bukan efek klik.

## 3 hal yang tidak ditiru

1. **Latar biru-ungu bercahaya, bunga 3D, dan kaca buram.** Ini dilarang ANTI-SLOP S01-S03.
2. **Narasi dan mix yang dipadatkan rata.** Nadi tanpa narasi.
3. **Dinding hasil yang berisi produk orang lain (contoh Apple Vision di layar).** Nadi hanya memperlihatkan layar Nadi sendiri dan data sintetis.
