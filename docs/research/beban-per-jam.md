# Beban per jam kerja: perlukah, dan dari mana jamnya

Ditulis 1 Nov 2026 (tick 192), saat Q-27 dikerjakan agen. Sumber: definisi hidup app.beban_orang (pg_get_functiondef, dibaca tick 192), docs/research/pola-kerja.md (Q-22), docs/design/rata-rata-beban.md.

## Fakta
- `app.beban_orang` mengembalikan kolom `jam` = **`40::numeric` tetap untuk setiap orang**. Tidak ada sumber jam per orang.
- Kalimat pemilik "Sari memikul 31% kerja minggu ini dengan 20% jam kerja" (kalimatTerberat, lib/kerja/adil.ts) membagi jam yang semuanya 40. Akibatnya "porsi jam" selalu sama dengan 1/jumlah orang aktif. Di Warung Uji A (50 orang aktif) setiap orang punya porsi jam 2%. Angka itu bukan jam kerja sungguhan.
- Kelompok `o` = orang `status = 'aktif'` berjenis karyawan atau magang, tanpa melihat apakah mereka bertopi atau bekerja minggu itu.
- Pola kerja (6x7 jam atau 5x8 jam) belum punya satu sumber per usaha. Itu tugas Q-22. Jam per orang dari jadwal shift baru ada setelah F3-06 (docs/research/shift-f3-06-sql.md, app.jam_jadwal).
- **Temuan kecil:** fungsi ini masih memakai `coalesce(p.zona_waktu, 'Asia/Makassar')`. Cadangan itu tidak pernah terpakai karena kolom perusahaan.zona_waktu NOT NULL dengan bawaan 'Asia/Jakarta', dan cek struktur Q-24 mengizinkan pola coalesce ini. Tidak berdampak, tetapi tidak searah dengan app.zona yang memakai cadangan Asia/Jakarta. Bisa dirapikan saat fungsi ini disentuh berikutnya.

## Jawaban: poin per jam belum layak dipakai sekarang
1. **Pembaginya palsu.** Dengan jam 40 untuk semua orang, "poin per jam" sama dengan poin dibagi 40. Tidak ada informasi baru, hanya angka yang tampak lebih ilmiah.
2. **Pegawai paruh waktu dirugikan.** Bila nanti jam diisi dari jadwal, poin per jam memang lebih adil: orang 20 jam dengan 10 poin sama beratnya dengan orang 40 jam dengan 20 poin. Tetapi itu baru jujur setelah jam berasal dari jadwal (F3-06) atau absen nyata (absen.masuk/pulang), bukan dari angka tetap.
3. **Q-27 memakai poin mentah** dengan kelompok pembanding yang benar. Itu jujur untuk sekarang. Layar menyebut "poin", bukan "per jam".

## Usulan urutan
- **Sekarang (Q-27):** poin mentah, kelompok = pemakai papan kerja, ambang 1,5x dan selisih 4 poin.
- **Setelah Q-22:** kolom jam = jam sepekan dari pola usaha (42 atau 40), masih sama untuk semua orang, jadi tetap tidak dipakai sebagai pembagi.
- **Setelah F3-06:** jam = jam terjadwal minggu itu (app.jam_jadwal). kalimatTerberat menyebut jam sungguhan ("dengan 18 dari 160 jam terjadwal"), dan beban_saya boleh menambah perbandingan per jam bila jadwal orang itu ada. Orang tanpa jadwal tetap dibandingkan dengan poin mentah.
- **Kriteria kalimatTerberat** ditambahkan ke F3-06: bila jam masih 40 tetap untuk semua orang, kalimat tidak menyebut persen jam, cukup "Sari memikul 31% kerja minggu ini". Dicatat sebagai bahan tugas, bukan diubah sekarang.

## Yang tidak diubah tick ini
Tidak ada perubahan kode atau migrasi. Agen Q-27 sedang mengubah public.beban_saya dan lib/kerja/adil.ts, jadi temuan kalimatTerberat ditahan agar tidak bentrok.

## Koreksi setelah membaca components/app/beban.tsx (tick 192)
Kartu pemilik sudah menampilkan keterangan jujur saat jam belum diatur (testid jam-sama-rata): "Jam kerja belum diatur, jadi semua orang dianggap punya jam yang sama (40 jam seminggu)." Kalimat kepala "dengan 2% jam kerja" jadi tidak menyesatkan diam-diam, karena keterangannya ada tepat di bawahnya. Q-28 tetap di antrean sebagai perbaikan kejelasan: kalimat kepala tidak perlu memuat angka yang sudah diakui sebagai anggapan. Dampaknya kecil, dan dikerjakan setelah Q-27.
