# Pencocokan mutasi bank ke invoice (F4-06)

Ditulis 1 Nov 2026. Masalah P08/P16: pemilik mencocokkan mutasi rekening dengan daftar tagihan secara manual, sehingga invoice yang sudah dibayar tetap ditagih atau yang belum dibayar terlewat.

## Bahan
- Mutasi: CSV ekspor internet banking (kolom Tanggal, Keterangan, Jumlah, DB/CR seperti korpus fixtures/korpus/mutasi). Format resmi bank tidak terdokumentasi publik (sudah dicatat di fixtures/korpus/README.md), jadi pengurai menerima beberapa nama kolom umum dan menolak dengan jelas bila kolom wajib tidak ada. Tangkapan layar mutasi lewat Lempar Saja (pembaca berkas yang sudah ada) belum tersambung ke pencocok (tugas lanjutan).
- Invoice terbuka: invoice berstatus terbit (F4-05), dengan nomor, pelanggan, total, tanggal, jatuh tempo.

## Aturan cocok (tanpa model, bisa dijelaskan)
Hanya baris kredit (CR). Untuk setiap baris, kandidat = invoice terbuka dengan tanggal invoice <= tanggal mutasi <= jatuh tempo + 90 hari.
1. **Nomor invoice disebut** di keterangan (dibandingkan setelah huruf dan angka saja, mis. "001/INV/XI/2026" = "001INVXI2026") dan nominal sama, atau kurang paling banyak Rp10.000 (biaya transfer yang dipotong dari kiriman; angka ini keputusan rancangan, bukan aturan bank): cocok, alasan "nomor invoice disebut".
2. **Nama pelanggan disebut** (semua kata nama pelanggan yang panjangnya minimal 3 huruf muncul sebagai awalan kata di keterangan, sehingga "CV MAJU JY" tidak cocok dengan "CV Maju Jaya" tetapi "MAJU JAYA" cocok) dan nominal sama persis, dan hanya satu kandidat seperti itu: cocok, alasan "nama pelanggan dan nominal sama".
3. **Nominal sama persis dan unik** di antara kandidat, dan keterangan tidak menyebut nomor invoice lain: cocok, alasan "nominal sama, satu-satunya tagihan sebesar itu".
4. Selain itu (nominal kembar tanpa petunjuk, nominal beda tanpa nomor, QRIS settlement, setoran tunai): tidak dicocokkan otomatis; kandidat dengan nominal sama ditampilkan untuk dipilih pemilik.
Satu invoice hanya boleh dipakai satu baris; bila dua baris berebut satu invoice, keduanya dilepas ke pilihan manual (tidak menebak).

## Ukuran
Korpus sintetis fixtures/korpus/cocok (dibuat skrip berbenih): setiap kasus berisi invoice terbuka, mutasi, dan jawaban (invoice yang dibayar tiap baris, atau null). Target: >= 90% baris yang membayar invoice tercocokkan otomatis, dan 0 cocok salah (cocok ke invoice yang bukan jawabannya).

## Setelah cocok
Pemilik melihat daftar "cocok" dengan alasannya dan menekan satu tombol; setiap cocok dicatat lewat tandai_lunas (cara transfer, tanggal mutasi), yang membuat jurnal Bank/Piutang dan menghentikan pengingat. Tidak ada yang dilunasi tanpa tombol itu.
