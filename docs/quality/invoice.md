# Hasil uji F4-05 Invoice yang menagih sendiri (1 Nov 2026)

Rancangan dan sumber: docs/research/invoice.md.

| Butir | Hasil |
|---|---|
| Modul apps/web/src/lib/invoice | merah (modul belum ada), lalu vitest 18/18: CRC-16 nilai periksa baku "123456789" = 29B1; QRIS statis sintetis terbaca (nama, kota, NMID); CRC salah, QR dinamis (01 = 12), QR bernominal (ID 54), bukan rupiah/Indonesia, dan panjang TLV melewati akhir ditolak; total baris dibulatkan per baris; jadwal pengingat H-3/H0/H+3/H+14 dan tahap yang sudah lewat dilewati; umur piutang 5 kelompok; teks pengingat dan pesan pertama tanpa tanda pisah dan emoji. Merah sengaja: nilai awal CRC diganti 0, tes nilai periksa gagal, lalu dipulihkan |
| Migrasi 20261101027000_invoice + 027100_invoice_indeks | sidik 8ff1b66a dan 06a9f249 = database (76 migrasi). Sebelum apply: tabel dan fungsi belum ada |
| Tes SQL supabase/tests/invoice.test.sql | 31/31: terbit 001/INV/<romawi>/<tahun> + kode 12 huruf + jurnal 1-200/4-100 1.255.000 + 4 pengingat; kunci sama = invoice dan jurnal yang sama; 5 isian salah ditolak 22023 tanpa memakan nomor; jatuh tempo hari ini hanya tahap 2-4; umur piutang dan pengingat hari ini (hanya tahap terbaru); catat pengingat; lunas QRIS = jurnal 1-110/1-200, idempoten, tanggal masa depan ditolak; invoice lunas tidak bisa dibatalkan; batal = jurnal dibalik + nomor batal + pengingat berhenti; saldo 1-200 = invoice terbit belum lunas; staf, usaha lain, anon tidak melihat atau mengubah apa pun; halaman publik tanpa HP pelanggan |
| Advisor | performa: FK komposit pengingat_invoice tanpa indeks ditutup 027100. Keamanan: invoice_publik dapat dipanggil anon (SECURITY DEFINER) disengaja seperti verifikasi_surat; kode 60 bit |
| e2e apps/web/e2e/invoice.spec.ts (lokal, desktop) | lulus: foto stiker QRIS sintetis dibaca jsQR di peramban, disimpan apa adanya (isi DB = payload); invoice 2 baris total langsung Rp1.255.000; daftar menautkan wa.me/62812...; pengingat hari ini "Jatuh tempo hari ini" dengan wa.me (diblokir di uji, tidak ada pesan terkirim) dan hilang setelah dibuka; halaman tagihan tanpa akun: total, QR, "ketik nominal Rp1.255.000", rekening, tanpa nomor HP; tandai lunas QRIS lalu halaman tagihan "Sudah lunas" tanpa QR; invoice kedua dibatalkan. axe 0 pelanggaran serius 390/1440 terang/gelap untuk layar pemilik dan halaman tagihan |

Temuan yang diperbaiki sebelum selesai:
- Bagian "Tujuan bayar" berpindah tempat saat pertama disimpan sehingga pesan berhasil hilang. Sekarang bagian itu tetap di bawah, dan bila belum diatur ada catatan di atas dengan tautan ke sana.
- Baris barang meluber di 390 px (kolom harga terpotong). Di HP uraian kini satu baris penuh, jumlah dan harga di baris kedua dengan label terlihat.
- Tes teks memakai karakter tanda pisah asli di sumber (alat tulis mengubah escape); diganti `new RegExp("[\\u2013\\u2014]")`.

Belum (sengaja): bayar sebagian/cicilan, PPN dan faktur pajak (F4-07/F4-08), pencocokan otomatis dari mutasi bank (F4-06), pemberitahuan push untuk pengingat.
