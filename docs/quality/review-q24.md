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

## Verifikasi loop setelah commit agen (tick 181, sebelum laporan akhir agen)
Commit 9042ed8 + 11f2bbb, ter-push oleh loop di fe800b9. Kueri loop sendiri (execute_sql):
- 'Asia/Makassar' di luar coalesce zona_waktu: hanya app.isi_demo dan app.ukur_kuota (daftar putih).
- Fungsi public/app yang memakai app.tanggal_aman atau '+08': tidak ada (null).
- uang.keluar sumber lempar di usaha Asia/Jakarta pada 23.00 lokal: 0 (sebelumnya 20/20).
- kejadian izin.* usaha berzona selain WITA pada 23.00 lokal: 0 (sebelumnya 44/44).
- Cadangan audit_log aksi koreksi_zona_q24: 116 baris.
- Sidik: zona_usaha_q24 b22530bf, waktu_lokal_q24 2b7f4b84, berkas = database; 55 migrasi.
Belum: tes zona_q24 + regresi dijalankan pihak terpisah, get_advisors, Vercel READY + e2e produksi.

## Laporan akhir agen dan langkah loop (tick 182)
- Commit ketiga 839adc3: dua harapan '+08' di putuskan_usulan.test.sql diganti '+07' (harapan lama mengunci bug WITA untuk usaha Asia/Jakarta). Sah.
- Laporan agen: zona_q24 merah lalu 60/60; regresi 15 berkas gagal=[]; koreksi 81 kejadian (44 izin.sakit, 17 izin.batal, 20 uang.keluar) + 35 baris ringkasan_harian = 116 cadangan (cocok dengan kueri loop).
- Loop: Vercel READY fe800b9; e2e produksi izin.spec + magang.spec lulus 2/2 (41,8 dtk); hak execute empat pembantu baru (zona, hari_ini, tanggal_teks, waktu_lokal): anon false, authenticated false. zona_q24, putuskan_usulan, gerbang_gaji dijalankan ulang oleh agen pembantu terpisah (hasil dicatat saat datang).
- Sisa dari laporan agen: current_date (UTC) di app.beban_orang, app.hitung_lintas_topi, app.pasang_topi_dari_jabatan, simpan_rencana_magang, bawaan pakai_topi.mulai -> Q-26; lapisan aplikasi -> Q-25 (dikirim ke agen baru).
