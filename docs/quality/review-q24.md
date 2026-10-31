# Tinjauan tes Q-24 sebelum commit agen (zona usaha)

Ditulis 1 Nov 2026 tick 176 dengan membaca (hanya baca) supabase/tests/zona_q24.test.sql milik agen (249 baris, belum di-commit), terhadap docs/quality/zona-fungsi.md.

## Yang dicakup tes
- Struktur: 0 fungsi public/app memakai 'Asia/Makassar' di luar coalesce(zona_waktu, ...) selain daftar putih (isi_demo, ukur_kuota) yang wajib berkomentar; putuskan_usulan tanpa current_date; app.zona/app.hari_ini sql stable search_path kosong; fungsi pembantu tidak bisa dipanggil public/anon/authenticated.
- Data lama: tidak ada lagi kejadian izin di 00.00 WITA untuk usaha zona lain; setiap koreksi punya cadangan di audit_log.
- Perilaku dengan usaha Asia/Jakarta dan Asia/Jayapura: catat_izin (2 cek), ajukan_izin (5), batalkan_keputusan (2), izin_ringkas, gerbang_gaji (5), papan_kerja, putuskan_usulan (2).
- Pembantu baru app.tanggal_teks (tidak ada di rancangan): tes menyatakan hasilnya "sama persis dengan pasangan lama tanggal_aman +08 dibaca di WITA", artinya perilaku untuk teks tanggal tetap dipertahankan di satu titik. Perlu dicek saat verifikasi: apakah ini sengaja mempertahankan WITA untuk data impor tanpa zona (pembacaan tanggal dari teks), dan apakah dikecualikan dari cek struktur dengan alasan tertulis.

## Celah yang dicatat (bukan memblokir)
- Kelompok C tanpa tes perilaku: app.peringatan_rencana (tanggal mulai magang) dan public.catat_jam_rekrut (larangan tanggal masa depan). Hanya tercakup cek struktur.
- Kelompok D tanpa tes perilaku: app.antre_rute_model, public.rute_model_uji_mulai, app.batas_berkas (jam reset batas harian). Hanya cek struktur; dampaknya kecil (docs/quality/zona-fungsi.md bagian D).
- Dua cek yang tampak bertentangan: "fungsi pembantu baru tidak bisa dipanggil public, anon, atau authenticated" dan "fungsi pembantu app.zona/app.hari_ini/app.tanggal_teks bisa dipanggil". Kemungkinan yang kedua dari dalam fungsi security definer (pemilik), tetapi harus dipastikan dengan membaca tes setelah commit.

## Untuk verifikasi loop setelah push (tambahan ke rencana-uji-q24.md)
1. Jalankan cek struktur sendiri (pg_proc) dan bandingkan dengan klaim tes.
2. Uji cepat catat_jam_rekrut dan peringatan_rencana untuk usaha Asia/Jayapura di transaksi yang dibatalkan.
3. Pastikan app.tanggal_teks tidak memasukkan WITA ke perhitungan batas hari usaha.

## Dikirim ke agen (tick 177)
Ketiga butir di atas dikirim ke agen Q-24 lewat pesan sebelum ia commit, supaya bisa ditutup di tes yang sama. Saat dikirim, agen sudah menulis supabase/migrations/20261101012000_zona_usaha_q24.sql (belum di-commit).

## Tinjauan migrasi agen (tick 178, baca saja)
- Pendekatan: definisi hidup diambil dengan pg_get_functiondef lalu hanya pola zona diganti lewat replace dengan jumlah kemunculan yang diperiksa (gagal bila beda). Rapi dan aman terhadap perubahan logika tak sengaja; kekurangannya, berkas migrasi tidak memuat definisi akhir fungsi (harus dibaca dari database atau dari migrasi sebelumnya + pola). Sudah di-apply ke database sebelum commit.
- app.tanggal_teks setara dengan bagian tanggal app.tanggal_aman (keduanya hanya menerima 'YYYY-MM-DD', dicek definisi hidup): mengganti `(app.tanggal_aman(t) at time zone 'Asia/Makassar')::date` dengan `app.tanggal_teks(t)` memang benar dan tidak memasukkan WITA ke batas hari.
- Koreksi data lama memakai kejadian.data->>'pengajuan_id': 61 dari 61 kejadian izin menyimpannya, jadi join tidak melewatkan baris.

## TEMUAN: WITA tersembunyi di app.tanggal_aman
app.tanggal_aman(teks, jam) mengembalikan timestamptz dengan sufiks '+08' (komentar fungsi: "-- WITA"), tanpa teks 'Asia/Makassar', sehingga lolos cek struktur Q-24. Pemakai tersisa: public.putuskan_usulan di 4 tempat (absen.harian dari impor, satu cabang tanggal, izin.sakit dari usulan, uang.* dari nota). Bukti produksi: kejadian uang.keluar sumber lempar di usaha Asia/Jakarta, **20 dari 20** tercatat 23.00 WIB hari sebelumnya (usaha Asia/Makassar 0 dari 7, sesuai). Dikirim ke agen Q-24 untuk ditutup dengan migrasi tambahan, cek struktur yang juga menandai '+08'/tanggal_aman, koreksi data dengan cadangan, dan tes perilaku.
