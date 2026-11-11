# Lingkungan dev lokal (X-00, 11 Nov 2026)

Mode tanpa commit: Supabase lokal (npx supabase start, supabase/config.toml, migrasi otomatis dimatikan) + 174 migrasi lewat sh loop/dev-db.sh mengikuti supabase/urutan-produksi.txt (urutan list_migrations produksi; nama berkas repo tidak sama dengan urutan apply). Setiap migrasi satu transaksi (psql -1). Tes: sh loop/dev-test-sql.sh [pola]. Aplikasi: sh loop/dev.sh menyalakan Next di http://localhost:3100 (distDir .next-dev) dengan NEXT_PUBLIC_SUPABASE_URL dan kunci publik Supabase lokal yang dibaca dari `supabase status`; kunci service role dan JWT secret tidak pernah dibaca; process.env menang atas .env.local produksi (docs bawaan Next, Environment Variable Load Order). Bukti 11 Nov: chunk klien memuat http://127.0.0.1:54321 dan 0 kemunculan alamat proyek produksi. Produksi tidak disentuh (list_migrations produksi tetap 173 baris, migrasi mod hanya lokal).

## Hasil tes SQL lama di lokal

```
tes SQL lokal: 104 lulus, 31 gagal

agen_mata.test.sql: tanpa HASIL_TES
akuntansi_lanjutan.test.sql: HASIL_TES 58 | gagal=[ensure_chart: bagan ada setelah dipanggil, panggilan kedua 0]
aturan_ekspor_impor.test.sql: tanpa HASIL_TES
biaya_nyata.test.sql: HASIL_TES 1 | gagal=[blok tes berjalan sampai akhir (23502 null value in column "model" of relation "pemakaian_ai" violates not-null constraint)]
cadangan.test.sql: tanpa HASIL_TES
ekstraktor_bayangan.test.sql: HASIL_TES 5 | gagal=[aturan lama tetap (19 aktif, 2 mati) (0/0)]
gerbang_gaji.test.sql: HASIL_TES 17 | gagal=[S2 rekening ganda tertangkap; alasan menyebut nama pasangan tanpa menuduh; pemilik tetap melihat lima siluman lain (4)]
hak_berhenti.test.sql: tanpa HASIL_TES
hari_ini_q26.test.sql: HASIL_TES 52 | gagal=[tidak ada fungsi public/app memakai current_date selain daftar putih (preview_proposal(uuid), analis_bahan(), app.ukuran_usaha(uuid), app.run_recurring_all(), app.issue_recurring_invoices_all()); tidak ada fungsi public/app memakai pola tanggal UTC setara
invoice_ekspor.test.sql: tanpa HASIL_TES
jurnal_pib.test.sql: tanpa HASIL_TES
jwt_cabut_q21.test.sql: HASIL_TES 17 | gagal=[tidak ada kebijakan baca yang hanya memakai klaim pid/prn/pengelola (serah_butir.serah_butir_baca_ilmu_sendiri, bidang_kustom.bidang_kustom_baca, survei_isi.survei_isi_baca, kategori_klaim.kategori_klaim_baca, uang_harian.uang_harian_baca, fx_rate.fx_rat
keputusan_model.test.sql: tanpa HASIL_TES
klaim_fungsi_q23.test.sql: HASIL_TES 26 | gagal=[tidak ada fungsi public/app yang memanggil app.prn() atau app.pengelola() (1: flow_runs(uuid)); tidak ada kebijakan public/storage yang memakai app.prn() atau app.pengelola() (7: ai_draft.ai_draft_baca_pengelola, ask_log.ask_log_baca, flow.flow_baca, 
kolam_bonus.test.sql: HASIL_TES 63 | gagal=[Sari: 3 poin dari 3 kerja, 33,3%, alasan dari kerja nyata, batas bulan zona usaha ({"nama": "Sari Kolam", "poin": 3.00, "alasan": "Sari Kolam: 3,0 poin dari 3 kerja, 33,3% kolam", "persen": 33.3, "rupiah": 333334, "id_staf": "S001", "kerja_n": 3, "orang_id
langkah_ilmu.test.sql: tanpa HASIL_TES
lempar_saja.test.sql: HASIL_TES 14 | gagal=[konfigurasi terbaca semua anggota]
mitra.test.sql: tanpa HASIL_TES
pantau_kuota.test.sql: HASIL_TES 7 | gagal=[batas kecil (merah sengaja): dua peringatan (Database 63 MB dari 10 MB (665%). Di atas batas, proyek menjadi hanya-baca.); peringatan tidak berulang di hari yang sama (1)] | {"db_byte": 66534619, "db_persen": 12.7, "storage_byte": 0, "storage_persen": 0.0}
pesangon_kontrak_pensiun.test.sql: tanpa HASIL_TES
rasio_baca.test.sql: HASIL_TES 7 | gagal=[urut token terbanyak dulu ({"hari": 7, "jenis": [{"jenis": "cv", "model": 1, "rasio": 0.667, "token": 1800, "aturan": 2, "berkas": 3}], "semua": {"model": 1, "rasio": 0.667, "token": 1800, "aturan": 2, "berkas": 3}})]
rekam_ilmu.test.sql: tanpa HASIL_TES
rekrut.test.sql: HASIL_TES 21 | gagal=[halaman publik: judul, ringkasan, usaha saja ({"buka": true, "kota": null, "jenis": "FULL_TIME", "judul": "Pelayan shift malam", "usaha": "Warung Uji A", "wilayah": null, "gaji_max": null, "gaji_min": null, "dibuat_at": "2026-11-11T10:56:37.572368+00:00", "ring
ringkasan_ai.test.sql: tanpa HASIL_TES
sinyal_beban.test.sql: tanpa HASIL_TES
usaha_demo.test.sql: HASIL_TES 12 | gagal=[penyegaran tidak menambah atau menghapus kejadian (132 132)]
usaha_tamu.test.sql: HASIL_TES 17 | gagal=[usaha contoh terpasang; sesi coba melihat orang usaha contoh saja (0)]
vision_nama.test.sql: tanpa HASIL_TES
wawancara_keluar.test.sql: tanpa HASIL_TES
web_push.test.sql: HASIL_TES 15 | gagal=[kunci publik terbaca oleh pengguna masuk (87 karakter); service_role membaca JWK VAPID (pasangan kunci lengkap); vapid_simpan kedua kali tidak menimpa kunci; kunci publik tetap kunci asli]
zona_q24.test.sql: HASIL_TES 60 | gagal=[tidak ada fungsi public/app memakai Asia/Makassar di luar coalesce(zona_waktu, ...) selain daftar putih (app.zona_sah(text,text)); tidak ada fungsi public/app yang memanggil app.tanggal_aman (WITA tersembunyi) (apply_ai_draft(uuid)); data lama: cadangan korek
```

