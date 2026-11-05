# Rujukan video (V-03, V-10)

Video rujukan diunduh hanya untuk dianalisis di komputer lokal, tidak masuk repo, dan tidak dipakai ulang. Yang diambil hanya tata bahasanya (panjang potongan,
cara teks masuk, transisi, peran warna, skala huruf, suara), bukan isi, rekaman, maupun musiknya. Angka **diukur** berasal dari alat:
- ffmpeg 8.1.1: deteksi potongan `select=gt(scene,0.27)`, skor gerak per frame, `ebur128` untuk kenyaringan;
- librosa (venv lokal): tempo, onset, RMS per 5 dtk, centroid, energi di bawah 150 Hz;
- lembar kontak 1 frame per 2,5 dtk yang kulihat sendiri.

Angka **dugaan** ditandai.

## Rujukan 8: https://youtu.be/orTd3grSYsQ (vibe yang disukai Tristan: urgent, cepat, otomatis, membantu, tetap bersih)

Iklan resmi aplikasi asisten Anthropic untuk kerja sehari-hari: menganalisis Excel, lalu menyusun deck. Diunggah 5 Feb 2026, 87 dtk, 1920×1080, 24 fps.

### Gambar (diukur)

| Hal | Angka | Catatan |
|---|---|---|
| Potongan keras | 8 dalam 87 dtk | Di 3,3, 3,4, 5,1, 16,1, 26,5, 26,9, 27,4, dan 28,0 dtk. Setelah 28 dtk tidak ada potongan keras sampai kartu akhir |
| Panjang potongan rata-rata | ±10,9 dtk | Dari 87 dtk / 8 potongan. Gerak terjadi di dalam bingkai: kamera menggeser percakapan, UI mengetik dan mengisi |
| Montase cepat | 4 potongan dalam 1,5 dtk (26,5-28,0 dtk) | Kartu pengumuman versi, satu-satunya bagian yang dipotong cepat |
| Frame bergerak kuat (skor > 0,08) | 35 dari 2.089 frame (1,7%) | Hampir semua perubahan berupa gerak halus, bukan potongan |
| Rata-rata gerak per 5 dtk (skor × 100) | 2,1 di awal, lalu 0,2-1,5 | Pembuka paling padat; tengah tenang |
| Kait | 0-3 dtk | Desktop dengan folder berkas nyata dan beberapa jendela dokumen, lalu kursor besar mengeklik tombol utama |

### Gambar (dilihat di lembar kontak)

- **Satu dunia**: latar krem hangat polos sepanjang film. Satu percakapan berjalan dari atas ke bawah, dan kamera mengikuti pesan terbaru.
- **Teks besar dan satu pesan di layar**: pesan pengguna dalam gelembung sans kecil; jawaban dalam serif besar (dugaan ±3-4% tinggi frame), satu atau dua pesan terlihat sekaligus.
- **UI bekerja nyata**:
  - daftar langkah dengan centang yang terisi satu per satu ("Read ...xlsx", "Done");
  - kartu progres 5 langkah;
  - tabel Excel dengan sel merah bersyarat;
  - grafik garis;
  - deck yang tersusun.
- **Kursor besar** (dugaan ±5% lebar frame) dengan klik yang langsung menyebabkan hal berikutnya.
- **Akhir**: kamera mundur memperlihatkan dinding banyak tugas lain. Di sini prinsip "pilih satu lalu kembali ke banyak" dibalik: satu tugas utama, lalu bukti bahwa produk dipakai untuk banyak hal. Setelah itu logo tengah di latar krem.
- **Tanpa narasi**: tidak ada takarir otomatis di YouTube, dan semua kata ada di layar sebagai teks percakapan (dugaan kuat; belum dipastikan dengan transkripsi).

### Suara (diukur; aku tidak bisa mendengar, jadi ini pengukuran, bukan penilaian telinga)

