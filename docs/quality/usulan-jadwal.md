# Hasil uji F3-06C Kebutuhan shift dan Usulkan jadwal (1 Nov 2026)

Rancangan: docs/research/solver-shift.md (penyusun), docs/design/jadwal-shift.md.

| Butir | Hasil |
|---|---|
| Migrasi 20261101029000_kebutuhan_shift | sidik e920d5e7 = database (78 migrasi). Sebelum apply: tabel dan fungsi belum ada |
| Tes SQL supabase/tests/kebutuhan_shift.test.sql | 15/15: kebutuhan 7 hari sekaligus; hari sama diperbarui bukan digandakan; tanpa hari, istirahat melebihi shift, dan topi usaha lain ditolak; berhenti pakai tanpa hapus; data penyusun: minggu mulai Senin, kebutuhan aktif saja, orang bertopi, shift malam 4 minggu terakhir (5 minggu lalu tidak dihitung), hari yang sudah terisi; staf dan usaha lain tidak membaca atau mengubah |
| Advisor | tanpa FK tak berindeks; WARN RPC SECURITY DEFINER sesuai pola yang diterima |
| Vitest src/lib/jadwal/kebutuhan.test.ts | merah (modul belum ada), lalu 7/7: 7 kebutuhan harian jadi 7 baris bertanggal hanya untuk orang bertopi; hari yang sudah terisi dilewati; kekurangan dalam kalimat; kunci simpan deterministik berbentuk uuid; ringkasan simpan sebagian dengan alasan per baris |
| e2e apps/web/e2e/usulan-jadwal.spec.ts (lokal, desktop) | lulus: kebutuhan kasir uji 07.00-15.00 tiap hari + Sabtu 16.00-22.00 butuh 3; Usulkan jadwal untuk minggu dua pekan lagi menghasilkan 8 baris dan "Sabtu 16.00-22.00: kurang 2 ..."; simpan 8 shift lewat simpan_shift; jadwal minggu menampilkan kedua orang; di akhir kebutuhan dihentikan dan shift dibatalkan. axe 0 serius 390/1440 terang/gelap |

Temuan saat uji: React mengosongkan formulir setelah aksi berhasil, jadi pilihan topi kembali "Pilih". Dibiarkan (formulir kosong = siap untuk kebutuhan berikutnya); uji memilih topi lagi.

Belum: ramalan dari data (tahap 1: dari kejadian/omzet per jam), kebutuhan per tanggal khusus (hari libur, acara), menghitung jam yang sudah terjadwal minggu itu ke dalam batas 40 jam penyusun (sekarang hanya hari yang sudah terisi dilewati; simpan_shift tetap menolak yang melanggar).
