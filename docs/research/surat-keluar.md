# Surat dari kalimat, QR verifikasi, PDF (F4-02)

Ditulis 1 Nov 2026. Masalah P07: surat keluar UMKM (SK mutasi, surat tugas, surat keterangan kerja) diketik ulang dari berkas lama,
nomornya ganda atau loncat, dan surat palsu atas nama usaha sulit dibantah.

## Sumber
- MDN `@page` `size` (dibaca 1 Nov 2026): `size: A4` = 210 x 297 mm, Baseline 2024.
- Nomor Sakti F4-01 (app.terbit_nomor), qrcode 1.5.4 (sudah dipakai tablet absen), unpdf 1.9.1 (pembaca PDF untuk tes).

## Keputusan
1. **Kalimat dipahami aturan, bukan model (0 token)**: pengurai TypeScript mengenali tiga jenis (SK mutasi, surat tugas, surat
   keterangan kerja), mencocokkan nama ke orang aktif usaha itu, membaca tujuan ("ke cabang Denpasar"), keperluan ("untuk ..."),
   dan tanggal ("mulai 1 Desember", "besok", "5 Nov 2026"; tahun bawaan = kejadian berikutnya). Yang tidak terbaca ditampilkan
   sebagai isian kosong untuk diisi pemilik; tidak ada yang ditebak. Model AI untuk kalimat bebas menyusul bila pola ini kurang.
2. **Draf dulu, nomor saat terbit**: draf tidak memakai nomor; "Terbitkan" mengambil nomor dari Nomor Sakti (templat bawaan per
   jenis `{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}`, bisa diubah) dan membuat kode verifikasi acak 12 huruf. Surat terbit tidak
   bisa diubah; pembatalan wajib alasan dan ikut membatalkan nomornya di nomor_terbit (tidak dipakai ulang).
3. **QR verifikasi publik** `/v/<kode>`: menampilkan nama usaha, nomor, judul, tanggal, dan nama pihak supaya pembaca mencocokkan
   dengan kertasnya; kode yang tidak terdaftar = "tidak terdaftar, kemungkinan palsu"; surat dibatalkan = "dibatalkan" beserta
   tanggalnya. Isi surat tidak ditampilkan (privasi). Kode 12 huruf dari 32 simbol (60 bit) tidak bisa ditebak.
4. **PDF A4 lewat halaman cetak**: `/cetak/surat/<id>` dengan `@page { size: A4 }`, kop usaha, nomor, isi, tempat tanda tangan,
   QR + kode. Pemilik memakai "Simpan sebagai PDF" di peramban. Tanpa pustaka PDF baru. e-Sign dan e-Meterai belum (butuh
   penyedia resmi berbayar).
5. Isi surat bahasa resmi ("Saudara"), tanpa mengutip pasal hukum yang belum dibaca.