| Hal | Angka |
|---|---|
| Tempo bed | ±117 BPM (librosa; kepercayaan tidak dihitung) |
| Kenyaringan terintegrasi | −28,0 LUFS, LRA 8,6 LU, puncak −5,3 dBFS |
| Onset | 4,49 per detik (391 dalam 87 dtk): tekstur rapat, cocok dengan bunyi ketik/klik halus di atas bed |
| Energi di bawah 150 Hz | 13,4% dari total: bass ringan, tetap terdengar di speaker HP |
| Centroid spektrum rata-rata | ±2.981 Hz (terang, bukan berat) |
| RMS per 5 dtk | −36 dB di 0-5 dtk, naik ke −29 dB pada 5-30 dtk, lalu turun ke −34 sampai −38 dB. Bagian paling keras ada di depan, bukan di akhir |
| Onset terkuat | 2,7, 3,1, 5,6 dtk (kait dan klik pertama), 44,6-46,7 dtk, 61,7, 67,3, 72,3 dtk, 86,0 dtk (logo) |

### Diturunkan menjadi arah nada video Nadi (**pilihan**)

| Hal | Angka untuk Nadi | Alasan |
|---|---|---|
| Struktur | Satu dunia utama: aplikasi Nadi di latar kertas, kamera mengikuti satu usaha sepanjang satu hari kerja. Potongan keras hanya di kait dan di montase "banyak fitur" | Rasa "otomatis dan membantu" datang dari UI yang terus bekerja sendiri di depan mata, bukan dari potongan cepat |
| Panjang potongan | Rata-rata 6-10 dtk per adegan; montase cepat 0,3-0,4 dtk per potongan, paling lama 2 dtk dan hanya dua kali dalam film | Rujukan ±10,9 dtk; video Nadi lebih panjang (≤ 5 menit), jadi potongan sedikit lebih rapat agar tidak terasa lambat |
| Rasa urgent | Masalah di 0-20 dtk dengan gerak paling padat (skor gerak dua kali rata-rata film), lalu tenang saat Nadi bekerja | Rujukan menaruh gerak dan bunyi terkuat di depan |
| Tempo bed | 110-124 BPM, hentakan di bar saat bab berganti | Mendekati rujukan, cukup cepat tanpa terasa iklan minuman |
| Kerapatan teks | Satu kalimat di layar pada satu waktu, ≤ 10 kata, teks produk ≥ 26 px setelah didorong; tahan 0,5 dtk + 0,3 dtk per kata | Rujukan tidak pernah menampilkan dua kalimat penjelasan bersamaan |
| Kursor | Besar (4-7% lebar frame), klik menyebabkan perubahan pada frame yang sama, tanpa cincin klik | Sama dengan rujukan dan motion.md |
| Bunyi | Ketik dan klik halus pada aksi yang terlihat; whoosh hanya di potongan; satu dentum di kartu akhir | Onset rapat rujukan berasal dari aksi UI, bukan perkusi berat |
| Kenyaringan | −14 LUFS terintegrasi, −1 dBTP (bukan −28 LUFS seperti rujukan) | Video Nadi diputar di laptop juri dan HP. Rujukan sengaja lirih untuk platform yang menormalkan. −14 LUFS sesuai V-01 |
| Akhir | Kamera mundur dari satu usaha ke dinding fitur lain (Lempar, Mata, gaji, pajak), lalu logo tengah + satu kalimat + nadi-swart.vercel.app/demo | Pola "satu tugas lalu banyak bukti" cocok untuk menunjukkan semua fitur tanpa daftar |

### Bagian yang tidak cocok untuk Nadi

- **Kartu pengumuman versi model** (montase 26-28 dtk): Nadi tidak punya rilis versi yang dirayakan. Pengganti untuk ritme yang sama: tiga jenis berkas kacau yang jatuh berurutan (foto nota, Excel berantakan, CCTV).
- **Bahasa dan kasus kantor korporat** (P&L, rantai pasok sepatu): penonton Nadi pemilik usaha kecil di Indonesia. Kasusnya diganti dengan toko, nota pemasok, dan gaji karyawan dengan rupiah sungguhan.
- **Serif besar untuk jawaban AI**: identitas Nadi memakai Plus Jakarta Sans dan Bricolage Grotesque (DIRECTION.md). Teks jawaban tetap memakai huruf aplikasi Nadi apa adanya, karena UI asli tidak boleh digambar ulang.
- **Mix −28 LUFS**: terlalu lirih untuk diputar tanpa normalisasi platform (lihat baris Kenyaringan).
- **Tanpa adegan masalah**: rujukan langsung menampilkan produk karena penontonnya sudah tahu kebutuhannya. Video Nadi wajib memperlihatkan masalah dulu (otomatis mahal dibanding manual murah, perintah Tristan), jadi bagian masalah ditambahkan di depan dengan ritme kait rujukan.

