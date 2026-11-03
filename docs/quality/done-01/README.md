# DONE-01: satu hari di warung (produksi)

Dijalankan 3 Nov 2026 19.07 WIB terhadap https://nadi-tristan-tech-ais-projects.vercel.app (deploy 3728eca) dengan
`E2E_BASE_URL=<produksi> E2E_VIDEO_DIR=<folder> pnpm exec playwright test e2e/hari-di-warung.spec.ts --project=desktop --workers=1`.
Hasil: 1 passed (1,0 menit). Video rekaman 62 detik: `satu-hari-di-warung.webm` (dikecilkan ke 960 px VP9 dari rekaman Playwright 1280 px, 9,2 MB).

Langkah (semua lulus):
1. Pengunjung membuka landing, masuk ke usaha contoh (Feed demo, Peta warung tersambung langsung), lalu membuka /panduan (4 peran).
2. Pagi: pemilik (akun uji A, Warung Uji A) masuk dan membuka Feed "Hari ini".
3. Siang: menerbitkan invoice Rp750.000 untuk pesanan arisan; pelanggan membuka halaman tagihan tanpa akun; pemilik menandai lunas
   lewat QRIS; halaman pelanggan berubah menjadi "Sudah lunas".
4. Sore: Mata memantau rekaman ruang makan (korpus CC0, 60 cuplikan) di peramban; perubahan status meja tercatat.
5. Peta usaha tersambung langsung (channel privat) dengan 3 zona.
6. Malam: alur nyata vs alur kertas di Usahamu dan halaman Gaji terbuka.

Data yang dibuat setiap jalan: satu invoice lunas "Bu Sari <kode>" dan kejadian mata.* di Warung Uji A (sintetis).
Gambar di video berasal dari korpus Mata (CC0, lihat docs/ASSETS.md).
