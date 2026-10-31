# Jadwal shift (F3-06): batas jam kerja yang dipakai dan yang belum diverifikasi

Ditulis 1 Nov 2026. Sumber utama PP 35 Tahun 2021 (https://peraturan.bpk.go.id/Download/154582/PP%20Nomor%2035%20Tahun%202021.pdf), kutipan pasal sudah dicek di docs/research/gaji.md bagian lembur (31 Okt 2026).

## Sudah terverifikasi (kutipan di docs/research/gaji.md)
- **Pasal 21 ayat (2):** waktu kerja 7 jam sehari dan 40 jam seminggu untuk pola 6 hari kerja, atau 8 jam sehari dan 40 jam seminggu untuk pola 5 hari kerja.
- **Pasal 26:** lembur paling lama 4 jam sehari dan 18 jam seminggu, tidak termasuk lembur di hari istirahat mingguan atau hari libur resmi.
- Jam di atas jadwal dihitung sebagai lembur (tabel public.lembur, RPC catat_lembur, F1-05B), jadi pembuat jadwal tidak perlu menghitung ulang upahnya.

## Diverifikasi 1 Nov 2026 dari teks resmi
Sumber: PP 35/2021 (tautan di atas, PDF hlm 14-17) dan UU 6/2023 Penetapan Perppu 2/2022 Cipta Kerja, https://peraturan.bpk.go.id/Download/302681/UU%20Nomor%206%20Tahun%202023.pdf (1126 halaman; bagian Ketenagakerjaan angka 23-25 mengubah Pasal 77-79 UU 13/2003). Diakses 1 Nov 2026.
- **PP 35/2021 Pasal 21 ayat (3)-(4):** "Ketentuan waktu kerja sebagaimana dimaksud pada ayat (2) tidak berlaku bagi sektor usaha atau pekerjaan tertentu." "Pelaksanaan jam kerja bagi Pekerja/Buruh di Perusahaan diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama."
- **PP 35/2021 Pasal 22:** istirahat mingguan "a. ... 1 (satu) hari untuk 6 (enam) hari kerja dalam 1 (satu) minggu; atau b. ... 2 (dua) hari untuk 5 (lima) hari kerja dalam 1 (satu) minggu."
- **PP 35/2021 Pasal 23 dan Penjelasan ayat (3):** sektor yang boleh lebih dari ketentuan "antara lain usaha energi dan sumber daya mineral pada daerah tertentu, sektor usaha pertambangan umum ..., kegiatan usaha hulu minyak dan gas bumi, sektor agribisnis hortikultura, dan sektor perikanan pada daerah operasi tertentu". F&B dan toko TIDAK disebut, jadi Nadi memakai ketentuan umum untuk paket fnb/toko. Waktu kerja kurang dari ketentuan (Pasal 23 ayat (2)): kurang dari 7 jam sehari dan 35 jam seminggu, waktu kerja fleksibel, atau kerja di luar lokasi.
- **UU 13/2003 Pasal 78 ayat (1) (diubah UU 6/2023 angka 24):** lembur butuh "a. ada persetujuan Pekerja/Buruh yang bersangkutan; dan b. ... paling lama 4 (empat) jam dalam 1 (satu) hari dan 18 (delapan belas) jam dalam 1 (satu) minggu."
- **UU 13/2003 Pasal 79 ayat (2)-(3) (diubah UU 6/2023 angka 25):** "a. istirahat antara jam kerja, paling sedikit setengah jam setelah bekerja selama 4 (empat) jam terus-menerus, dan waktu istirahat tersebut tidak termasuk jam kerja; dan b. istirahat mingguan 1 (satu) hari untuk 6 (enam) hari kerja dalam 1 (satu) minggu." Ayat (3): "cuti tahunan, paling sedikit 12 (dua belas) hari kerja setelah Pekerja/Buruh yang bersangkutan bekerja selama 12 (dua belas) bulan secara terus menerus."

Catatan: UU hanya menyebut istirahat mingguan untuk pola 6 hari; pola 5 hari (2 hari) datang dari PP 35/2021 Pasal 22. Angka cuti 12 hari kini terverifikasi; keputusan izin otopilot (DECISIONS 31 Okt: "angka 12 hari belum terverifikasi") boleh menawarkan 12 hari sebagai saran jatah bawaan setelah 12 bulan bekerja, tetap bisa diubah pemilik.

## Shift malam (diverifikasi 1 Nov 2026)
Sumber: UU 13/2003, https://peraturan.bpk.go.id/Download/31128/UU%20Nomor%2013%20Tahun%202003.pdf (PDF hlm 30-31). Bagian Ketenagakerjaan UU 6/2023 mengubah Pasal 77, 78, 79 tetapi tidak menyebut Pasal 76, jadi teks asli berlaku.
- **Pasal 76 ayat (1):** "Pekerja/buruh perempuan yang berumur kurang dari 18 (delapan belas) tahun dilarang dipekerjakan antara pukul 23.00 sampai dengan pukul 07.00."
- **Ayat (2):** larangan untuk pekerja perempuan hamil "yang menurut keterangan dokter berbahaya bagi kesehatan dan keselamatan kandungannya maupun dirinya" pada jam yang sama.
- **Ayat (3):** pengusaha yang mempekerjakan pekerja perempuan pukul 23.00-07.00 wajib "a. memberikan makanan dan minuman bergizi; dan b. menjaga kesusilaan dan keamanan selama di tempat kerja."
- **Ayat (4):** wajib menyediakan angkutan antar jemput bagi pekerja perempuan yang berangkat dan pulang antara pukul 23.00 sampai 05.00.

Keputusan untuk Nadi:
- Nadi tidak menyimpan jenis kelamin atau kehamilan karyawan hanya untuk jadwal (data sensitif, prinsip minimisasi). Karena itu Nadi tidak bisa dan tidak boleh menebak siapa yang terkena ayat (1)-(4).
- Yang bisa dijaga tanpa data sensitif: umur dari tanggal lahir (bila diisi). Karena larangan ayat (1) hanya untuk perempuan dan Nadi tidak menyimpan jenis kelamin, shift 23.00-07.00 untuk orang berumur < 18 tahun tidak diblokir, tetapi diberi peringatan: "Pekerja perempuan di bawah 18 tahun dilarang bekerja pukul 23.00-07.00 (UU 13/2003 Pasal 76)."
- Setiap shift yang menyentuh 23.00-07.00 memunculkan pengingat umum untuk pemilik: kewajiban makanan bergizi, keamanan, dan antar jemput (23.00-05.00) bila pekerjanya perempuan. Pengingat, bukan pemeriksaan.
- Pekerja anak (di bawah 18 tahun secara umum) punya aturan lain di UU 13/2003 Pasal 68-75 yang belum dibaca; jangan dibuat aturan sampai dibaca.

## Dampak untuk desain
- Jadwal disimpan per orang per hari dengan pola usaha (5 atau 6 hari). Peringatan keras hanya untuk yang terverifikasi: jadwal biasa lebih dari 7 atau 8 jam sehari, atau lebih dari 40 jam seminggu, ditandai "selebihnya dihitung lembur" dan lembur di atas 4 jam/18 jam ditolak sama seperti catat_lembur.
- Shift yang memotong tengah malam disimpan sebagai satu shift dengan tanggal mulai; jam dihitung di zona waktu usaha (WITA/WIB/WIT), bukan UTC, karena "sehari" dalam pasal mengikuti hari kerja setempat.
- Jadwal menjadi masukan "jam jadwal" untuk Pembagi kerja adil (docs/design/bagi-adil.md).

## Aturan jadwal yang boleh ditegakkan Nadi (semua terverifikasi)
- Jadwal biasa > 7 jam/hari (pola 6 hari) atau > 8 jam/hari (pola 5 hari) atau > 40 jam/minggu: selebihnya lembur, butuh persetujuan pekerja (tombol setuju di HP staf) dan masuk batas 4/18 jam.
- Shift > 4 jam terus-menerus tanpa istirahat >= 30 menit: peringatan "Beri istirahat minimal 30 menit; istirahat tidak dihitung jam kerja."
- Kurang dari 1 hari libur (pola 6 hari) atau 2 hari (pola 5 hari) dalam seminggu: peringatan.
- Pengecualian: usaha boleh menandai diri "waktu kerja diatur PK/PP/PKB" (Pasal 21 ayat (4)); peringatan tetap tampil tetapi tidak memblokir.
