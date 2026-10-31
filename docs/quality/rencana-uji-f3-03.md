# Rencana verifikasi loop untuk F3-03 (KPI dan cermin kinerja)

Ditulis 1 Nov 2026 saat F3-03 dikerjakan agen latar. Diperiksa loop sendiri sebelum `done F3-03`.

1. Sidik migrasi kpi = database; jumlah migrasi 50.
2. Tes SQL kpi dijalankan loop sendiri, hijau; regresi bagi_adil 27/27 dan isolasi_tenant 38/38.
3. Batas minggu memakai perusahaan.zona_waktu (cari 'Asia/Makassar' tetap di migrasi kpi: harus tidak ada kecuali sebagai fallback coalesce).
4. Staf: jawaban kpi_saya tidak memuat id kerja atau nama orang lain; kpi_minggu 42501.
5. "Hadir sesuai jadwal" tampil jujur sebagai belum tersedia sampai F3-06, bukan 0 dan bukan angka dari impor.
6. Penjelasan menyebut judul kerja nyata; tidak ada angka dari model.
7. Banding membuat usulan untuk pemilik (invariant Q-17), idempoten dengan kunci klien.
8. Foto 390/1440 terang/gelap: tidak menyalahkan karyawan, status bukan warna saja, tanpa deretan tiga kartu sama.
9. Vercel READY lalu e2e kpi.spec terhadap produksi.
