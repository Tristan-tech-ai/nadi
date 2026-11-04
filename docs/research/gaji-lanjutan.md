# Gaji lanjutan: THR, kasbon, batas potongan (M-10)

Dibaca 5 Nov 2026 dari teks resmi.

## THR Keagamaan
Sumber: Permenaker 6/2016 (https://peraturan.bpk.go.id/Download/252116/Kemnaker%20No.%206%20Tahun%202016.pdf, teks berlapis).

- Pasal 2 ayat (1): berhak bila masa kerja 1 bulan terus menerus atau lebih, PKWTT maupun PKWT.
- Pasal 3 ayat (1):
  - masa kerja 12 bulan atau lebih: 1 bulan upah;
  - 1 sampai kurang dari 12 bulan: masa kerja / 12 x 1 bulan upah.
- Pasal 3 ayat (2): upah 1 bulan berupa upah bersih tanpa tunjangan, atau upah pokok termasuk tunjangan tetap. Nadi memakai pokok + tunjangan tetap (huruf b).
- Pasal 3 ayat (3): untuk harian lepas, upah adalah rata-rata 12 bulan terakhir, atau rata-rata per bulan selama masa kerja. Nadi (M-10B): masa >= 12 bulan = jumlah pokok + tunjangan tetap slip yang disetujui pada 12 bulan sebelum bulan Hari Raya dibagi 12 (bulan tanpa kerja tetap dihitung); < 12 bulan = jumlahnya dibagi banyak bulan yang punya slip. Tafsiran: lembur tidak dihitung sebagai upah bulanan.
- Pasal 4: bila perjanjian kerja, PP, PKB, atau kebiasaan memberi lebih besar, yang lebih besar yang dibayar. Pemilik bisa mengubah angka sebelum menyetujui.
- Pasal 5 ayat (4): dibayar paling lambat 7 hari sebelum Hari Raya.
- Pasal 7: PKWTT yang di-PHK sejak 30 hari sebelum Hari Raya tetap berhak. Belum ditangani otomatis.
- Pasal 10: terlambat membayar dikenai denda 5% dari total THR.

Masa kerja dihitung dalam bulan penuh sampai tanggal Hari Raya, sama dengan age() Postgres. Pasal tidak mengatur sisa hari, jadi ini tafsiran: bulan yang belum penuh tidak dihitung.

## Potongan upah
Sumber: PP 36/2021 (https://peraturan.bpk.go.id/Download/154587, pindaian; dibaca dengan OCR halaman 38 sampai 50).

- Pasal 63 ayat (1): potongan upah hanya untuk:
  - a denda;
  - b ganti rugi;
  - c uang muka upah (kasbon);
  - d sewa rumah atau barang milik perusahaan;
  - e utang atau cicilan utang;
  - f kelebihan pembayaran upah.
- Pasal 63 ayat (2): potongan a sampai c sesuai perjanjian kerja, PP, atau PKB. Ayat (3): potongan d dan e harus dengan kesepakatan tertulis.
- Pasal 64: potongan untuk pihak ketiga butuh surat kuasa pekerja, kecuali kewajiban kepada negara dan iuran jaminan sosial.
- Pasal 65: jumlah semua potongan Pasal 63 paling banyak 50% dari setiap pembayaran upah. Pajak dan iuran BPJS bukan potongan Pasal 63, jadi tidak dihitung dalam batas ini.
- PP 51/2023 dan PP 49/2025 (perubahan PP 36/2021) tidak menyebut Pasal 62 sampai 66. Teks keduanya dicek.

## Yang dibangun
- public.hitung_thr dan public.ajukan_thr (pemilik): THR satu Hari Raya menjadi satu usulan uang.thr di Feed pemilik.
- public.beri_kasbon (pemilik): kasbon dari kas atau bank usaha, jurnal 1-150 Piutang karyawan.
- Trigger slip_gaji menolak potongan Pasal 63 di atas 50% pendapatan slip.

## M-10B
- Cicilan kasbon: saat gaji disiapkan, aplikasi menambah komponen kasbon (jumlah cicilan semua kasbon, paling banyak sisanya, dibatasi 50% upah dikurangi potongan Pasal 63 lain). Database menolak cicilan di atas sisa kasbon. Saat periode disetujui, trigger mengurangi sisa kasbon tertua dulu (tabel kasbon_bayar) dan menjurnal D 6-100 Gaji / K 1-150.
- Rekening karyawan (bank, nomor, atas nama) di orang_rahasia (pemilik/admin). Hash dan 4 angka akhir diisi trigger, jadi Gerbang Gaji kini menandai satu rekening untuk dua orang.
- Berkas transfer: CIMB Niaga OCTO Biz, menu File Upload payroll. Sumber (dibaca 5 Nov 2026) di https://www.cimbniaga.co.id/id/business/layanan/cash-management/file-format-transaction-domestic-bank-list-octo-biz: spesifikasi OCTO-Biz-Format-File-Upload_Payroll-CIMB-Niaga-Account.xlsx dan _Payroll-SKN.xlsx, contoh Excel-File-Format-Payroll-*.xlsx, daftar Domestic_Bank_SKN_and_RTGS.xls (133 bank), panduan File-Format-Payroll-Bulk-Payment.pdf (simpan CSV comma delimited).
  - Header: rekening sumber (20 angka), nama (35), IDR, total (15,2), keterangan (80, spasi bila kosong), jumlah baris (5), tanggal YYYYMMDD, email.
  - Inhouse: rekening, nama (35), IDR, jumlah, keterangan, email, rincian (7 kolom).
  - SKN: rekening, nama (40), IDR, jumlah, keterangan, nama bank dari daftar, WNI Y/N, penduduk Y/N, email, jenis penerima 1/2/3, rincian (11 kolom).
  - Contoh resmi CIMB memakai beberapa nama bank yang tidak persis sama dengan daftarnya (BANK CENTRAL ASIA vs BCA (BANK CENTRAL ASIA)), jadi pemeriksa menjadikannya peringatan; berkas Nadi selalu memakai nama dari daftar.
- BCA, Mandiri, dan BRI tidak menerbitkan spesifikasi kolom payroll di halaman publik (dicek 5 Nov 2026), jadi belum dibuat.

## Belum
- Gaji mingguan dan harian (slip per minggu).
- Komponen kustom per level.
- Alokasi cabang.
- Berkas transfer bank selain CIMB Niaga.
- A1 tahunan dan berkas BPJS.
