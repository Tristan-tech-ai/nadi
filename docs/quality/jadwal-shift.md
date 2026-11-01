# Hasil uji F3-06 Jadwal shift (1 Nov 2026)

Rancangan: docs/research/shift-f3-06.md, shift-f3-06-sql.md, solver-shift.md, docs/design/jadwal-shift.md.

| Butir | Hasil |
|---|---|
| Migrasi 20261101022000_shift + 022100_shift_peringatan | sidik 3f0615f4 dan 4dacba8e = database; 022100 memperbaiki `text[] \|\| 'literal'` yang dibaca sebagai literal larik (22P02), diganti array_append |
| Tes SQL supabase/tests/shift.test.sql | merah (tabel belum ada), lalu 25/25: 7 jam pola 6 tanpa lembur; tumpang tindih ditolak 23P01 (RPC dan exclusion constraint); split shift sore = lembur 3 jam menunggu persetujuan; lembur > 4 jam sehari dan > 18 jam seminggu ditolak 54000; lewat tengah malam di tanggal mulai; zona usaha; peringatan tanpa istirahat dan kurang libur; persetujuan hanya dijawab orangnya; batal (bukan hapus) hanya shift yang belum lewat; salin minggu idempoten; staf hanya jadwalnya; isolasi usaha |
| Penyusun jadwal apps/web/src/lib/jadwal/susun.ts | vitest 7/7: warung 4 kasir 14 slot terisi tanpa pelanggaran, beban rata (selisih <= 1), deterministik; kafe 24 jam 4 minggu semua terisi dan selisih shift malam barista <= 1; kurang orang: 18 penugasan, 10 kekurangan beralasan, tidak dipaksa lembur. Merah sengaja: tanpa cek libur, pemeriksa menangkap orang bekerja 7 hari. Skenario 3 awalnya salah rancang (batas 40 jam mengikat lebih dulu daripada hari libur), slot diganti 5 jam |
| Jam beban dari jadwal, migrasi 20261101022200_beban_jadwal | sidik cb33aaa1; tes supabase/tests/beban_jadwal.test.sql merah 6/9 sebelum migrasi, lalu 9/9: tanpa shift = 40 jam sama rata; dengan shift jam = menit kerja/60 (istirahat, batal, minggu lain tidak dihitung); orang tanpa shift 0 jam dan beban per jam null; usulan pelaksana memakai jam jadwal dan melewati orang tanpa shift. Regresi bagi_adil 27/27 |
| Advisor | keamanan: tidak ada jenis temuan baru. Performa: FK persetujuan_lembur.perusahaan_id tanpa indeks (F3-06) ditutup bersama 5 FK lama di 20261101022300_indeks_fk (sidik a0bdf494). 74 migrasi |
| Layar /app/jadwal (tab Jadwal di Kerja) | pemilik: navigasi minggu, Salin dari minggu lalu (tombol utama), formulir tambah shift, daftar per hari, total jam per orang; staf: jadwal dua minggu + kartu lembur Setuju / Tidak bisa |
| e2e apps/web/e2e/jadwal.spec.ts (lokal, desktop) | lulus: 7 jam "Tersimpan."; sore 3 jam "Selebihnya 3 jam dihitung lembur"; 1,5 jam berikutnya ditolak "Lembur paling lama 4 jam sehari ... jadi 4,5 jam" (desimal koma, sebelumnya "4.5"); staf melihat 18.00-21.00 dan menyetujui; pemilik melihat "lembur disetujui"; axe 0 pelanggaran serius 390/1440 terang/gelap; shift uji dibatalkan di akhir |

Temuan yang diperbaiki sebelum selesai:
- Pesan batas dari database memakai titik desimal ("4.5 jam"). Dirapikan di server action (src/lib/jadwal/pesan.ts, tes 2/2).
- e2e jadwal meninggalkan shift aktif minggu depan di Warung Uji A. Minggu depan bagi-adil.spec (anggapan jam sama rata, staf tanpa shift) akan merah. Sekarang shift uji dibatalkan di akhir spec; 6 shift sisa jalan lokal sebelumnya dibatalkan lewat SQL (status batal, bukan hapus).
- Layar beban akan menampilkan "Infinity" untuk orang tanpa shift di minggu berjadwal. teksJamBeban (tes 2) menampilkan "tanpa shift" dan "-".

Sengaja belum (tugas F3-06B, F3-06C): tukar shift antarstaf, ramalan kebutuhan + tombol Usulkan jadwal yang memakai susunJadwal. Juga belum: grid orang x hari di desktop (daftar per hari dipakai di semua lebar), "Kosongkan minggu", dan keterangan luring staf.
