# Papan kerja dan Poin Beban (F3-01)

Ditulis 1 Nov 2026. Masalah P11 (tugas tidak adil: yang rajin ketiban) dan P02 (kerja lintas topi tidak terlihat). Poin Beban adalah dasar pembagi tugas adil (F3-02), KPI dari jejak, dan Kolam Bonus Beban, jadi angkanya harus bisa dijelaskan dan dikoreksi oleh data nyata.

## Satuan
**1 poin = 15 menit kerja wajar** untuk orang yang biasa memakai topi itu. Dibulatkan ke 0,25 poin; minimum 0,25, maksimum 99 (kolom `kerja.poin_beban numeric(6,2)` sudah ada di migrasi graf_usaha). Menit lebih mudah dijelaskan ke pemilik UMKM daripada "story point" tanpa satuan.

## Tangga estimasi (murah dulu, model terakhir)
1. **Riwayat (0 token):** kerja selesai di usaha yang sama dengan topi sama dan judul mirip. Kemiripan memakai `pg_trgm.similarity` (0 sampai 1, ambang bawaan operator `%` 0,3; https://www.postgresql.org/docs/current/pgtrgm.html, diakses 1 Nov 2026; ekstensi pg_trgm tersedia di proyek). Bila ada minimal 3 kerja serupa dengan kemiripan >= 0,4 dalam 180 hari, estimasi = median durasi nyatanya. Alasan tersimpan, misalnya "Median 5 kerja serupa (cuci piring sore): 40 menit."
2. **Model ringan (sekali, latar):** bila riwayat kurang, Edge Function memanggil model ringan (ID dari `public.konfigurasi`, bukan kode) dengan judul, topi, tanggung jawab topi, dan sampai 5 kerja selesai terdekat beserta durasinya; keluaran terstruktur `{menit, alasan}`. Hasil dikali faktor kalibrasi usaha (di bawah).
3. **Manual:** pemberi kerja boleh menimpa angka; sumber dicatat `manual` dan tetap ikut kalibrasi.

Estimasi disimpan di `kerja.data.estimasi = {menit, poin, sumber: riwayat|model|manual, alasan, faktor, dihitung_at}` dan `kerja.poin_beban`.

## Kalibrasi dari durasi nyata
- Durasi nyata = `selesai_at - mulai_at` dikurangi jeda status `tunggu` (dicatat sebagai kejadian kerja.tunggu/kerja.lanjut). Kerja tanpa `mulai_at` tidak dipakai untuk kalibrasi.
- **Faktor usaha** = median(durasi nyata / menit estimasi model) dari 30 kerja selesai terakhir yang estimasinya dari model, dibatasi 0,5 sampai 2. Dipakai untuk estimasi model berikutnya. Riwayat tidak perlu faktor karena sudah memakai durasi nyata.
- Setiap kerja selesai menyimpan `data.aktual_menit` dan galat relatif; layar kerja menampilkan "estimasi 30 menit, nyata 42 menit".

## Papan
`/app/kerja`: kolom Baru, Jalan, Tunggu, Selesai (hari ini). Pemilik/admin membuat kerja (judul, topi, pelaksana opsional, tenggat). Staf melihat kerjanya sendiri dengan tombol besar Mulai, Tunggu, Selesai (satu tugas per layar, DIRECTION §4). Kerja dikerjakan orang di luar topinya otomatis bertanda lintas topi (trigger yang sudah ada).

## Kriteria terima rinci
- Kerja baru mendapat poin dan alasan; sumber `riwayat` dipakai bila ada >= 3 kerja serupa, tanpa token (tes SQL).
- Mulai dan Selesai mengisi durasi nyata; faktor kalibrasi berubah sesuai data (tes SQL dengan 30 kerja sintetis).
- Papan tampil di 390/1440 terang/gelap, axe bersih; e2e: buat kerja, staf mulai lalu selesai, durasi nyata tampil.
