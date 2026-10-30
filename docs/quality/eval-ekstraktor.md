# Eval ekstraktor terkompilasi

Dijalankan 2026-10-30T23:17:11.957Z oleh `node scripts/eval-ekstraktor.ts` (apps/web) terhadap Edge Function baca-berkas produksi Supabase, akun uji sintetis A.
Berkas pertama tiap tata letak dibaca model; model berat lalu menulis aturan yang diuji pada berkas yang sama sebelum disimpan. Berkas kembaran harus dibaca dengan aturan itu: 0 token dan bidang kunci benar.

**Hasil: 5 dari 5 tata letak lulus. Akurasi bidang berkas kembaran: 396/399 (99.2%).**

| Jenis | Berkas pertama | Dibaca dengan | Aturan tersimpan | Berkas kembaran | Dibaca dengan | Bidang benar | Penilaian |
|---|---|---|---|---|---|---|---|
| invoice | invoice/invoice-02.pdf | model, 2478 token | ya | invoice/invoice-03.pdf | aturan, 0 token, 1.5 dtk | 18/18 | lulus |
| slip_gaji | slip_gaji/slip-02.pdf | aturan, 0 token | ya | slip_gaji/slip-04.pdf | aturan, 0 token, 1.3 dtk | 13/13 | lulus |
| mutasi | mutasi/mutasi-02.csv | aturan, 0 token | ya | mutasi/mutasi-03.csv | aturan, 0 token, 1.2 dtk | 90/90 | lulus |
| absen | absen/absen-02.xlsx | model, 6136 token | ya | absen/absen-03.xlsx | aturan, 0 token, 0.6 dtk | 250/250 | lulus |
| nota | nota/nota-01.png | aturan, 0 token | ya | nota/nota-05.png | aturan, 0 token, 1.1 dtk | 25/28 | lulus (nomor OCR "NI-5841") |

Catatan: foto nota dibaca OCR di perangkat (tesseract.js 7.0.0 'ind', sama seperti di HP) lalu teksnya dikirim bersama foto. Aturan dari foto diuji longgar untuk teks (paling banyak 1 huruf beda per 6) tetapi persis untuk angka dan tanggal, dan selalu lewat pemeriksaan silang (jumlah baris = total, qty x harga = jumlah). Akurasi bidang dihitung persis, jadi salah baca huruf OCR ("kg" menjadi "ko") terhitung salah di kolom Bidang benar. Berkas CSV/XLSX tidak diberi byte unik, jadi jalan ulang memakai hasil yang sudah tersimpan.

Riwayat 31 Okt 2026 (baca-berkas v6 lalu v7):
- Jalan pertama (v6): nota-01.png dibaca model (561 token) dengan teks OCR terkirim; model berat menulis aturan nota dengan `tabel_gabung` 2 (nama barang dan "qty x harga jumlah" di dua baris OCR) yang lulus uji longgar; nota-05.png lalu dibaca aturan itu, 0 token, total/tanggal/6 baris benar, nomor terbaca "NI-5841" (asli "NT-5841"). Pada jalan yang sama invoice gagal: aturan tulisan model menghafal batas tabel "Total tagihan Rp3.558.000" sehingga tidak cocok dengan invoice kembarannya (lulus uji di berkas asal, gagal di berkas lain).
- Perbaikan (v7): `labelSaja` membuang nilai (angka/rupiah) dari jangkar dan batas tabel sebelum aturan diuji; dua aturan invoice berhafalan dinonaktifkan (tidak dihapus); eval hanya menghitung aturan aktif. Jalan kedua (tabel di atas): 5/5. Baris nota di tabel memakai aturan yang ditulis pada jalan pertama.
