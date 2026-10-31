# Cadangan mingguan data usaha (Q-03B)

Ditulis 1 Nov 2026. Supabase Free tidak punya cadangan otomatis (loop/LEARN.md, harga 30 Okt 2026). Satu kesalahan migrasi atau penghapusan tidak sengaja bisa menghilangkan data usaha nyata. Q-03 sudah memantau kuota; Q-03B membuat cadangan sungguhan.

## Sumber (diakses 1 Nov 2026)
- Supabase, Edge Functions environment variables (https://supabase.com/docs/guides/functions/secrets): fungsi mendapat secret bawaan `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` (JSON, kunci `default`, melewati RLS, hanya untuk server) dan versi lama `SUPABASE_SERVICE_ROLE_KEY`. Nilainya tidak pernah lewat repo, Vercel, atau sesi pengembang.
- Supabase, migrasi ke kunci baru (https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys): kunci secret baru bukan JWT. Dari pg_net kirim di header `apikey`, bukan `Authorization: Bearer`; fungsi yang menerimanya diset `verify_jwt = false` dan memeriksa sendiri. Kunci lama tetap berlaku sampai akhir 2026.

## Keputusan
1. **Pemicu**: pg_cron mingguan (Minggu 18.00 UTC = Senin 01.00 WITA) memanggil Edge Function `cadangan` lewat pg_net dengan token internal dari Vault (pola yang sama dengan fungsi `push`: header `x-nadi-token`, dicocokkan RPC khusus service_role). Tidak ada kunci di SQL atau repo.
2. **Isi**: per usaha, satu berkas JSON per tabel tenant (perusahaan, anggota, orang, topi, pakai_topi, kerja, lowongan, lamaran, usulan, keputusan, slip_gaji, periode_gaji, pengajuan_izin, kebijakan_izin, jawaban_wawancara, uji_lamaran, rencana_magang, jam_rekrut, ringkasan_harian; kejadian 90 hari terakhir). **Tanpa kolom rahasia mentah**: `orang_rahasia` hanya disalin dalam bentuk yang sudah ter-hash/terenkripsi di database; token, hash token, dan kunci tidak diekspor. Berkas Storage (foto, audio) tidak disalin ulang karena sudah di bucket; manifest mencatat jalur dan sha256 agar bisa dicocokkan.
3. **Tempat**: bucket pribadi `cadangan`, jalur `{tanggal}/{perusahaan_id}/{tabel}.json` + `{tanggal}/manifest.json` (jumlah baris dan sha256 per berkas). Bucket tanpa kebijakan baca untuk authenticated/anon; hanya fungsi.
4. **Rotasi**: cadangan lebih tua dari 8 minggu dihapus oleh fungsi yang sama setelah cadangan baru selesai dan manifest-nya terverifikasi (penghapusan berkas cadangan lama, bukan data usaha; tercatat di log fungsi).
5. **Uji pemulihan**: skema uji `pulih_uji` dibuat dalam transaksi yang dibatalkan, data satu usaha dari cadangan nyata dimuat, lalu jumlah baris dan sidik per tabel dibandingkan dengan manifest; hasil dicatat di docs/quality/cadangan.md.
6. **Ukuran**: dengan angka Q-02 (±1,5 MB per usaha per tahun di database), satu cadangan semua usaha sekarang < 5 MB; 8 minggu < 40 MB dari kuota storage 1 GB.

## Kriteria terima (antrean)
pg_cron mingguan memanggil Edge Function yang mengekspor tabel usaha (JSON per tabel, tanpa kolom rahasia mentah) ke bucket cadangan pribadi; satu cadangan nyata tersimpan dan bisa dipulihkan ke skema uji (tes pemulihan tercatat); cadangan lebih dari 8 minggu dirotasi.
