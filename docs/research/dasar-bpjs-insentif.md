# Apakah insentif beban (F3-05) masuk dasar iuran BPJS?

Ditulis 1 Nov 2026 (tick 206). Jawaban dirangkai dari kutipan resmi yang sudah tercatat di repo, tanpa sumber baru.

## Dasar iuran BPJS = upah pokok dan tunjangan tetap
Semua sudah dikutip dari PDF resmi di docs/research/gaji.md (31 Okt 2026, tabel sumber baris PR82, PR64, PP44, PP45, PP46):
- **BPJS Kesehatan, pekerja penerima upah swasta:** "gaji atau upah pokok dan tunjangan tetap". Perpres 82/2018 Pasal 33 ayat (3), PDF hlm 23, sebagaimana diubah Perpres 64/2020.
- **JKK dan JKM:** upah pokok dan tunjangan tetap. PP 44/2015 Pasal 19 ayat (2).
- **JHT:** upah pokok dan tunjangan tetap. PP 46/2015 Pasal 17 ayat (2).
- **JP:** upah pokok dan tunjangan tetap. PP 45/2015 Pasal 29 ayat (1).

## Insentif bukan upah
- PP 36/2021 Pasal 8 menggolongkan insentif sebagai **pendapatan non-upah**, bersama THR, bonus, uang pengganti fasilitas, dan uang servis.
- Pasal 10 menetapkan insentif diberikan sesuai kebijakan perusahaan.
- Kutipan dari teks asli PP 36/2021 sudah tercatat di loop/LEARN.md (1 Nov 2026) dan docs/design/kolam-bonus-beban.md.

## Kesimpulan
Insentif beban kerja bukan upah pokok dan bukan tunjangan tetap; ia pendapatan non-upah menurut PP 36/2021 Pasal 8. Karena itu ia **tidak masuk dasar iuran** BPJS Kesehatan, JKK, JKM, JHT, maupun JP. Perilaku susunSlip sekarang (iuran BPJS tetap, insentif hanya menambah bruto PPh 21) sesuai teks resmi.

## Batas kesimpulan
- **Bila pemilik membayar "insentif" tetap setiap bulan tanpa melihat kinerja,** sifatnya bisa bergeser menjadi tunjangan tetap. Kolam Bonus Beban membagi menurut poin kerja selesai yang berubah tiap bulan, jadi tidak termasuk keadaan ini.
- **UU Pelindungan Ketenagakerjaan** (docs/research/uu-pelindungan-ketenagakerjaan.md) bisa mengubah definisi upah setelah berlaku. Dicek ulang di R-UUPK.

## Tindak lanjut
Layar kolam (components/app/kolam.tsx) menulis "aturan BPJS untuk insentif belum Nadi periksa ke teks resmi". Kalimat itu sekarang bisa diganti dengan kesimpulan bersumber di atas (tugas Q-31).
