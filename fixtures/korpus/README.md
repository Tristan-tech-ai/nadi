# Korpus contoh sintetis

Dibuat ulang dengan `node scripts/korpus/buat.mjs` dari apps/web. Semua isi karangan: nama, nomor, dan angka tidak mewakili orang atau usaha sungguhan. KTP memakai kode provinsi 99 (tidak ada) dan bertanda CONTOH. Potongan pajak/BPJS di slip gaji adalah nilai contoh, bukan perhitungan resmi. Kolom mutasi bank meniru ekspor umum; format resmi bank tidak terdokumentasi publik.

Setiap berkas punya jawaban benar di `{id}.json`; daftar lengkap di `indeks.json` (42 berkas).

## Dokumen pabean (B-EKSIM3)
`pabean/` dibuat terpisah oleh `node scripts/korpus/pabean.mjs` (dari apps/web) dengan `pabean/indeks.json` sendiri. Isinya 2 PIB, 1 PEB, dan 1 SPPB sintetis bertanda CONTOH. Tata letaknya meniru elemen formulir PIB BC 2.0 (PER-44/BC/2011) dan PEB BC 3.0 (PER-07/BC/2020). Dinilai oleh `node scripts/eval-pabean.ts`.
