# Rencana menyamai dan melampaui Mekari (4 Nov 2026)

Dasar:
- [fitur.md](fitur.md): 134 kemampuan, mencakup semua 545 bagian pusat bantuan;
- [pihak-ketiga.md](pihak-ketiga.md): yang butuh mitra dan jalan penggantinya;
- [harga.md](harga.md).

Perintah Tristan 4 Nov 2026: semua fitur Mekari ada di Nadi dalam satu langganan, lebih hemat, tetap cepat dan otomatis. Bagian yang butuh pihak ketiga dicatat dan diakali bila sah.

## Prinsip yang tidak berubah

1. **Satu database.**
   - Semua modul menulis ke ledger dan graf usaha yang sama, sehingga tidak ada integrasi antarmodul.
   - Setiap transaksi operasional (penjualan, pembelian, stok, gaji, klaim, aset) memposting jurnal lewat trigger, satu rumus di satu tempat. Polanya sama dengan jurnal_pib dan invoice.
2. **Usulan dulu.**
   - Nadi menyiapkan, pemilik menyetujui di Feed.
   - Uang keluar, data gaji, dan pajak tidak pernah terjadi diam-diam.
3. **Hemat.** Tangga kecerdasan: aturan pasti, lalu ekstraktor terkompilasi, lalu model ringan, lalu model berat. Ditambah logika di Postgres, cache CDN, dan kerja malam batch.
4. **Aturan bertanggal.** Angka pajak dan ketenagakerjaan baru (THR, potongan upah, PPN, PPh 23, penyusutan fiskal, meterai) masuk public.aturan_bertanggal dengan sumber resmi. Yang belum terverifikasi tidak dipakai sebagai preset.
5. **Gerbang setiap tugas:**
   - tes SQL isolasi tenant + get_advisors;
   - vitest untuk rumus;
   - e2e;
   - foto 390/1440 terang/gelap;
   - axe;
   - kamus id/en.
6. **Layar tetap tenang** (DIRECTION.md untuk aplikasi). Modul baru masuk ke navigasi yang sudah ada lewat kelompok:
   - Uang: invoice, pembelian, kas, laporan, pajak, aset;
   - Barang: produk, stok, gudang, produksi, kasir;
   - Orang: HR, gaji, waktu, kinerja, klaim;
   - Pelanggan: CRM, percakapan, janji temu.

   Modul baru tidak dibuat sebagai aplikasi terpisah.

## Tugas (urut pengerjaan)

Ukuran: m sekitar 1 tick tebal, l sekitar 2 sampai 3 tick. Semua wajib.

