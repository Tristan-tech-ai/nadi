# Bukti F3-07B: kartu "Beban dan kabar tim"

Diuji 4 Nov 2026. Rancangan: docs/research/sinyal-risiko-beban.md, docs/design/sinyal-beban-layar.md.

| Bukti | Hasil |
|---|---|
| Migrasi `sinyal_beban` (20261104042000) | sidik md5 tanpa spasi 61b4411c, sama dengan berkas repo |
| Tes SQL supabase/tests/sinyal_beban.test.sql | merah dulu (fungsi belum ada), lalu 26/26: berat 3 minggu menyala (rasio 2,0), 2 minggu tidak, tim 2 orang tidak, lintas 0 -> 1 tidak, sakit tidak dihitung bila riwayat < 16 minggu, lintas + sakit tanpa berat menyala, 2 kartu lalu idempoten 0, untuk_peran {pemilik}, teks tanpa berisiko/keluar/alasan sakit, admin dan staf 42501, admin tidak melihat kartu, pemilik menutup kartu, pemilik dicabut (JWT lama) 42501 |
| e2e/beban-tim.spec.ts (lokal) | kartu tanpa Setujui, tautan /app/kerja?tab=beban, axe 0 serius 390/1440 terang/gelap, Sudah ditangani menyimpan status diterima + waktu, hilang setelah muat ulang |
| e2e bahasa-akun | Feed mode Inggris tetap bersih (tombol kartu lewat kamus kartuInfo; judul/penjelasan ditulis Nadi bertanda lang=id) |
| Jadwal | pg_cron `nadi-kartu-beban` '30 17 * * 0' (Senin 01.30 WITA), usaha demo dilewati |

Batas jujur: bukan prediksi orang berhenti; jam 40 per minggu sampai jadwal shift diisi; kerja yang masih berjalan dihitung di setiap minggu sejak dimulai (sama dengan beban_orang).