## Jebakan

- Menghentikan `sh loop/dev.sh` dari latar (TaskStop) di Windows meninggalkan proses node yang tetap memegang port 3100 dan menyajikan kode lama. Sebelum menyalakan ulang, cek `netstat -ano | grep :3100` dan hentikan PID itu.
- Playwright mengosongkan `test-results` setiap kali dijalankan; jalankan spec yang menyimpan tangkapan layar bersamaan (`--workers=1`) bila ingin semua tangkapan tersimpan.

## Pemilahan dan perbaikan (X-21, 11 Nov 2026): 135/135 lulus

Runner: `sh loop/dev-test-sql.sh` kini membungkus setiap tes dengan `begin; ... rollback;` dan mengenali dua bentuk baris hasil (`HASIL_TES ...` dan `<nama>: n/m lulus, gagal=[...]`; 12 tes "tanpa HASIL_TES" sebelumnya ternyata lulus).

| Tes | Penyebab | Perbaikan |
|---|---|---|
| biaya_nyata, keputusan_model, lempar_saja | konfigurasi produksi (model_ai, harga_ai, biaya_platform) diisi di luar migrasi | loop/dev-seed.sql (harga dan biaya disalin dari produksi, ID model diganti nama pengganti) |
| usaha_tamu | usaha contoh mode coba diisi langsung di produksi | seed usaha sintetis kecil dengan id yang sama |
| web_push | kunci VAPID dibuat Edge Function push saat pertama dipakai | loop/dev-vapid.mjs membuat pasangan kunci sekali pakai lokal, dipipa ke psql |
| ringkasan_ai | tes basi: jalur berkas tanpa awalan id usaha melanggar constraint Q-01 (juga gagal di produksi) | jalur diberi awalan usaha |
| ekstraktor_sidik_hidup | tes diakhiri select, bukan raise, sehingga bisa menulis data | diakhiri raise exception; baris sisa lokal dimatikan |
| ekstraktor_bayangan, zona_q24 (data lama) | angka snapshot produksi (19/2 aturan lama, koreksi data lama) | sah juga untuk database baru yang memang tanpa data lama |
| rasio_baca | cek urutan gagal bila hanya ada satu jenis | daftar satu jenis dianggap urut |
| usaha_demo | jumlah kejadian demo 34 basi (produksi sekarang 132) | yang diuji: jumlah tetap setelah penyegaran |
| pantau_kuota | penyimpanan lokal 0 bita, peringatan kedua tidak mungkin | batas penyimpanan menyesuaikan pemakaian nyata |
| akuntansi_lanjutan | ensure_chart dan hitung akun dalam satu pernyataan memakai snapshot sebelum bagan dipasang | dipisah dua pernyataan |
| gerbang_gaji | tes basi: sejak M-10B rekening_hash diisi trigger dari nomor rekening | tes memakai nomor rekening |
| kolam_bonus | app.angka_id satu desimal sejak sinyal_beban (produksi juga "3,0 poin") | ekspektasi tes disamakan |
| rekrut | M-14 menambah bidang JobPosting publik | dicek isi + daftar bidang publik, bukan kesamaan persis |
| jwt_cabut_q21, klaim_fungsi_q23 | **temuan keamanan nyata (juga di produksi):** 18 kebijakan baca baru hanya bersandar klaim JWT, flow_runs memakai klaim prn | migrasi 20261111130000_klaim_sisa_x (anggota_aktif); mod_record_baca diperbaiki di migrasi mod |
| hari_ini_q26, zona_q24 | **temuan nyata:** apply_ai_draft memundurkan tanggal mulai jabatan satu hari (tanggal_aman +08 dibaca UTC); preview_proposal dan ukuran_usaha memakai current_date | migrasi 20261111131000_tanggal_zona_x; prefilter cron, pengisi demo, dan daftar zona sah diberi komentar "sengaja" dan masuk daftar putih tes |

Dua migrasi temuan nyata hanya ada di lokal (mode tanpa commit); diterapkan ke produksi setelah penilaian juri selesai.
