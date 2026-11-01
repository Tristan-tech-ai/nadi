# Hasil uji F4-06 Pencocokan mutasi bank (1 Nov 2026)

Rancangan: docs/research/cocok-mutasi.md.

| Butir | Hasil |
|---|---|
| Korpus fixtures/korpus/cocok (node scripts/korpus/cocok.mjs dari apps/web) | 3 kasus berbenih, md5 sama saat dibuat dua kali; 57 baris mutasi, 36 membayar invoice (nomor dengan 5 gaya penulisan, nomor dengan potongan biaya transfer, nama pelanggan saja, nominal unik saja, nominal kembar), 21 gangguan (debit, biaya admin, QRIS settlement, setoran tunai, bayar sebagian, nama pelanggan yang invoicenya sudah dibayar baris lain) |
| Akurasi | **33/36 = 91,7% tercocokkan otomatis, 0 cocok salah** (target >= 90%). Tiga yang tidak dicocokkan adalah nominal kembar tanpa petunjuk; ditampilkan dengan 2 kandidat untuk dipilih pemilik |
| Vitest src/lib/invoice/cocok.test.ts | merah (modul belum ada), lalu 11/11: akurasi korpus, tanpa cocok salah, nominal kembar tidak ditebak, alasan tertulis; nama disingkat tidak cocok; kurang > Rp10.000 walau bernomor tidak cocok; debit, tanggal sebelum invoice, QRIS settlement tidak pernah; pengurai CSV korpus lama (15 baris), kolom Debit/Kredit terpisah dengan titik ribuan dan koma desimal, galat jelas bila kolom wajib tidak ada. Merah sengaja: syarat kata transfer pada aturan nominal unik dihapus, 2 tes gagal (setoran tunai dan QRIS settlement ikut dicocokkan), lalu dipulihkan |
| e2e apps/web/e2e/cocok-mutasi.spec.ts + invoice.spec.ts (lokal, desktop) | lulus: CSV dengan transfer bernomor, transfer bernama pelanggan, dan debit; dua cocok tampil dengan "Dasar: nomor invoice disebut" dan "Dasar: nama pelanggan dan nominal sama"; Tandai lunas 2 invoice mencatat lunas transfer bertanggal mutasi lewat tandai_lunas. axe 0 serius 390/1440 terang/gelap |

Tanpa migrasi: pelunasan memakai tandai_lunas (F4-05) sehingga jurnal Bank/Piutang dan penghentian pengingat ikut.

Belum: mutasi dari tangkapan layar (Lempar Saja sudah membaca jenis mutasi, belum disambungkan ke pencocok), bayar sebagian, satu transfer untuk beberapa invoice, menyimpan riwayat baris mutasi yang sudah dipakai (tandai_lunas sudah idempoten per invoice).
