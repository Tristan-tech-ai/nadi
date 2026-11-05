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

## Rujukan 1-7

Diisi V-03.
