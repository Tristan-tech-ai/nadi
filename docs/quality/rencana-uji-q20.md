# Rencana verifikasi loop untuk Q-20 (jalur absen berhasil diuji ujung ke ujung)

Ditulis 1 Nov 2026 (tick 207), sebelum Q-20 dikirim ke agen. Rancangan: docs/research/absen-landmark.md.

1. **Merah sengaja.** Agen menukar indeks pipi 234 dan 454 di bingkaiDari. Tes "menoleh kiri lulus untuk arah kiri" harus gagal, lalu indeks dikembalikan dan tes hijau. Bukti berupa keluaran vitest di laporan. Loop mengulang merah sengaja ini sendiri di salinan sementara, bukan di repo.
2. **Fixture:** berkas fixtures/absen/landmark-*.json kecil (hanya x yang dipakai) dan dibuat oleh skrip yang bisa diulang. Ukuran tiap berkas dicatat; bila > 200 KB, dicari bentuk yang lebih ringkas.
3. **cek-wajah.tsx memanggil bingkaiDari.** grep: tidak ada lagi indeks landmark 1/234/454 atau nama blendshape di komponen, semuanya hanya di lib/absen/wajah.ts.
4. **Penanda uji tidak bocor:**
   - `NEXT_PUBLIC_NADI_UJI_WAJAH` hanya disetel di webServer Playwright lokal (playwright.config), tidak di env Vercel. Dicek dengan `vercel env ls` (nama saja, tanpa membaca nilai) dan grep repo.
   - Build produksi lokal tanpa variabel itu: grep chunk `.next-gate`/`.next` tidak memuat `__nadiUjiWajah`.
5. **e2e lokal:** kios ke kode QR, lalu /absen?t&k, cek wajah memakai fixture sesuai arah yang diminta, lalu "Absen masuk tercatat". Kejadian absen.masuk orang itu ada di database (execute_sql dengan id unik jalan itu). Teks yang ditunggu memuat penanda unik jalan (pelajaran Q-29).
6. **e2e produksi:** penanda disetel di window, tetapi absen tidak tercatat dan pesan "Wajah belum terlihat jelas" (atau setara) tampil. Butuh deploy, jadi dijalankan saat kuota Vercel tersedia (docs/quality/kuota-deploy.md).
7. **Regresi:** wajah.test (8 tes lama) tetap hijau; e2e absen.spec dan tablet lokal lulus; gate LULUS; CI GitHub success.
8. **Batas jujur tetap tertulis di layar dan dokumen:** cek wajah adalah klaim perangkat; Q-20 menguji jalur jujur, bukan bahwa pemalsuan mustahil.
