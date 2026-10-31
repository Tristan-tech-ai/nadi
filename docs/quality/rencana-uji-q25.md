# Rencana verifikasi loop untuk Q-25 (zona usaha di aplikasi)

Ditulis 1 Nov 2026 (tick 180), sebelum Q-25 dikirim ke agen. Temuan: docs/quality/zona-aplikasi.md. Diperiksa loop sendiri sebelum `done Q-25`.

1. grep di apps/web/src setelah Q-25: tidak ada lagi `+08` untuk nilai waktu (kecuali tanggal kalender 12.00 yang aman, daftar putih ditulis di laporan), tidak ada bawaan `'Asia/Makassar'` di parameter formatJam/formatTanggal/formatTenggat/hariIni.
2. Zona dibaca satu cara: lib/zona-usaha.ts zonaUsaha(supabase, perusahaanId) (sudah dibuat Q-24, kueri perusahaan.zona_waktu lewat RLS, divalidasi zonaSah) atau data sesi; tidak ada dua sumber zona yang bisa berbeda.
3. Tenggat: kerja yang dibuat di usaha Asia/Jakarta dengan tenggat diketik 17.00 tersimpan 10.00 UTC (17.00 WIB), dicek dengan execute_sql setelah e2e; di Asia/Jayapura 08.00 UTC.
4. vitest: hariIni dan formatJam untuk Asia/Jakarta dan Asia/Jayapura pada 23.30 lokal (hari tidak meloncat); merah dulu terbukti di laporan.
5. Jam mulai kerja di papan tampil di zona usaha (foto 390 terang usaha WIB).
6. Regresi e2e lokal: kerja.spec, izin.spec, magang.spec, kpi.spec, peta.spec; gate hijau.
7. Produksi: Vercel READY lalu e2e kerja.spec dan izin.spec terhadap produksi dengan --output terpisah.

## Catatan dari pembacaan kode Q-24 (tick 180)
lib/zona-usaha.ts milik agen Q-24 membaca zona dengan satu kueri `perusahaan.select('zona_waktu')` per panggilan (lewat RLS) lalu memvalidasi dengan zonaSah dari lib/izin.ts. Q-25 sebaiknya memakai fungsi ini (bukan menambah sumber baru), dan bila dipanggil di beberapa komponen per permintaan, membungkusnya dengan cache per permintaan (React cache) agar tidak berulang.
