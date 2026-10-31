# Klaim JWT di dalam fungsi (lanjutan Q-21)

Diperiksa 1 Nov 2026 (tick 167) lewat execute_sql baca saja: semua fungsi di schema public dan app yang isinya memanggil app.prn() atau app.pengelola(). Q-21 menutup kebijakan RLS; fungsi security definer melewati RLS, jadi perlu dicek terpisah.

## Hasil
Hanya dua fungsi, dan keduanya sudah memeriksa tabel anggota di gerbang masuk:
- **public.gerbang_gaji**: gerbang `app.anggota_aktif(array['pemilik','admin'])` (tabel), lalu `v_pemilik := app.prn() = 'pemilik'` (klaim) untuk membedakan perlakuan pemilik di dalam fungsi. Dampak bila klaim basi: pemilik yang diturunkan menjadi admin masih diperlakukan sebagai pemilik di laporan gerbang gaji selama sisa umur token (paling lama 1 jam). Baca saja, tidak mengubah data.
- **public.lempar_berkas**: gerbang `app.anggota_aktif()` (tabel), lalu `v_ada.diunggah_oleh = auth.uid() or app.pengelola()` (klaim) saat berkas dengan sha256 sama sudah ada. Dampak bila klaim basi: admin yang diturunkan menjadi staf masih menerima id/status berkas yang diunggah orang lain bila mengunggah berkas identik, selama sisa umur token. Isi berkas tetap tertutup (berkas_baca dan berkas_unduh sudah Q-21).
- Edge Functions (supabase/functions): tidak ada yang membaca prn/pengelola.
- Aplikasi (apps/web/src/lib/sesi.ts): peran dari klaim JWT dipakai untuk tampilan (navigasi, tab). Data tetap dijaga RLS/fungsi, jadi paling buruk admin yang diturunkan melihat tombol admin yang gagal dipakai selama sisa umur token. Dapat diterima; dicatat.

## Tindakan
Tugas kecil Q-23: ganti `app.prn() = 'pemilik'` dengan `app.peran_aktif() = 'pemilik'` di gerbang_gaji dan `app.pengelola()` dengan `app.peran_aktif() in ('pemilik','admin')` di lempar_berkas; tambah ke tes jwt_cabut_q21 pemeriksaan struktur bahwa tidak ada fungsi public/app yang memanggil app.prn()/app.pengelola() (kecuali definisi keduanya). Tidak mendesak: dampaknya terbatas sisa umur token dan tidak membuka isi data.

## Temuan sampingan: zona waktu tetap (tick 168)
18 fungsi di public/app menyebut 'Asia/Makassar' (execute_sql 1 Nov 2026): gerbang_gaji 7x; isi_demo, ajukan_izin, batas_berkas, peringatan_rencana, rute_model_uji_mulai, antre_rute_model, batalkan_keputusan, beban_orang, beban_minggu 2x; izin_ringkas, catat_izin, laporan_rekrut, putuskan_usulan, ukur_kuota, awal_minggu, papan_kerja, catat_jam_rekrut 1x. Sebagian hanya cadangan coalesce(p.zona_waktu, 'Asia/Makassar') (benar, karena zona_waktu not null); sisanya menghitung batas hari/minggu dengan WITA untuk semua usaha, padahal bawaan perusahaan.zona_waktu adalah Asia/Jakarta. Dicatat sebagai Q-24.
