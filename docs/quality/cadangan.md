# Bukti Q-03B: cadangan mingguan dan uji pulih

Diuji 4 Nov 2026 di proyek Supabase izyesrryiljitpusaqvf. Rancangan: docs/research/cadangan.md.

| Bukti | Hasil |
|---|---|
| Migrasi `cadangan` + `cadangan_pulih` | sidik md5 (tanpa spasi) sama dengan berkas repo: 6f4ddacf, 60e1420d |
| Tes SQL supabase/tests/cadangan.test.sql | merah dulu (fungsi belum ada), lalu 14/14 |
| Advisor keamanan | tidak ada peringatan baru untuk fungsi cadangan_* (hanya service_role) |
| Edge Function `cadangan` v1 (verify_jwt mati, cek token Vault) | tanpa token 401, token palsu 401 |
| Cadangan nyata lewat pg_net (`app.kirim_cadangan('cadangan')`, permintaan 373) | HTTP 200, folder 2026-11-04: 47 tabel, 4.810 baris, 2.674.898 byte, 48 objek (47 + manifest) |
| Uji pulih dari bucket (`app.kirim_cadangan('uji_pulih')`, permintaan 374) | HTTP 200, 47/47 tabel cocok jumlah baris dan id unik, 0 gagal; tercatat di app.cadangan_log jenis `pulih` |
| Rotasi (supabase/functions/cadangan/rotasi.ts) | vitest cadangan-rotasi 4/4; merah sengaja (tanpa menyimpan 8 terbaru) 1 gagal; tepat 56 hari disimpan |
| Jadwal | pg_cron `nadi-cadangan` '30 18 * * 0' (Senin 02.30 WITA) |

Pemeriksaan rutin: `select jenis, folder, tabel, baris, galat from app.cadangan_log order by dibuat_at desc limit 3` (galat harus kosong, baris cadangan terbaru tidak lebih dari 7 hari).
