# Hasil uji F2-07 Lingkaran belajar rekrutmen (1 Nov 2026)

Rancangan: docs/research/lingkaran-rekrut.md.

| Butir | Hasil |
|---|---|
| Modul apps/web/src/lib/rekrut/lingkaran.ts | vitest merah (modul belum ada) lalu 9/9: peringkat rata-rata untuk nilai sama, Spearman (monoton = 1, terbalik = -1, contoh dengan nilai sama 0,9487), n < 10 tanpa angka, 12 orang bertanda petunjuk awal, 30 orang tanpa peringatan sampel dan arah terbalik disebut, uji kerja dinilai ulang dari benih |
| Migrasi 20261101025000_lingkaran_rekrut | sidik f3a18bff = database (69 migrasi): lamaran.orang_id, jadikan_karyawan, lingkaran_rekrut |
| Tes SQL supabase/tests/lingkaran_rekrut.test.sql | merah (kolom/fungsi belum ada), dua galat bahan tes sendiri (berkas_id dan durasi_detik wajib di jawaban_wawancara), lalu 15/15: karyawan dari lamaran (nama, telepon, mulai, topi lowongan 100%), idempoten, belum diterima ditolak, staf/akuntan/usaha lain/anon ditolak, jendela hari ke-90 sampai ke-180 zona usaha (poin 1,4 per minggu, tepat waktu 50%), kerja di luar jendela dan batal tidak dihitung, belum genap 90 hari dihitung terpisah, tanpa nama/telepon |
| e2e rekrut-keputusan.spec (lokal, desktop) | lulus: tandai diterima, catat sebagai karyawan, lamaran tertaut ke orang sumber lamaran, laporan "Belajar dari rekrutmen" di halaman Orang dengan jumlah yang belum genap 3 bulan; axe 390/1440 terang/gelap. Pertama kali gagal karena langkah F2-07 diletakkan sebelum pemeriksaan Bank Talenta (pelamar yang sudah diterima memang tidak ditawarkan lagi); dipindah ke akhir |

Batas yang diketahui: laporan berangka (>= 10 karyawan genap 3 bulan) belum bisa diuji ujung ke ujung tanpa data 3 bulan; hitungannya diuji vitest dan bahan SQL-nya diuji tes SQL. Rubrik CV belum ikut sebagai sinyal.