| No | ID | Isi | Menutup | Kriteria terima | Ukuran |
|---|---|---|---|---|---|
| 1 | M-01 | Laporan keuangan baku dari ledger: neraca, laba rugi, arus kas (metode tidak langsung), buku besar, neraca saldo, umur piutang; saldo awal (isian + impor Excel), tutup buku tahunan, ekspor Excel/PDF; dasbor uang di /app (kas, piutang, laba bulan ini) | JU-01, JU-02, JU-18, LA-02 | RPC laporan dengan tes SQL (neraca seimbang, laba rugi = perubahan ekuitas, periode terkunci), angka cocok dengan korpus transaksi sintetis yang dihitung tangan; e2e layar + ekspor | l |
| 2 | M-02 | Produk dan stok: produk/jasa, kategori, satuan + konversi, varian, bundle, barcode, harga bertingkat; gudang banyak, transfer, penyesuaian, stok opname dari foto/Excel lewat Lempar; nilai rata-rata tertimbang; HPP otomatis ke jurnal; batch/seri dan landed cost dari PIB | JU-09, JU-10, JU-11, JU-13, JU-32 | tes SQL kartu stok (masuk/keluar/transfer/opname, tidak minus kecuali diizinkan, HPP rata-rata cocok contoh tangan), jurnal persediaan seimbang, e2e buat produk sampai stok berkurang setelah invoice | l |
| 3 | M-03 | Siklus penjualan: penawaran, pesanan, surat jalan, invoice (yang ada), uang muka, retur/nota kredit, pro forma, progress invoice, invoice gabungan, pemotongan PPh oleh pembeli, templat invoice berlogo, syarat dan cara bayar; daftar kontak pelanggan dengan saldo | JU-03, JU-04, JU-08, JU-23 | dokumen saling terkait (penawaran > pesanan > surat jalan > invoice) dengan jurnal yang benar per tahap; tes SQL; e2e alur lengkap; cetak A4 | l |
| 4 | M-04 | Siklus pembelian dan hutang: permintaan, PO, penerimaan barang (masuk stok), tagihan pemasok dari Lempar (cocokkan ke PO dan penerimaan, three-way match), jatuh tempo, pembayaran sebagian, retur/nota debit, daftar pemasok + saldo, pemetaan akun biaya per kategori | JU-06, JU-07, JU-08, EX-05 | tes SQL hutang = saldo akun 2-100; usulan dari nota yang cocok PO menyebut selisihnya; e2e PO sampai lunas | l |
| 5 | M-05 | Kas dan bank: akun kas/bank, transfer antarakun, terima/kirim uang manual, rekonsiliasi semua transaksi dengan aturan buatan pengguna (perluasan cocok mutasi), e-statement PDF/CSV lewat Lempar, alamat lempar email untuk mutasi (cek biaya layanan email masuk dulu), pilihan sambung payment gateway milik pemilik (riset dulu) | JU-14, JU-15, JU-16, JU-30, LA-09 | korpus mutasi 3 bank sintetis: cocok >= 90% dengan 0 salah; tes SQL; e2e rekonsiliasi | l |
| 6 | M-10 | Gaji lanjutan: THR (Permenaker 6/2016, dibaca dulu), prorata masuk/keluar, gaji mingguan/harian, komponen kustom + struktur gaji per level, kasbon karyawan dari kas usaha dengan cicilan di slip (batas potongan PP 36/2021, dibaca dulu), alokasi biaya ke cabang, berkas transfer massal format bank (dari panduan resmi bank), simulasi pajak dan rencana kenaikan gaji, berkas BPJS dan A1 tahunan | TA-25..TA-30, LA-01 | contoh resmi THR dan prorata cocok sampai rupiah (vitest); tes SQL potongan tidak melewati batas; e2e THR untuk 3 karyawan | l |
| 7 | M-09 | Pajak Coretax: faktur keluaran dari invoice dan faktur masukan dari Lempar menjadi berkas impor resmi Coretax (templat DJP dibaca dulu), e-Bupot Unifikasi (PPh 23, 4(2), 15, 22) dan 21/26 berkas impor, rekonsiliasi keluaran-masukan, rekap SPT Masa PPN, kertas kerja SPT, kalender setor/lapor + jumlah setor per masa, validasi bentuk NPWP/NITKU | KP-01..KP-07, TA-27 | berkas lolos validasi skema XSD/templat DJP (berkas resmi diunduh dan dicatat di LEARN); korpus 20 faktur sintetis; e2e unduh berkas | l |
| 8 | M-18 | Pengeluaran karyawan: klaim dari foto struk (staf melempar), kategori + batas per orang/bulan + saldo, perjalanan dinas (pengajuan, uang muka, laporan, penyelesaian selisih), pemeriksa kebijakan (aturan pasti dulu, model hanya untuk kategori ragu), persetujuan bertingkat, dibayar lewat slip atau tandai dibayar + jurnal | EX-01..EX-04, EX-06, TA-30 | tes SQL batas dan saldo; korpus struk; e2e staf klaim sampai masuk slip | l |
| 9 | M-11 | HR administrasi: profil lengkap + custom field, riwayat jabatan/gaji, job level, cost center, atasan langsung (bagan), onboarding/offboarding daftar periksa, transfer/promosi beralur, surat peringatan SP1-SP3 dengan masa berlaku, templat dokumen bebas (kontrak PKWT, offering) lewat surat keluar, pengumuman + tanda baca, form dan survei, persetujuan bertingkat + delegasi | TA-01..TA-13, TA-05 | tes SQL RLS (staf hanya data sendiri), e2e per alur, kamus id/en | l |
| 10 | M-12 | Waktu lanjutan: geofence absen (izin lokasi, radius per tempat), kunci periode absensi, cuti per jam dan blok, sisa cuti terbawa, libur nasional + cuti bersama bertanggal (SKB resmi), on-call, banyak shift sehari, pengajuan lembur oleh staf, timesheet per proyek, impor log mesin sidik jari lewat Lempar | TA-17, TA-19..TA-24 | tes SQL; e2e absen di luar radius ditolak dengan pesan jelas; korpus log mesin | m |
| 11 | M-19 | Kasir PWA: jual cepat (cari/scan barcode kamera), luring dengan antrean kirim, struk cetak 58 mm dan tautan struk WA, QRIS statis + tunai + transfer, shift kasir + setoran, stok berkurang dan jurnal otomatis, laporan harian | LA-03, JU-31 | e2e jual luring lalu sinkron; uji 200 transaksi tanpa selisih stok/jurnal; Lighthouse >= 90 | l |
| 12 | M-17 | Dokumen dan tanda tangan: kirim dokumen ke penanda tangan berurutan, tautan sekali pakai, pengingat, kedaluwarsa, tanda tangan elektronik tidak tersertifikasi dengan jejak bukti, cap perusahaan, verifikasi publik, repositori kontrak + pengingat berakhir, templat + kirim massal, penanda dokumen wajib meterai | SI-01..SI-10, JU-05 | sidik dokumen berubah = verifikasi gagal (tes); e2e dua penanda tangan; layar menyebut jenis tanda tangan dengan jujur | l |
| 13 | M-15 | CRM: pelanggan/perusahaan (graf usaha), deal pipeline bertahap, tugas sales, catatan, target, kunjungan lapangan dengan izin lokasi, laporan sales, segmen pelanggan | QO-06..QO-09, TA-18 | tes SQL; e2e deal sampai menjadi penawaran (M-03) | l |
| 14 | M-16 | Layanan pelanggan: kotak masuk untuk web chat (widget di situs pemilik), Telegram bot, dan email masuk; penugasan agen, jam operasional, templat; tiket + SLA + CSAT; basis pengetahuan; chatbot yang menjawab dari basis pengetahuan dan menyerahkan ke manusia; janji temu publik; poin loyalitas; katalog publik dengan pesan wa.me | QO-01..QO-05, QO-10, QO-13..QO-15, QO-17 | e2e pesan web chat masuk, dijawab agen, tiket tertutup; jawaban bot hanya dari basis pengetahuan (tes jawaban terburuk) | l |
| 15 | M-06 | Aset tetap: daftar, kelompok (fiskal dan komersial, aturan dibaca dulu), penyusutan garis lurus/saldo menurun bulanan otomatis, jual/lepas dengan laba rugi, aset dipinjam karyawan | JU-17, TA-14 | contoh penyusutan cocok tangan; tes SQL jurnal | m |
| 16 | M-08 | Anggaran per akun/bulan + laba rugi anggaran, tag/dimensi (cabang, proyek) + laporan dimensional, transaksi berulang, revaluasi valas + selisih kurs pelunasan, kurs resmi publik, konsolidasi beberapa usaha milik pemilik yang sama | JU-19..JU-22, JU-27, EX-08 | tes SQL konsolidasi mengeliminasi transaksi antarusaha; e2e | l |
| 17 | M-07 | Produksi: BoM bertingkat, perintah kerja, ambil material, hasil multiproduk, biaya standar dan selisih, assembly/disassembly | JU-12 | tes SQL stok dan jurnal WIP; e2e satu perintah kerja | m |
| 18 | M-13 | Kinerja dan belajar: goal/KPI per orang (KPI papan kerja jadi salah satu sumber), siklus review (diri, atasan, rekan) dengan formulir, kalibrasi, 9-box, kompetensi per topi, IDP; LMS dari Rekam ilmu: kursus, kuis, progres, sertifikat PDF | TA-32, TA-33 | e2e satu siklus review; tes SQL rahasia (nilai hanya pemilik/atasan) | l |
| 19 | M-14 | Rekrutmen lanjutan: kalender wawancara + undangan .ics, talent pool, laporan rekrutmen (waktu isi, sumber), manpower planning (rencana headcount + anggaran per topi), data JobPosting schema di /lamar | TA-10, TA-31 | e2e undangan; validasi JobPosting dengan uji struktur | m |
| 20 | M-20 | Pembuat alur: pemicu (kejadian Nadi), syarat, aksi (buat usulan, push, ubah status, panggil webhook keluar), formulir kustom; memakai W-08 | QO-11, LA-04, LA-10, SI-05 | tes SQL batas laju dan isolasi; e2e alur sederhana | l |
| 21 | M-21 | Akses dan keamanan: 2FA TOTP (MFA Supabase), peran kustom per izin, log aktivitas pengguna (masuk/keluar, perangkat), daftar audit yang bisa dibaca, sesi perangkat dicabut | TA-04, TA-15, JU-24, JU-25, QO-18, EX-09, LA-05 | e2e 2FA; tes SQL izin peran kustom | m |
| 22 | M-22 | Tanya data di aplikasi: pertanyaan bahasa sehari-hari jadi kueri RPC yang dibatasi (bukan SQL bebas), jawaban berangka dengan tautan sumber, kuota harian | JU-29, LA-11 | korpus 50 pertanyaan: >= 90% benar, 0 data usaha lain (tes) | m |
| 23 | M-23 | Dasbor wawasan: headcount, turnover, absen, lembur, biaya gaji, karyawan berisiko (sinyal beban), penjualan, pembuat laporan sederhana (pilih kolom, filter, ekspor) | TA-16, QO-08 | e2e; angka sama dengan RPC sumber | m |
| 24 | M-24 | Pindah dari aplikasi lain: Lempar ekspor Excel Mekari Talenta/Jurnal dan aplikasi umum lain (karyawan, bagan akun, saldo awal, kontak, produk, invoice terbuka) jadi usulan impor; ekspor semua data Nadi; program rujukan mitra akuntan | JU-26, LA-06 | korpus ekspor sintetis berformat kolom dari dokumentasi publik; e2e impor | m |

