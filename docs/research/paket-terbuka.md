# Paket industri terbuka (W-06)

Ditulis 5 Nov 2026.

## Masalah

Formulir Mulai punya 10 jenis usaha. Pemilik usaha di luar daftar (kue rumahan, pabrik tahu, kursus, peternak lele) memilih "Lainnya" dan tidak mendapat topi apa pun.

## Yang dibangun

- Tiga paket baru: `produksi` (produksi rumahan, pabrik kecil), `pertanian` (pertanian, peternakan, perikanan), `pendidikan` (kursus, bimbel, sekolah, penitipan anak), masing-masing dengan topi, tempat, dan resep Mata.
- "Lainnya, ceritakan usahamu": pemilik menulis satu atau dua kalimat. `src/lib/paket/cocok.ts` memetakan cerita ke paket terdekat dengan kata kunci berbobot (tanpa model, tanpa biaya) dan mengenali topi baru (pembuat kue, admin pesanan online, kurir, pengemas, operator produksi, penjahit, penyablon, tukang kayu, perawat kolam, perawat ternak, pekerja kebun, pengajar, pengasuh, sopir, desainer, admin keuangan).
- Paket terdekat langsung dipasang. Topi baru menjadi satu usulan `onboarding.topi` di Feed untuk pemilik; topi dipasang hanya bila disetujui. Cerita disimpan di `perusahaan.pengaturan.cerita_usaha` bersama paket dan keyakinannya.
- Database memeriksa ulang bentuk topi (kode, nama, tanggung jawab) dan melewati topi yang kodenya sudah ada.

## Hasil

`src/lib/paket/cocok.test.ts`: 20 kalimat jenis usaha menghasilkan paket yang diharapkan dan topi yang wajar (25/25 tes). Satu kalimat (kue kering online) awalnya terbaca toko; bobot "kue kering" dan "memanggang" dinaikkan karena usaha itu memproduksi sendiri.

## Belum

- Model untuk cerita yang tidak mengandung kata kunci. Sekarang hasilnya paket kantor dengan keyakinan 0 dan tanpa topi; pemilik memilih jenis lain atau menambah topi sendiri di Orang.
- Menyunting isi paket setelah dipasang (topi bisa diubah di Orang, tetapi KPI paket belum).
