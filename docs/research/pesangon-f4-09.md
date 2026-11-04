# Dana cadangan pesangon (F4-09)

Ditulis 1 Nov 2026. Kriteria antrean: "perhitungan per karyawan dengan sumber; bertanda belum final". Tujuan: pemilik UMKM tahu berapa kewajiban yang menumpuk bila suatu saat harus memutus hubungan kerja, dan bisa menyisihkannya pelan-pelan. Ini perencanaan kas, bukan perhitungan PHK yang mengikat.

## Sumber (dibaca 1 Nov 2026)
- PP 35/2021 Pasal 40, https://peraturan.bpk.go.id/Download/154582/PP%20Nomor%2035%20Tahun%202021.pdf (PDF hlm 25-27).
- UU 6/2023 angka 48 (Pasal 157 UU 13/2003 diubah), https://peraturan.bpk.go.id/Download/302681/UU%20Nomor%206%20Tahun%202023.pdf (hlm 564).

## Kutipan
**Pasal 40 ayat (1):** "Dalam hal terjadi Pemutusan Hubungan Kerja, Pengusaha wajib membayar uang pesangon dan/atau uang penghargaan masa kerja, dan uang penggantian hak yang seharusnya diterima."

**Ayat (2), uang pesangon** (masa kerja -> bulan upah): < 1 th: 1; 1 sampai < 2: 2; 2 sampai < 3: 3; 3 sampai < 4: 4; 4 sampai < 5: 5; 5 sampai < 6: 6; 6 sampai < 7: 7; 7 sampai < 8: 8; >= 8 th: 9.

**Ayat (3), uang penghargaan masa kerja (UPMK):** 3 sampai < 6 th: 2; 6 sampai < 9: 3; 9 sampai < 12: 4; 12 sampai < 15: 5; 15 sampai < 18: 6; 18 sampai < 21: 7; 21 sampai < 24: 8; >= 24 th: 10 bulan upah.

**Pasal 157 ayat (1)-(2) (UU 6/2023):** dasar upah = "a. Upah pokok; dan b. tunjangan tetap yang diberikan kepada Pekerja/Buruh dan keluarganya." Upah harian: "Upah sebulan sama dengan 30 (tiga puluh) dikalikan Upah sehari." Ayat (3)-(4): upah satuan hasil = rata-rata 12 bulan terakhir, tidak boleh di bawah upah minimum.

## Kenapa "belum final"
Besaran yang benar-benar dibayar bergantung pada ALASAN PHK. PP 35/2021 Pasal 41 dan seterusnya memberi pengali berbeda per alasan; contoh yang sudah dibaca: Pasal 41 (penggabungan/peleburan, pekerja tidak bersedia melanjutkan) = 1 kali ayat (2) + 1 kali ayat (3) + uang penggantian hak. Alasan lain (efisiensi, pailit, pensiun, meninggal, mangkir, resign) punya pengali sendiri; resign tidak mendapat pesangon (Pasal 50, lihat docs/research/serah-terima.md). Pengali per alasan Pasal 41-57 ada di tabel di bawah; karena alasan PHK tidak diketahui sebelumnya, Nadi menampilkan **skenario dasar 1 kali** (ayat (2) + ayat (3)) dengan rentangnya, dan menandainya.

Pembaruan regulasi setelah UU 6/2023 (mis. putusan Mahkamah Konstitusi tentang klaster ketenagakerjaan dan undang-undang ketenagakerjaan baru yang sedang dibahas) belum diperiksa. Karena itu setiap angka di layar membawa label "perkiraan, belum final" dan tanggal aturan yang dipakai; aturan disimpan di aturan_bertanggal (kunci `pesangon.pp35`) dengan `terverifikasi=true` hanya untuk tabel ayat (2) dan (3) yang kutipannya ada di atas.

## Pengali per alasan PHK (PP 35/2021 Pasal 41-57, dibaca 1 Nov 2026)
Pesangon = pengali x tabel ayat (2); UPMK = pengali x tabel ayat (3); uang penggantian hak (ayat (4)) selalu ada kecuali disebut lain.