## Nilai tambah yang tidak ada di Mekari

Bagian ini dibangun bersama tugas di atas, atau sebagai tugas sendiri.

**Sudah ada:**
- Feed Keputusan dengan usulan dari berkas apa pun (Lempar Saja, 14 jenis berkas, ekstraktor 0 token).
- Mata (kamera) dan Peta Usaha langsung.
- Sarapan Data.
- Alur nyata (process mining).
- Kompas Pajak.
- Serah terima, rekam ilmu, hak berhenti.
- Kerja adil dan sinyal beban.
- Penjaga bias lowongan.
- Wawancara suara dengan transkrip di perangkat.
- AI milik pengguna lewat MCP.
- Bekerja luring.
- Mode bahasa Inggris.

**Baru:**

| ID | Isi | Kriteria terima |
|---|---|---|
| M-25 | **Kalender kepatuhan.** Satu daftar tenggat dari aturan bertanggal: setor dan lapor pajak per masa, BPJS, THR, kontrak habis, SP berakhir, izin usaha (NIB, PIRT, halal) yang diisi pemilik. Pengingat masuk ke Feed dan push | tes SQL tanggal per jenis; e2e |
| M-26 | **Paket siap pembiayaan.** Laporan keuangan 12 bulan, umur piutang, arus kas, dan riwayat invoice dalam satu PDF yang dikirim sendiri oleh pemilik (lihat pihak-ketiga.md no 12) | e2e unduh; angka sama dengan M-01 |
| M-27 | **Biaya nyata Nadi per usaha di layar.** Token, berkas, dan kuota, supaya pemilik melihat kenapa Nadi murah. Perluasan "Hemat AI" | e2e |

## Yang tidak dibuat (alasan di pihak-ketiga.md)

- kartu korporat;
- remitansi internasional;
- call center/PBX;
- Conversion API;
- menyimpan kata sandi akun lain;
- meminjamkan dana;
- menahan dana pelanggan.

## Urutan dalam antrean

1. M-01 dan M-02 mendahului W-01. Landing yang menampilkan jangkauan lebih jujur setelah stok dan laporan ada (aturan bukti S34).
2. W-04 dan W-03 tetap di depan M-10 dan seterusnya, karena onboarding menentukan modul yang dipasang per jenis dan skala usaha.
3. Urutan selanjutnya mengikuti tabel.

Video D-21 dan deck D-22 dibuat ulang setelah M-01..M-05 selesai, supaya isinya menunjukkan cakupan baru.
