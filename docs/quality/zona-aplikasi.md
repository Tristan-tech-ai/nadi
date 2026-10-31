# WITA tetap di lapisan aplikasi (pasangan Q-24)

Diperiksa 1 Nov 2026 (tick 178) dengan grep di apps/web/src ('+08', 'Makassar', 'WITA', 'T00:00', 'timeZone'), bukan tes. Q-24 memperbaiki database; temuan ini di kode Next.js.

## Salah, berdampak data
- **app/app/kerja/actions.ts baris 39-40**: isian datetime-local tenggat dikirim sebagai `${tenggat}:00+08:00` ("dibaca sebagai jam WITA"). Untuk usaha WIB, tenggat yang diketik 17.00 tersimpan 16.00 WIB; KPI "tepat tenggat" (F3-03) dan peringatan tenggat bergeser 1 jam (2 jam untuk WIT ke arah sebaliknya).
- **lib/izin.ts hariIni(sekarang, zona = 'Asia/Makassar')**: bawaan WITA dipakai tanpa zona di form-izin.tsx (tanggal awal formulir), magang/actions.ts (larangan tanggal masa depan) dan magang/page.tsx, gaji/page.tsx (bulan bawaan). Pukul 23.00 sampai 24.00 WIB "hari ini" sudah besok; larangan sesi magang masa depan menolak/menerima keliru di jam itu.

## Salah, tampilan saja
- **app/app/kerja/page.tsx baris 149**: jam mulai kerja ditampilkan dengan formatJam(..., 'Asia/Makassar'); pengguna WIB melihat jam 1 jam lebih maju.
- **lib/format.ts formatTanggal/formatJam(zona = 'Asia/Makassar')** dan **lib/kerja/poin.ts formatTenggat(zona = 'Asia/Makassar')**: bawaan WITA. Hitungan kasar dengan grep: 3 panggilan formatJam dan sekitar 9 panggilan formatTanggal tanpa argumen zona untuk nilai waktu (bukan tanggal kalender), plus formatTenggat di kerja/page.tsx. Perlu ditinjau satu per satu (sebagian menampilkan waktu server/log yang wajar diberi zona usaha).

## Benar, biarkan
- Tanggal kalender dari teks yang dibuat jadi Date di 12.00 +08 (gaji/page.tsx baris 134, magang/page.tsx baris 17): jam 12 siang tidak pindah hari di zona Indonesia mana pun; aman.
- beban.tsx, kpi.tsx, peta.tsx, lib/kerja/kpi.ts: tanggal kalender dibuat di 00.00Z dan ditampilkan dengan zona 'UTC'; konsisten, aman.

## Rancangan perbaikan (Q-25)
- Zona usaha tersedia di sesi aplikasi: bacaSesi/wajibPerusahaan mengembalikan zona_waktu perusahaan aktif (sekali per permintaan, di-cache 'use cache' dengan kunci perusahaan), lalu dioper ke formatJam/formatTanggal/formatTenggat/hariIni.
- Hapus bawaan 'Asia/Makassar' dari parameter fungsi format (zona wajib), supaya TypeScript menunjuk setiap pemanggil yang lupa. Pengecualian tanggal kalender pakai pembantu terpisah formatTanggalKalender('YYYY-MM-DD') tanpa zona.
- Tenggat: kirim string lokal tanpa offset dan biarkan RPC menafsirkan dengan app.zona(pid) (Q-24), atau hitung offset dari zona usaha di server action. Pilihan pertama lebih sedikit tempat salah.
- Tes: vitest untuk hariIni/format dengan zona Jakarta/Jayapura di 23.30 lokal; tes SQL buat_kerja dengan tenggat teks lokal untuk usaha WIB; e2e kerja.spec di usaha WIB memeriksa jam tenggat yang tampil sama dengan yang diketik.

## Tumpang tindih dengan Q-24 (tick 179)
Agen Q-24 ikut mengubah lapisan aplikasi (langkah 4 brief-nya): apps/web/src/lib/zona-usaha.ts (baru), lib/izin.ts (+ tes), app/app/magang/actions.ts, app/app/tahap-actions.ts, dan migrasi tambahan 20261101013000_waktu_lokal_q24.sql. Brief Q-25 (disiapkan loop) mewajibkan membaca commit Q-24 lebih dulu dan hanya menutup sisanya: tenggat '+08' di kerja/actions.ts, bawaan WITA di format.ts dan poin.ts, jam mulai di kerja/page.tsx.
