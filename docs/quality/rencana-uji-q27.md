# Rencana verifikasi loop untuk Q-27 (rata-rata beban tim)

Ditulis 1 Nov 2026 (tick 190), sebelum Q-27 dikirim ke agen. Rancangan: docs/design/rata-rata-beban.md. Keputusan: loop/DECISIONS.md (1 Nov 2026, rata-rata beban). Diperiksa loop sendiri sebelum `done Q-27`.

1. Sidik migrasi rata_beban_q27 = database. public.beban_saya tetap security definer dengan search_path kosong, dan hak execute sama seperti sebelumnya (bandingkan `has_function_privilege` anon/authenticated sebelum dan sesudah).
2. Kueri loop terhadap data uji sungguhan, Warung Uji A, minggu ini: kelompok pembanding = jumlah baris app.beban_orang dengan poin, antre, atau selesai_n > 0, lalu bandingkan dengan n_kelompok yang dikembalikan beban_saya. Karena beban_saya membaca app.pid() dari JWT, kueri ini dijalankan di transaksi dengan set_config('request.jwt.claims') milik akun staf uji, lalu dibatalkan.
3. Tes SQL rata_beban_q27 dijalankan ulang oleh agen pembantu terpisah. Empat baris tabel contoh harus cocok persis:
   - 2/4/6: rata 4, orang 6 tidak di atas;
   - 2/4/12: orang 12 di atas;
   - 1/1/3: orang 3 tidak di atas karena selisih < 4;
   - 2 orang: rata null.
4. Regresi: bagi_adil, kpi, papan_kerja, hari_ini_q26, isolasi_tenant, semuanya gagal=[].
5. Vitest teksBebanSaya: tidak ada keluaran yang memuat "Rata-rata tim 0". grep di apps/web/src untuk string "Rata-rata tim 0" juga 0.
6. Foto 390 terang layar staf (/app/kerja) dari e2e diperiksa terhadap VOICE dan ANTI-SLOP:
   - kalimat pendek dan berangka;
   - tidak menyalahkan;
   - tanpa tanda pisah panjang;
   - kartu tidak lagi berkata "di atas rata-rata" untuk beban kecil.
7. Produksi: Vercel READY, lalu e2e kerja.spec terhadap produksi dengan --output scratchpad/pw-loop.
8. get_advisors security tanpa temuan baru.

## Risiko yang dicek khusus
- **kpi.ts dan kartu KPI F3-03** memakai aturan "minimal 3 orang punya kerja selesai". Pastikan Q-27 tidak mengubah fungsi KPI. Kalimat di kedua kartu boleh berbeda karena ukurannya berbeda: beban = poin yang dipikul, KPI = kerja selesai. Bila keduanya tampil di layar yang sama, pastikan tidak saling bertentangan.
- **Kelompok pembanding hanya memakai satu minggu (awal_minggu zona usaha, Q-26).** Saat dicek di awal minggu, angkanya akan kecil, dan itu wajar. Kartu harus menampilkan "Rata-rata tim tampil bila minimal 3 orang memakai papan kerja minggu ini", bukan angka 0.
