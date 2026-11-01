# Hasil uji F4-09 Cadangan pesangon (1 Nov 2026)

Rancangan: docs/research/pesangon-f4-09.md, docs/design/cadangan-pesangon.md.

| Butir | Hasil |
|---|---|
| Modul murni apps/web/src/lib/gaji/pesangon.ts | vitest merah (modul belum ada) lalu 22/22; batas masa kerja 0, 11, 12, 35, 36, 96, 287, 288 bulan (0; 0,99; 1; 2,99; 3; 8; 23,99; 24 tahun); contoh dokumen 4 tahun 2 bulan x Rp4.000.000 = Rp28.000.000; pecahan rupiah dibuang. Tanggal mulai yang belum tiba ditandai "Belum mulai bekerja" (ditemukan saat menulis e2e, merah 1 lalu hijau) |
| Migrasi 20261101021000_cadangan_pesangon | sidik 4813c704 = database (63 migrasi); aturan_bertanggal pesangon.pp35 terverifikasi dengan sumber pasal; tabel saldo + RPC cadangan_pesangon / atur_saldo_pesangon. Ditemukan sebelum apply: app.catat_audit membaca r.id, jadi tabel diberi kolom id |
| Tes SQL supabase/tests/cadangan_pesangon.test.sql | merah (fungsi belum ada, 42883), lalu 22/22: hanya pemilik (peran_aktif) membaca angka per orang; admin, akuntan, staf, klaim prn=pemilik tanpa keanggotaan, anon ditolak; hanya karyawan aktif (tanpa magang dan nonaktif); tanggal mulai tidak sah = null; hari ini di zona usaha Asia/Jayapura; usaha lain terpisah; saldo negatif 22023 |
| e2e gaji.spec "cadangan pesangon" (lokal, pindah-gaji) | lulus: isian Mulai kerja di halaman Orang, kartu Rp28.000.000, "1 orang belum dihitung", rentang Rp18.000.000 / Rp43.000.000, saldo Rp4.000.000 -> sisihkan Rp2.000.000, rincian, sumber pasal; axe 390/1440 terang/gelap tanpa pelanggaran serius; foto diperiksa. Regresi gaji.spec 4/4 |
| Regresi struktur | kebijakan/fungsi berklaim (Q-21/Q-23) 0 |
| get_advisors | hanya WARN definer untuk authenticated (pola RPC yang diterima, peran diperiksa di dalam) |

Sisa yang sengaja belum dikerjakan: isian iuran dana pensiun sukarela per orang (Pasal 58) dan hitungan karyawan kontrak, dicatat sebagai F4-09B.
