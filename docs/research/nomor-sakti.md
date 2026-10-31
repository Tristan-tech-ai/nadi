# Nomor Sakti: penomoran dokumen tanpa ganda dan tanpa loncat (F4-01)

Ditulis 1 Nov 2026. Masalah P07: nomor surat, invoice, dan SK di UMKM dicatat manual di buku atau Excel; dua admin bisa memakai nomor yang sama, dan nomor yang dibatalkan meninggalkan lubang yang ditanyakan pemeriksa.

## Sumber
- PostgreSQL, fungsi sequence (https://www.postgresql.org/docs/current/functions-sequence.html, diakses 1 Nov 2026): nilai `nextval` tidak dikembalikan bila transaksi batal, jadi transaksi batal, crash, bahkan `INSERT ... ON CONFLICT` bisa meninggalkan lubang; "sequence objects cannot be used to obtain gapless sequences". Karena itu Nadi tidak memakai sequence untuk nomor dokumen.

## Keputusan
1. **Penghitung di tabel biasa** `app.penomor (perusahaan_id, kode, periode, terakhir)`, dinaikkan dengan `UPDATE ... RETURNING` di dalam transaksi yang sama dengan pembuatan dokumen. Kunci baris membuat permintaan bersamaan antre (bukan ganda); transaksi batal ikut membatalkan kenaikan (bukan loncat). Throughput per kode terbatas oleh antrean itu, dan cukup untuk UMKM (puluhan dokumen per hari).
2. **Tata bahasa nomor** per jenis dokumen, disimpan sebagai data: templat dengan token `{no:3}` (nomor urut berisi nol di depan), `{kode}` (kode usaha), `{jenis}` (SK, ST, INV, ...), `{bulan_romawi}`, `{bulan}`, `{tahun}`, `{tahun2}`. Contoh `{no:3}/{kode}/{jenis}/{bulan_romawi}/{tahun}` menjadi `012/WRG/SK/XI/2026`. Periode reset: tahunan, bulanan, atau tidak pernah, diturunkan dari token yang dipakai (ada `{bulan}` atau `{bulan_romawi}` berarti bulanan).
3. **Nomor batal tidak dihapus dan tidak dipakai ulang**: dokumen yang dibatalkan setelah bernomor tetap tercatat berstatus batal dengan alasan, sehingga daftar nomor tetap utuh tanpa lubang yang tak terjelaskan.
4. Pengujian yang menjadi kriteria terima: 200 permintaan paralel (pgbench atau Promise.all ke RPC) menghasilkan 200 nomor unik berurutan 1..200, 0 ganda, 0 loncat; ditambah uji transaksi batal di tengah tidak meninggalkan lubang.

## Kriteria terima (antrean)
Uji konkuren 200 permintaan paralel: 0 ganda, 0 loncat.
