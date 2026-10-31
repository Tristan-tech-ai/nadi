# Tinjauan diff Q-25 sebelum commit agen (zona usaha di aplikasi)

Ditulis 1 Nov 2026 (tick 185) dengan membaca `git diff` 25 berkas apps/web milik agen Q-25 yang belum di-commit. Hanya dibaca, tidak diubah. Dibandingkan dengan docs/quality/zona-aplikasi.md dan rencana-uji-q25.md.

## Yang sudah benar
- **grep `Makassar` dan `+08` di apps/web/src** (tanpa tes) tinggal dua tempat, dan keduanya sah:
  - peta singkatan zona di lib/format.ts (Asia/Makassar ke WITA);
  - ZONA_CONTOH di /dev/komponen (lembar contoh komponen, noindex).
- **Bawaan zona dihapus** dari formatTanggal, formatJam, hariIni (lib/izin.ts) dan formatTenggat (lib/kerja/poin.ts). Parameter zona sekarang wajib, jadi TypeScript menunjuk setiap pemanggil yang lupa.
- **Tanggal kalender** punya pembantu sendiri, formatTanggalKalender('YYYY-MM-DD'), tanpa zona.
- **Tenggat:** kerja/actions.ts memakai waktuLokalKeIso(tenggat, zonaUsaha(...)) di server action. Ini pilihan kedua di zona-aplikasi.md (hitung offset di server, tanpa migrasi). Konsekuensinya, tes SQL buat_kerja dengan teks lokal tidak perlu ada; kriteria memang mensyaratkan tes itu hanya bila penafsiran dipindah ke SQL.
  - Tanggal yang tidak ada di kalender (misalnya 31 Feb) ditolak dengan pesan yang jelas.
  - Dua putaran offset menjaga hasil tetap benar di zona bermusim panas, walau zona Indonesia tidak memakainya.
- **Zona dibaca dari satu sumber:**
  - zonaUsaha (kueri perusahaan.zona_waktu lewat RLS, divalidasi zonaSah, cadangan Asia/Jakarta sama dengan bawaan kolom);
  - zonaUsahaIni = React cache per permintaan;
  - zonaSesi() untuk komponen tanpa sesi. Ada 18 pemakaian di komponen.
- **Komponen klien** (form-izin) menerima zona lewat props dari server, jadi tidak menebak zona.
- **status-lamaran (pelamar anonim):**
  - Pelamar tidak bisa membaca perusahaan lewat RLS, jadi tanggal kiriman ditampilkan di zona perangkat pelamar. Itu sah untuk "dikirim tanggal".
  - Komponen ini klien dan merender setelah membaca hash di useEffect, jadi tidak ada salah hidrasi zona server.
- **Format jam:** Intl dengan hourCycle h23, sehingga tengah malam tampil 00.xx, bukan 24.xx.
- **Tes vitest:** Asia/Jayapura muncul di format.test (6), izin.test (3), poin.test (2).
- **e2e kerja.spec:**
  - memastikan Warung Uji A berzona Asia/Jakarta sementara browser uji WITA, jadi bedanya nyata;
  - besok 17.00 WIB harus tersimpan 10.00 UTC dan tampil "Tenggat Besok, 17.00";
  - jam mulai harus tampil dalam WIB.

## Catatan (tidak memblokir)
- Label relatif "Besok" di e2e dihitung dari Date.now() + 24 jam di zona usaha. Bila tes berjalan tepat di pergantian hari WIB, label dan tanggal tetap konsisten karena keduanya dihitung dari saat yang sama. Risiko rapuhnya hanya bila server dan tes melewati tengah malam di antara pengisian dan pemeriksaan, dan itu dapat diterima.
- Kartu staf "Sedang jalan sejak HH.MM" dibandingkan dengan teks yang persis sama, dengan toleransi plus minus satu menit. Bila nanti singkatan zona (WIB) ditambahkan ke teks itu, tesnya perlu ikut diubah.
- absen/actions.ts memanggil zonaSesi() di server action: satu kueri tambahan per absen. Dapat diterima. Sebenarnya bisa memakai zona dari baris kejadian, tetapi tidak perlu.

## Untuk verifikasi loop setelah agen commit
1. Ulangi grep di atas pada commit yang benar-benar masuk, bukan pada diff.
2. Vitest dibuat merah dengan sengaja: kembalikan bawaan Asia/Makassar di salinan sementara, atau baca bukti merah di laporan agen.
3. Gate LULUS, push, Vercel READY, lalu e2e produksi kerja.spec dan izin.spec dengan --output scratchpad/pw-loop.
4. Foto 390 terang usaha WIB dari e2e (kerja-staf-jalan-wib-390-light.png) diperiksa terhadap ANTI-SLOP.