| Pasal | Alasan | Pesangon | UPMK |
|---|---|---|---|
| 41 | penggabungan, peleburan, pemisahan; pekerja/pengusaha tidak mau melanjutkan | 1 | 1 |
| 42 ayat (1) | pengambilalihan perusahaan | 1 | 1 |
| 42 ayat (2) | pengambilalihan yang mengubah syarat kerja dan pekerja tidak bersedia melanjutkan | 0,5 | 1 |
| 43 ayat (1) | efisiensi karena perusahaan rugi | 0,5 | 1 |
| 43 ayat (2) | efisiensi untuk mencegah kerugian | 1 | 1 |
| 44 ayat (1) | tutup karena rugi 2 tahun | 0,5 | 1 |
| 44 ayat (2) | tutup bukan karena rugi | 1 | 1 |
| 45 ayat (1) | tutup karena keadaan memaksa | 0,5 | 1 |
| 45 ayat (2) | keadaan memaksa yang tidak membuat tutup | 0,75 | 1 |
| 46 ayat (1) | PKPU karena rugi | 0,5 | 1 |
| 46 ayat (2) | PKPU bukan karena rugi | 1 | 1 |
| 47 | pailit | 0,5 | 1 |
| 48 | permohonan pekerja karena pengusaha melakukan perbuatan Pasal 36 huruf g | 1 | 1 |
| 49 | putusan menyatakan pengusaha tidak melakukan perbuatan itu | 0 (penggantian hak + uang pisah) | 0 |
| 50 | mengundurkan diri | 0 (penggantian hak + uang pisah) | 0 |
| 51 | mangkir 5 hari kerja berturut-turut, dipanggil 2 kali | 0 (penggantian hak + uang pisah) | 0 |
| 52 ayat (1) | pelanggaran PK/PP/PKB setelah SP 1, 2, 3 | 0,5 | 1 |
| 52 ayat (2) | pelanggaran bersifat mendesak | 0 (penggantian hak + uang pisah) | 0 |
| 54 ayat (1) dan (4) | ditahan 6 bulan, merugikan perusahaan / dinyatakan bersalah sebelum 6 bulan (ayat 1) | 0 (penggantian hak + uang pisah) | 0 |
| 54 ayat (2) dan (5) | ditahan 6 bulan, tidak merugikan perusahaan / dinyatakan bersalah sebelum 6 bulan (ayat 2) | 0 (penggantian hak) | 1 |
| 55 ayat (2) | pekerja sendiri mengajukan PHK karena sakit/cacat > 12 bulan | 2 | 1 |
| 55 | sakit berkepanjangan/cacat kecelakaan kerja > 12 bulan | 2 | 1 |
| 56 | usia pensiun | 1,75 | 1 |
| 57 | meninggal dunia (kepada ahli waris) | 2 | 1 |

Ekstraksi teks PDF ini memuat sisa OCR (mis. "(21" untuk "(2)", "O,75"); angka di tabel sudah dicocokkan dengan kalimat lengkap, tetapi sebelum dipakai sebagai aturan bertanggal (terverifikasi=true) setiap baris dicek sekali lagi ke halaman PDF aslinya. Sudah dicek ke gambar halaman PDF (1 Nov 2026), semua baris kecuali Pasal 41 (hlm 27, hanya dari teks): Pasal 42-47 (hlm 28-31), 48-52 (hlm 32-33), 53-56 (hlm 34-36), 57 (hlm 37). Pemeriksaan gambar MENGOREKSI tabel versi pertama dua kali: Pasal 54 ayat (2) dan (5) memberi UPMK 1 kali (tertulis 0 sebelumnya), dan Pasal 42 ayat (2) (0,5 kali) belum ada. Pasal 53 bukan PHK: selama ditahan pihak berwajib, pengusaha wajib memberi bantuan keluarga 25%/35%/45%/50% dari upah untuk 1/2/3/>=4 tanggungan, paling lama 6 bulan. Pasal 52 ayat (3): PHK karena pelanggaran mendesak boleh tanpa pemberitahuan Pasal 37 ayat (2).

**Pasal 58 (penting untuk cadangan):** "(1) Pengusaha yang mengikutsertakan Pekerja/Buruh dalam program pensiun sesuai dengan ketentuan peraturan perundang-undangan di bidang dana pensiun, iuran yang dibayar oleh Pengusaha dapat diperhitungkan sebagai bagian dari pemenuhan kewajiban Pengusaha atas uang pesangon dan uang penghargaan masa kerja serta uang pisah ..." Ayat (2): bila manfaat pensiun lebih kecil, selisihnya dibayar pengusaha. Ayat (3): diatur di PK/PP/PKB. Akibat: bila usaha punya program dana pensiun (bukan BPJS JP yang wajib), saldo iuran pengusaha mengurangi kekurangan cadangan; Nadi memberi isian "iuran dana pensiun pengusaha yang sudah dibayar" per orang, kosong bawaan.

Pakai di Nadi: skenario dasar 1 kali (Pasal 41/42/43(2)/44(2)/46(2)/48) tetap jadi angka cadangan; layar memberi pembanding "bila rugi (0,5 kali)" dan "bila pensiun (1,75 kali)" agar pemilik melihat rentangnya, bukan satu angka palsu.

