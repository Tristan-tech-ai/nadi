# Eval ekstraktor terkompilasi

Dijalankan 2026-10-30T21:42:25.388Z oleh `node scripts/eval-ekstraktor.ts` (apps/web) terhadap Edge Function baca-berkas produksi Supabase, akun uji sintetis A.
Berkas pertama tiap tata letak dibaca model; model berat lalu menulis aturan yang diuji pada berkas yang sama sebelum disimpan. Berkas kembaran harus dibaca dengan aturan itu: 0 token dan bidang kunci benar.

**Hasil: 4 dari 4 tata letak lulus. Akurasi bidang berkas kembaran: 371/371 (100.0%).**

| Jenis | Berkas pertama | Dibaca dengan | Aturan tersimpan | Berkas kembaran | Dibaca dengan | Bidang benar | Penilaian |
|---|---|---|---|---|---|---|---|
| invoice | invoice/invoice-02.pdf | model, 2725 token | ya | invoice/invoice-03.pdf | aturan, 0 token, 1.3 dtk | 18/18 | lulus |
| slip_gaji | slip_gaji/slip-02.pdf | aturan, 0 token | ya | slip_gaji/slip-04.pdf | aturan, 0 token, 1.1 dtk | 13/13 | lulus |
| mutasi | mutasi/mutasi-02.csv | model, 3224 token | ya | mutasi/mutasi-03.csv | aturan, 0 token, 1.2 dtk | 90/90 | lulus |
| absen | absen/absen-02.xlsx | model, 6098 token | ya | absen/absen-03.xlsx | aturan, 0 token, 0.7 dtk | 250/250 | lulus |

Catatan: foto nota belum bisa 0 token (butuh OCR di perangkat, R-03). Berkas CSV/XLSX tidak diberi byte unik, jadi jalan ulang memakai hasil yang sudah tersimpan.

## Catatan jalannya (31 Okt 2026)
- Percobaan pertama (baca-berkas v4) 2/4: aturan invoice ditolak ("tidak lengkap: tanggal; jatuh_tempo"), aturan mutasi ditolak ("berbeda 30 dari 90 bidang", tipe kolom keliru). Penolakan bekerja sebagaimana mestinya: aturan buruk tidak pernah disimpan.
- v5 menambah perbaikan tipe tanpa token dan satu kali umpan balik ke model. Mutasi lulus di percobaan 1 (setelah perbaikan tipe), invoice lulus di percobaan 2 (model awalnya memakai `\A`, tidak dikenal regex JavaScript).
- Biaya menulis aturan dibayar sekali per tata letak (tercatat di pemakaian_ai dengan tugas tulis_aturan); semua berkas berikutnya dengan tata letak itu 0 token.