## Rujukan 1-7 (V-03)

**Cara mendengar.**
- Unduhan: yt-dlp (GitHub, terbuka), resolusi ≤ 1080p.
- Audio dijadikan WAV mono 22,05 kHz, hanya untuk dianalisis.
- Ada atau tidaknya narasi: dari takarir otomatis YouTube (yt-dlp `--write-auto-subs`), dicatat sebagai dugaan.
- Kesejajaran bunyi dengan gambar: berapa potongan yang punya onset audio dalam ±100 ms.
- Semua berkas tetap di folder sementara lokal.

### Angka diukur

| No | Video | Dtk | Potongan | Rata dtk/potongan | BPM | LUFS / LRA / puncak | Onset/dtk | < 150 Hz | Potongan berbunyi ±100 ms (median selisih) | Narasi |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | xNUx-rMGvvw: demo SaaS umpan balik karyawan (studio animasi, Feb 2025) | 98 | 11 | 8,9 | 117 | −12,3 / 7,1 / +1,1 dBFS | 2,56 | 12% | 3/11 (−79 ms) | tanpa takarir otomatis (dugaan: tanpa narasi) |
| 2 | KNAGNQeu5J8: peluncuran agen AI periklanan (Jun 2026) | 104 | 9 | 11,6 | 117 | −15,3 / 4,2 / −0,3 | 4,89 | 15% | 5/9 (+4 ms) | ada narasi (takarir otomatis) |
| 3 | k3d_xeVxEOE: film identitas merek lab AI (Feb 2025) | 110 | 45 | 2,4 | 96 | −14,9 / 14,9 / +0,3 | 2,95 | 21% | 22/45 (−7 ms) | hanya musik |
| 4 | yRc5HcGJ-Cs: peluncuran fitur kerja aplikasi chat AI (Jul 2026, 60 fps) | 100 | 11 | 9,1 | 99 | −12,9 / 7,0 / +0,6 | 5,33 | 11% | 9/11 (+8 ms) | belum pasti (takarir otomatis ada, tanpa bahasa Inggris) |
| 5 | awUYikrGsKk: peluncuran SaaS tiket dukungan (Jan 2026) | 95 | 11 | 8,7 | 108 | −9,9 / 2,1 / +0,8 | 5,92 | 22% | 11/11 (+27 ms) | hanya musik |
| 6 | pZv7me6dFns: peluncuran pembuat aplikasi AI (Jan 2026) | 53 | 12 | 4,4 | 144 | −14,7 / 3,4 / −0,1 | 5,51 | 23% | 11/12 (−2 ms) | ada narasi |
| 7 | wwIt5ZvROrs: demo fintech pembayaran (Sep 2025) | 48 | 3 | 16,0 | 99 | −12,5 / 2,3 / −0,4 | 3,61 | 16% | 2/3 (−69 ms) | tanpa takarir otomatis |

Puncak di atas 0 dBFS (video 1, 3, 4, 5) adalah puncak sampel setelah dekode AAC. Mix sekeras itu bisa terpotong setelah kompresi platform. Nadi tetap ≤ −1 dBTP.

### Dilihat di lembar kontak (36 frame per video)

