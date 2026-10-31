# Kapasitas Supabase Free: angka terukur (Q-02)

Diukur 1 Nov 2026 di proyek produksi (Supabase Free, compute Nano, Singapura). Menggantikan perkiraan di `docs/PLAN.md` ("±50 perusahaan × ±15 orang, DB 500 MB dan egress 5 GB mentok duluan"). Kesimpulannya berbeda: **yang mentok duluan adalah storage 1 GB karena foto nota**, bukan database.

Kuota Free (https://supabase.com/docs/guides/platform/manage-your-usage/egress, diakses 1 Nov 2026): egress 5 GB tak tercache + 5 GB tercache per bulan; DB 500 MB dan storage 1 GB dari halaman harga (loop/LEARN.md, 30 Okt 2026).

## 1. Database: byte per baris (terukur)

`supabase/tests/kapasitas.load.sql` mengisi 50 usaha sintetis × 15 orang (absen masuk dan pulang 30 hari, 2 izin per orang, slip gaji satu bulan, 1 usulan nota per hari) di satu transaksi yang dibatalkan, lalu membandingkan ukuran tabel sebelum dan sesudah (heap + indeks + TOAST, semua partisi). Lama pengisian 8,2 detik.

| Tabel | Baris uji | Tambahan | Byte per baris |
|---|---|---|---|
| kejadian (absen, izin) | 46.500 | 15,0 MB | **338** |
| usulan (nota) | 1.500 | 0,84 MB | **584** |
| audit_log | 1.500 | 1,42 MB | **994** |
| slip_gaji (6 komponen) | 750 | 0,81 MB | **1.136** |
| orang | 750 | 0,18 MB | **251** |
| perusahaan | 50 | 8 KB | 164 |

Satu usaha 15 orang per tahun, dengan retensi yang sudah terpasang (kejadian 90 hari, audit 180 hari):
- kejadian: 15 × 2 absen × 90 hari ≈ 2.700 baris × 338 B ≈ **0,9 MB** (tetap, karena partisi lama dibuang);
- usulan: 30 per bulan × 12 × 584 B ≈ 0,2 MB per tahun;
- slip: 15 × 12 × 1.136 B ≈ 0,2 MB per tahun;
- audit: ±180 baris × 994 B ≈ 0,2 MB (tetap).

Jumlah ±1,5 MB per usaha di tahun pertama. Database kosong (skema, fungsi, data uji sekarang) 22 MB. Dengan batas 500 MB: **±300 usaha** di tahun pertama. Database bukan batas pertama.

Kecepatan di tengah muatan 50 usaha (EXPLAIN ANALYZE, satu usaha): Feed (20 usulan menunggu teratas) **0,05 ms**; rekap absen 30 hari per orang **1,1 ms**.

## 2. Storage: ukuran berkas (terukur)

| Berkas | Ukuran terukur | Sumber |
|---|---|---|
| Foto nota HP 3120×4160, 3,3 MB, setelah kompresi aplikasi (sisi 2000 px, JPEG 0,85) | **289 KB** | foto domain publik "Grocery Store Receipt in Vienna" (Wikimedia Commons), dikompres di Chromium dengan kode yang sama seperti `siapkanFoto` |
| Varian: 1600 px JPEG 0,8 / 1600 px 0,7 / 1280 px 0,7 | 162 / 118 / 85 KB | sama |
| Jawaban wawancara suara (webm Opus bawaan Chromium) | **84 KB per 6 detik (±112 kbps)**, jadi jawaban 90 detik ±1,3 MB | 19 berkas di bucket produksi |
| CV PDF | 44 KB | 41 berkas uji |
| CSV / XLSX | 1-8 KB | berkas uji |

Satu warung yang melempar 5 foto nota sehari: 150 × 289 KB ≈ **43 MB per bulan**. Dengan 1 GB, **50 usaha seperti ini memenuhi storage dalam ±2 minggu**; satu usaha saja dalam ±2 tahun. Pelamar yang menjawab 5 pertanyaan suara penuh memakai ±6,5 MB.

Batas pertama yang nyata adalah storage. Penghematan yang diantrekan (dengan kriteria terima, agar akurasi tidak turun diam-diam):
- **Q-02B**: foto ke 1600 px JPEG 0,7 (118 KB, hemat 59%) hanya bila eval foto nota tetap 5/5 (docs/quality/eval-ekstraktor.md).
- **F2-03B (selesai 1 Nov 2026)**: rekaman suara Opus 32 kbps. WER korpus whisper-small: WAV asli 0,43, Opus 32 kbps 0,4286, Opus 24 kbps 0,448 (24 kbps ditolak karena di e2e Chromium kata kunci "pelayan" salah dengar). Terukur di produksi: 6,1 detik = 22 KB (29 kbps), sebelumnya 90 KB (118 kbps); jawaban 90 detik ±330 KB.

Sesudah keduanya: 5 nota sehari ≈ 18 MB per bulan per usaha; pelamar 5 jawaban suara penuh ±1,6 MB. Usaha yang aktif melempar foto tetap butuh paket berbayar setelah beberapa puluh usaha; itu keputusan pembayaran Tristan, dicatat di sini sebagai angka, bukan permintaan.

## 3. Egress (sebagian terukur)

- Halaman aplikasi (/app, /app/orang, /app/gaji, /app/izin) **tidak memanggil Supabase dari peramban**: diukur dengan Chromium di produksi, 0 byte ke supabase.co. Semua data diambil server Next di Vercel; respons itu yang dihitung sebagai egress database Supabase.
- Ukuran respons kueri Feed (12 usulan, kolom yang dipakai halaman): **7,9 KB**; daftar 42 orang: 5,6 KB. Diukur dengan `octet_length(json_agg(...))` di database (tanpa kompresi; byte di kabel bisa lebih kecil).
- Log edge Supabase belum memuat byte respons (dokumen egress di atas), jadi egress per pengguna belum bisa dibaca langsung dari log. **Perkiraan** (belum terukur): pemilik membuka Feed dan 2-3 halaman lain ±20 kali sehari × ±15 KB ≈ 9 MB per bulan; 15 staf absen 2 kali sehari × ±5 KB × 26 hari ≈ 4 MB per bulan. ±15 MB per usaha per bulan, jadi 5 GB cukup untuk ±300 usaha. Klip wawancara yang diputar penilai menambah egress storage seukuran berkasnya.
- Lalu lintas ke Vercel (bukan kuota Supabase): masuk + Feed pertama dengan cache kosong 313 KB; muat ulang /app/izin 95 KB, /app/orang 22 KB.

## Cara mengulang
1. Jalankan isi `supabase/tests/kapasitas.load.sql` lewat execute_sql; hasil ada di pesan `HASIL_MUAT {...}`, data dibatalkan.
2. Ukuran berkas: `select split_part(name,'/',2), metadata->>'mimetype', count(*), avg((metadata->>'size')::bigint) from storage.objects group by 1,2`.
3. Foto: kompres foto HP mana pun dengan `siapkanFoto` (pelempar.tsx) dan catat ukurannya.