## Rumus v1 (per karyawan aktif, dihitung harian)
- Masa kerja = tanggal hari ini dikurangi orang.data.mulai (tanpa tanggal mulai: tidak dihitung, layar meminta tanggal mulai).
- Upah dasar = pokok + tunjangan_tetap dari orang_rahasia.gaji (sumber sama dengan slip gaji F1-05; bukan lembur, bukan tunjangan tidak tetap).
- Kewajiban dasar = upah dasar x (bulan ayat (2) + bulan ayat (3)).
- Uang penggantian hak tidak dimasukkan ke cadangan (sisa cuti berubah tiap bulan dan dibayar dari kas berjalan); disebut terpisah.

Contoh: masa kerja 4 tahun 2 bulan, upah dasar Rp4.000.000 -> pesangon 5 bulan + UPMK 2 bulan = 7 x Rp4.000.000 = Rp28.000.000.

## Tampilan
Kartu "Cadangan pesangon" di /app/gaji (pemilik saja): total kewajiban dasar semua karyawan, angka per orang di rincian, dan saran sisihan bulanan (kewajiban yang belum tertutup dibagi 12). Teks wajib: "Perkiraan skenario dasar menurut PP 35/2021 Pasal 40. Jumlah yang dibayar sungguhan tergantung alasan berhenti. Belum final." Tanpa nada menakut-nakuti; angka besar ditulis apa adanya.

## Uji untuk kriteria
Tes unit tabel ayat (2)/(3) di batas tahun (0, 0,99, 1, 2,99, 3, 8, 23,99, 24 tahun); tes SQL bahwa hanya pemilik membaca angka per orang (data gaji rahasia); setiap baris membawa sumber pasal dan label belum final.

## F4-09B: karyawan kontrak dan iuran dana pensiun (4 Nov 2026)
Dibaca dari lapisan teks PDF resmi PP 35/2021 (https://peraturan.bpk.go.id/Download/154582/PP%20Nomor%2035%20Tahun%202021.pdf, hlm 11-13; pdftotext, tanpa OCR):
- **Pasal 15:** (1) pengusaha wajib memberi uang kompensasi kepada pekerja PKWT; (2) diberikan saat PKWT berakhir; (3) bagi yang punya masa kerja paling sedikit 1 bulan terus menerus; (4) bila diperpanjang, kompensasi diberikan saat jangka waktu sebelum perpanjangan selesai, lalu lagi setelah perpanjangan berakhir; (5) tidak berlaku bagi tenaga kerja asing.
- **Pasal 16:**
  - Ayat (1): PKWT 12 bulan terus menerus mendapat 1 bulan upah. PKWT 1 sampai kurang dari 12 bulan dan PKWT lebih dari 12 bulan sama-sama dihitung proporsional, "masa kerja / 12 x 1 (satu) bulan Upah".
  - Ayat (2): upah = upah pokok + tunjangan tetap.
  - Ayat (3)-(4): tanpa komponen itu, upah tanpa tunjangan; bila ada tunjangan tidak tetap, upah pokok saja.
  - Ayat (5): PKWT selesainya pekerjaan dihitung sampai pekerjaan selesai.
  - **Ayat (6): untuk usaha mikro dan usaha kecil, besarnya berdasarkan kesepakatan pengusaha dan pekerja.**
- **Pasal 17:** bila salah satu pihak mengakhiri sebelum jangka waktu berakhir, kompensasi dihitung berdasarkan jangka waktu PKWT yang telah dilaksanakan.

Pakai di Nadi:
- **Karyawan kontrak** (ada `orang.data.kontrak_selesai`) dihitung `floor(upah x masa kerja bulan penuh / 12)` sampai hari ini. Ini sesuai Pasal 17 dan cocok dengan "kalau berhenti hari ini" di kartu.
- Masa kerja kurang dari 1 bulan dihitung 0. Uang kompensasi tidak dikali pengali alasan PHK, dan kartu menyebut ayat (6) sebagai catatan bahwa angkanya acuan.
- **Aturan bertanggal:** `kompensasi.pkwt` {pembagi_bulan 12, minimal_bulan 1, mikro_kecil_kesepakatan true}, terverifikasi.
- **Iuran dana pensiun pengusaha (Pasal 58):** disimpan di `public.iuran_pensiun` (pemilik saja, `atur_iuran_pensiun`). Mengurangi kekurangan pesangon + UPMK orang itu, paling banyak sebesar kewajibannya. Tidak mengurangi kompensasi PKWT, karena Pasal 58 menyebut pesangon, UPMK, dan uang pisah.
- **Batas:** masa kerja dihitung dari tanggal mulai kerja. Untuk kontrak yang sudah diperpanjang dan kompensasinya sudah dibayar (Pasal 15 ayat (4)), pemilik mengubah tanggal mulai ke awal kontrak terakhir.
