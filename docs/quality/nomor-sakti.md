# Hasil uji F4-01 Nomor Sakti (1 Nov 2026)

Rencana: docs/quality/rencana-uji-f4-01.md. Rancangan: docs/research/nomor-sakti.md.

| Butir | Hasil |
|---|---|
| Sidik migrasi = database | 20261101019000_nomor_sakti 599fe5e9, 20261101019100_nomor_sakti_lebar 2e7236fa (62 migrasi) |
| Tanpa sequence | `nextval`/`sequence` hanya di komentar alasan; tes SQL memeriksa tidak ada sequence bernama nomor |
| Tes SQL supabase/tests/nomor_sakti.test.sql | merah dulu (objek belum ada), lalu 22/23: bug nyata `lpad` memotong `{no:3}` untuk urut 1234 menjadi 123 (nomor ke-1000 bentrok dengan ke-100); diperbaiki migrasi 019100; lalu 23/23 |
| Uji konkuren apps/web/scripts/uji-nomor-konkuren.ts | 200 RPC ambil_nomor serentak, akun uji A: 200 berhasil, 0 gagal, 0 ganda, 0 hilang, tabel tepat 1..200 (UJIMVX57OP-001 sampai -200), 2,2 dtk |
| Transaksi batal | nomor yang diambil di blok yang di-rollback tidak meninggalkan lubang (urut berikutnya tetap 3) |
| Nomor batal | tercatat status batal + alasan, tidak dipakai ulang (berikutnya 4), alasan kosong ditolak 22023 |
| Zona usaha | periode dan tanggal dari app.hari_ini (usaha Asia/Jayapura) |
| Penyusun TypeScript src/lib/nomor/templat.ts | vitest merah (modul belum ada) lalu 14/14; 6 baris tabel contoh dicocokkan juga ke app.susun_nomor/app.periode_nomor di database, hasil sama persis |
| Hak dan isolasi | staf ditolak 42501 dan tidak membaca daftar; usaha lain 0 baris dan tidak bisa memakai templat; anon ditolak |
| Regresi | isolasi_tenant 38/38, jwt_cabut_q21 17/17, klaim_fungsi_q23 26/26 |
| get_advisors | keamanan: hanya WARN definer untuk authenticated (pola RPC yang diterima, peran diperiksa di dalam lewat app.peran_aktif); performa: tidak ada temuan untuk tabel nomor |

Data uji: tiap jalan skrip konkuren menambah satu templat UJI* dan 200 nomor di usaha aktif akun A (sintetis).
