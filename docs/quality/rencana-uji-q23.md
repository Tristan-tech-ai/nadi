# Rencana verifikasi loop untuk Q-23 (klaim JWT basi di fungsi dan kebijakan)

Ditulis 1 Nov 2026 (tick 194), sebelum Q-23 dikirim ke agen. Temuan: docs/quality/klaim-di-fungsi.md dan docs/quality/klaim-kebijakan-sisa.md.

## Fakta pendukung (definisi hidup, tick 194)
- app.peran_aktif(), app.orang_saya(), dan app.anggota_aktif(p_peran) membaca public.anggota dengan syarat `aktif`, berdasarkan `app.pid()` dan `auth.uid()`. Anggota yang dicabut (aktif false) atau berpindah usaha mendapat null/false, walau JWT-nya masih membawa pid lama.
- Karena itu cabang staf `orang_id = app.orang_saya()` di slip_gaji, lembur, dan pengajuan_izin sudah aman untuk anggota yang dicabut. Yang terbuka hanya cabang `app.pengelola()`.
- Bentuk penggantinya bisa `(select app.peran_aktif()) in ('pemilik','admin')` atau `(select app.anggota_aktif(array['pemilik','admin']))`. Keduanya setara. Pilih yang sama dengan pola Q-21 di repo supaya seragam.

## Yang diperiksa loop sebelum `done Q-23`
1. Kueri pg_policies (public dan storage): 0 kebijakan yang memuat `app.pengelola()` atau `app.prn()`. Sebelumnya ada 5 (berkas_hapus, berkas_ubah, lembur_baca, pengajuan_izin_baca, slip_gaji_baca).
2. Kueri pg_proc public/app (selain app.prn dan app.pengelola sendiri): 0 fungsi yang memanggil keduanya. Sebelumnya ada 2 (gerbang_gaji, lempar_berkas).
3. Sidik migrasi = database; jumlah migrasi naik satu.
4. Uji JWT basi sendiri oleh loop, di transaksi yang dibatalkan:
   - Siapkan admin sintetis di usaha uji, dengan klaim pid dan prn=admin di request.jwt.claims.
   - Hitung baris slip_gaji, lembur, dan pengajuan_izin milik orang lain.
   - Set anggota.aktif = false, lalu hitung ulang. Hasilnya harus 0 untuk ketiganya.
   - Ulangi dengan peran diturunkan ke staf. Hasilnya harus 0, kecuali baris milik dirinya.
5. Tes ulang terpisah oleh agen pembantu: klaim_fungsi_q23, jwt_cabut_q21, gerbang_gaji, slip_gaji, lembur, izin_otopilot, isolasi_tenant, keamanan_q01, keamanan_q12; semuanya gagal=[].
6. get_advisors security tanpa temuan baru.
7. Produksi: tidak ada perubahan aplikasi, tetapi kebijakan baca gaji dan izin berubah, jadi e2e produksi gaji.spec (proyek pindah-gaji) dan izin.spec dijalankan dengan --output scratchpad/pw-loop. Pemilik dan admin aktif harus tetap melihat semua slip.

## Catatan
- app.prn() dan app.pengelola() tidak di-drop walau tidak dipakai lagi (penjaga: tanpa SQL penghapus). Fungsi yang tidak dipakai dicatat di laporan.
- Umur token akses proyek belum dicek. Dampak sebelum perbaikan terbatas pada sisa umur token itu.
