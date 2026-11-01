# Invoice yang menagih sendiri (F4-05)

Ditulis 1 Nov 2026. Masalah P08: invoice UMKM dibuat di Word/Excel, nomor loncat, penagihan bergantung ingatan pemilik, dan tidak ada yang tahu tagihan mana yang sudah lama menggantung.

## Sumber primer
- Bank Indonesia, halaman QRIS (https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/kanal-layanan/qris/default.aspx, dibaca 1 Nov 2026): MPM statis = merchant memajang stiker/cetakan, **pengguna memasukkan nominal**; MPM dinamis = QR keluar dari perangkat merchant setelah merchant memasukkan nominal; semua PJP wajib QRIS dan butuh persetujuan BI; **nominal paling banyak Rp10.000.000 per transaksi**; MDR usaha mikro 0% sampai Rp500.000, 0,3% di atasnya. Dasar: PADG 21/18/PADG/2019, diubah PADG 24/1/PADG/2022 dan PADG 3 Tahun 2025.
- Common QR Code Specification for Retail Payments in Hong Kong (HKMA, turunan EMV QRCPS Merchant-Presented; https://www.hkma.gov.hk/media/chi/doc/key-functions/financial-infrastructure/infrastructure/retail-payment-initiatives/Common_QR_Code_Specification.pdf, dibaca 1 Nov 2026), dipakai untuk struktur karena spesifikasi teknis QRIS ASPI tidak terbuka:
  - setiap objek = ID 2 digit + panjang 2 digit + nilai;
  - ID "00" = "01"; ID "01" = "11" bila QR yang sama dipakai untuk lebih dari satu transaksi, "12" bila QR baru tiap transaksi;
  - ID "54" nominal, hanya angka dan satu titik desimal, tidak dicantumkan bila aplikasi pembayar yang meminta nominal;
  - ID "58" negara (2), "59" nama merchant (sampai 25), "60" kota (sampai 15);
  - ID "63" CRC menurut ISO/IEC 13239, polinomial 1021 (hex), nilai awal FFFF, dihitung atas semua objek termasuk ID dan panjang "6304".
- jsQR 1.4.0 (Apache-2.0, README https://unpkg.com/jsqr@1.4.0/README.md): `jsQR(Uint8ClampedArray RGBA, width, height, {inversionAttempts})` mengembalikan `{data, binaryData, location}` atau null.

## Keputusan rancangan
1. **QRIS statis milik pemilik dipakai apa adanya.** Pemilik memotret atau mengunggah stiker QRIS-nya; peramban membaca isinya (jsQR) dan Nadi memeriksa: ID 00 = 01, ID 01 kosong atau 11, tanpa ID 54, mata uang 360, negara ID, nama merchant ada, CRC cocok. Nadi **tidak** mengubah QR statis menjadi "dinamis" dengan menyisipkan nominal (ID 54) dan mengganti ID 01: QR dinamis resmi diterbitkan PJP per transaksi, dan alat konversi yang beredar adalah buatan komunitas. Halaman tagihan menampilkan QR asli pemilik dan nominal besar yang harus diketik pembayar.
2. **Batas Rp10.000.000.** Tagihan di atas batas itu tidak menampilkan QRIS sebagai satu-satunya cara: halaman menyebut "Lewat QRIS paling banyak Rp10.000.000 sekali bayar" dan menampilkan rekening transfer bila diisi.
3. **Nomor dari Nomor Sakti** saat diterbitkan (jenis INV, templat bawaan `{no:3}/INV/{bulan_romawi}/{tahun}`), kode verifikasi 12 huruf seperti surat keluar, halaman publik `/i/<kode>` untuk pelanggan.
4. **Ledger**: terbit = Tagihan belum dibayar (1-200) debit / Penjualan (4-100) kredit; lunas = Kas (1-100, tunai) atau Bank (1-110, QRIS/transfer) debit / 1-200 kredit; batal = jurnal balik. Kunci idempoten per invoice.
5. **Pengingat bertahap terjadwal tanpa API WA**: saat terbit, empat jadwal ditulis: H-3 (ramah), hari jatuh tempo, H+3 (sopan, sudah lewat), H+14 (tegas, sebut nomor dan nominal). Di hari jadwalnya, layar invoice pemilik menampilkan "Pengingat hari ini" dengan tombol wa.me berisi teks sesuai tahap; tombol mencatat waktu dikirim. Nadi tidak mengirim pesan sendiri (penjaga: tidak mengirim pesan ke orang luar). Pengingat yang belum dikirim saat invoice lunas atau batal menjadi "tidak perlu".
6. **Umur piutang** dengan kelompok lazim: belum jatuh tempo, 1-30, 31-60, 61-90, lebih dari 90 hari lewat.
7. v1 belum: cicilan/bayar sebagian, PPN dan faktur pajak (Coretax, F4-07/F4-08), pencocokan otomatis dari mutasi (F4-06). Halaman tagihan menyebut "Ini bukan faktur pajak".
