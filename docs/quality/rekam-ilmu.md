# Bukti F3-07C: Rekam Ilmu

Diuji 4 Nov 2026 (lokal + produksi https://nadi-swart.vercel.app, deploy nadi-mkh65qtcd).

| Bukti | Hasil |
|---|---|
| Migrasi rekam_ilmu, rekam_ilmu_baca, langkah_ilmu | sidik md5 sama dengan repo (d14101ef, 93a510ad, 08920424) |
| Tes SQL rekam_ilmu | merah dulu, lalu 19/19: hanya orang yang berhenti merekam butir ilmunya; rekan, pemilik, butir non-ilmu, paket selesai ditolak 42501; jalur serah/<berhenti>; unggah belum ada 55000; langkah divalidasi; usaha lain P0002 |
| Tes SQL langkah_ilmu | 9/9 (ditulis sebelum apply, tidak dijalankan merah dulu): konteks hanya pemilik/admin, butuh transkrip, token dicatat walau langkah ditolak, batas 3 panggilan per klip per 24 jam |
| vitest langkah-ilmu | merah dulu, lalu 5/5: rapikanLangkah (bentuk, 1-20, 300 huruf, tanpa tautan), samarkanAngka (>= 7 digit) |
| Edge Function langkah-ilmu v1 | model ringan dari public.konfigurasi model_ai, JWT pemanggil, keluaran divalidasi |
| e2e/rekam-ilmu.spec.ts (lokal + produksi) | staf masuk, menu Ilmu, mikrofon palsu s01 merekam lalu kirim; pemilik melihat direkam m:ss, klip, Susun langkah (model sungguhan) menghasilkan langkah bernomor + catatan klip asli, edit langkah tersimpan bersumber pemilik; axe 0 serius 390/1440 terang/gelap |
| e2e bahasa-akun | /app/ilmu mode Inggris bersih |

Catatan: transkrip di perangkat (whisper) di e2e diganti isian lewat RPC karena jalur transkrip yang sama sudah diuji di e2e/wawancara.spec.ts. Permissions-Policy mikrofon berlaku per dokumen, jadi menu Ilmu memuat halaman penuh.
