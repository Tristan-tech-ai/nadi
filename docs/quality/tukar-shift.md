# Hasil uji F3-06B Tukar shift (1 Nov 2026)

Rancangan: docs/design/tukar-shift.md.

| Butir | Hasil |
|---|---|
| Migrasi 20261101028000_tukar_shift | sidik fb8c3b58 = database (77 migrasi). Sebelum apply: tabel dan fungsi belum ada, status persetujuan lembur belum menerima "batal" |
| Tes SQL supabase/tests/tukar_shift.test.sql | 29/29 setelah dua kesalahan tes diperbaiki (staf membaca baris yang memang disembunyikan RLS; pemeriksaan dipindah ke pemilik): tawarkan idempoten; shift lewat tidak bisa ditawarkan; staf lain tidak bisa menawarkan/membatalkan; rekan bukan kasir tidak melihat dan tidak bisa mengambil; rekan yang jadi lembur 7 jam ditolak 54000 dan simulasi tidak memindah shift; penawar tidak mengambil sendiri; tanpa konfirmasi hanya peringatan lembur 4 jam (tawaran tetap terbuka); dengan konfirmasi diambil + usulan shift.tukar untuk pemilik dengan kalimat "... jadi 11 jam minggu ini."; pengambil kedua kalah "Sudah diambil ..."; disetujui = shift pindah, persetujuan lembur 4 jam tercatat atas nama pengambil; ditolak = shift tetap; usaha lain tidak melihat |
| Cek batas | lewat simulasi: shift dipindah sungguhan di sub-transaksi, app.lembur_minggu dan exclusion constraint dihitung, lalu dibatalkan dengan SQLSTATE khusus; diulang saat pemilik menyetujui |
| Advisor | hanya WARN pola RPC SECURITY DEFINER yang sudah diterima; FK baru berindeks |
| Vitest | teksPeringatanTukar 1 (pesan.test 3/3) |
| e2e apps/web/e2e/tukar-shift.spec.ts + jadwal.spec.ts (lokal, desktop) | lulus: Sari menawarkan, Budi melihat kartu tawaran, "Saya ambil" memunculkan "Kamu jadi lembur 4 jam hari itu", "Tetap ambil", catatan menunggu pemilik; Sari melihat "Diambil Budi ..., menunggu pemilik"; pemilik menyetujui kartu di Feed; shift pindah ke jadwal Budi dan hilang dari Sari; shift uji dibatalkan di akhir. axe 0 serius 390/1440 terang/gelap |

Belum (sengaja): balas tukar (shift ditukar dengan shift lain), menawarkan ke satu orang tertentu, tukar otomatis tanpa pemilik, pemberitahuan push ke rekan.