1. **Tipografi kinetik di antara UI.** Kata demi kata muncul di tengah layar (Introduces, superpowers, Feedback), lalu UI melayang dimiringkan 3D di atas gradien ungu-merah muda dengan kursor besar. Struktur: kait judul → masalah tim → fitur → wawasan → logo. Unik: kata pengantar mengalir menjadi kotak isian UI ("Taylor stumbled in the client").
2. **Kolase masalah lalu agen bekerja.** Pembuka berupa tumpukan pil berkas dan tugas ("Missing creative", "Reporting") yang terlalu banyak, lalu "Meet NIVO". Sepanjang film berupa permintaan prompt → kartu hasil. Gradien biru tua, ikon 3D isometrik, kartu akhir dengan ajakan "Watch more". Unik: banyaknya tugas digambarkan sebagai pil yang menumpuk.
3. **Sistem identitas.** Latar putih, titik, garis konstruksi huruf, abjad lengkap, lalu foto alam dengan kata tersebar. Potongan rapat (45 potongan, montase 0,13-0,25 dtk di 28-30 dtk dan 43-45 dtk) di antara tahanan panjang. Unik: satu titik hitam menjadi benang merah dari frame pertama sampai logo.
4. **Satu kotak prompt yang bekerja.** Latar putih dan langit malam berbintang. Kotak "Ask anything" berisi gelombang suara, lalu logo aplikasi yang tersambung (surel, lembar kerja) dengan status "Searching for suppliers", lalu dokumen jadi, grafik penjualan, dan versi HP. Unik: status kerja agen ditulis sebagai kalimat abu-abu yang berganti.
5. **Masalah diketik lalu dihapus.** "The same issue, | Different channels" diketik di tengah dengan sorotan biru. Setelah itu tiket diselesaikan sendiri, alur kerja diedit langkah demi langkah, kata kunci dalam kurung ("{ learning }", "[ Reusable knowledge ]"). Mix paling keras (−9,9 LUFS, LRA 2,1): musik dipadatkan rata.
6. **Dunia nyata dicampur UI.** Bayangan daun di dinding beton, HP dan laptop di tangan, kode yang bergulir, lalu hasil produk. Narasi dengan tempo 144 BPM, potongan rata-rata 4,4 dtk. Unik: kotak prompt melayang di atas foto ruang nyata.
7. **Paling dekat dengan Nadi.** "Still manually entering payment details|" diketik, ditambah tumpukan invoice. Lalu kirim email, AI mengekstrak bidang invoice dengan bingkai pindai, draf pembayaran, persetujuan dua orang (centang hijau), "Payment approved", dan "Save time. Avoid errors. Stay in control". Hanya 3 potongan keras dalam 48 dtk; semuanya gerak kamera di dalam satu panggung.

### Pola lintas 8 rujukan (diturunkan untuk V-06)

- **Kenyaringan.** 6 dari 8 berada di −12 sampai −15,3 LUFS. Hanya rujukan 8 yang lirih (−28 LUFS) dan rujukan 5 yang sangat keras (−9,9 LUFS). Target Nadi −14 LUFS berada di tengah praktik ini.
- **Bunyi di potongan.** Rata-rata 69 dari 110 potongan yang terukur (63%) punya onset dalam ±100 ms, dengan median selisih kebanyakan −7 sampai +27 ms. Film yang dibuat rapi (4, 5, 6) mencapai 82-100%. Untuk Nadi: setiap potongan dan klik yang terlihat punya bunyi, puncaknya 0-40 ms setelah gambar (sesuai sound.md: satu frame sesudah).
- **Potongan.** 6 dari 8 memakai potongan keras jarang (rata-rata 8,7-16 dtk), dengan gerak di dalam bingkai. Montase cepat hanya sebagai aksen. Ini mengukuhkan arah nada di rujukan 8.
- **Masalah dulu, dengan kata yang diketik.** Rujukan 2, 5, dan 7 membuka dengan masalah yang terlihat ("Still manually entering...", "The same issue, different channels"). Pola ini cocok untuk perintah Tristan: otomatis mahal dibanding manual murah.
- **Status kerja AI sebagai kalimat yang berganti** (2, 4, 5, 8): "Searching for suppliers", "Reviewing scorecards". Padanan Nadi yang sudah ada di UI asli: status Lempar "Membaca...", "Siap ditinjau" dan rincian usulan.
- **Narasi bukan syarat.** 4 dari 8 tanpa narasi (dugaan untuk 1 dan 7). Teks di layar dan teks produk cukup. V-06 memutuskan apakah Nadi memakai narasi.

### Yang tidak dipakai untuk Nadi, dan alasannya

- Gradien ungu, biru tua, dan merah muda di rujukan 1, 2, 5, 6, 7: dilarang ANTI-SLOP S01-S02. Nadi memakai kertas, tinta, dan kunyit.
- UI dimiringkan 3D dan ikon kaca isometrik (1, 2, 5, 7): ditolak launch.md karena produk harus tampil apa adanya dan terbaca.
- Kata kunci dalam kurung dan sorotan biru seperti kode (5): tidak sesuai VOICE.md, yang memakai bahasa sehari-hari.
- Mix −9,9 LUFS yang dipadatkan rata (5): terlalu melelahkan untuk video 5 menit.
- Tipografi berukuran raksasa yang menutupi UI (1, 3): judul video Nadi 4-9% tinggi frame dan UI tetap utama.
