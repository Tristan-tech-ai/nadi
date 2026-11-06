# Catatan kerja film v4 (baca dulu setelah kompaksi)

Arahan Tristan 6 Nov 2026 siang: video v3 terasa murah dan membingungkan; buat ulang total dengan cerita koin dari Tristan (STORY.md) memakai skill github Barty-Bart/motion-graphics (CARA.md). Tugas V-20 dan V-21 done; V-22 (bangun), V-23 (suara), V-24 (final) berjalan.

## Berkas
- `build.py`: menyusun `index.html` dari `film.css`, bagian skrip `BAGIAN` (film.js, film-d.js, film-f.js, film-i.js, film-akhir.js), dan potongan DOM asli dari `../demo-v3/assets/app/*.html` sebagai `<template id="f-...">`. Font Jakarta dan font aplikasi ditanam base64.
- `film.js`: helper skill, `babak(t0,t1,lapisan,fn)`, koin (`KOIN_TAMBAH` untuk babak berikutnya mengambil alih koin), babak A (berkas berputar), B (terowongan harga), C (koin, kotak Lempar, riak).
- `film-d.js`: alat UI (`pasang`, `bidik`, `stabilo`, `cariTeks`, `tutupSisi`, kursor `KLIK`, `cap`, `adeganKalimat`, `lapisUI`), babak D (membaca, rincian, setujui) dan E (koin menggelinding membuka kalimat, obrolan AI, tinjau draf, Terapkan).
- `film-akhir.js`: `seek`, pratinjau; `window.VIDEO.duration = DUR` (DUR dinaikkan tiap berkas babak).
- `render.mjs`: dari skill (MIT), Playwright diambil dari apps/web.

## Perintah
- `python -I build.py`
- galat muat: `node <scratchpad>/galat.mjs index.html`
- stills: `node render.mjs index.html cekN.png --stills t1,t2,...` lalu lihat PNG-nya
- draf: `node render.mjs index.html draf.mp4 30 1 8`

## Pelajaran (jangan diulang)
- `.dunia` wajib `transform-origin: 0 0` (pola translate-scale-translate).
- Anak lapisan jangan diberi `visibility: visible`; pakai `inherit`. Kalau tidak, lapisan yang disembunyikan tetap tampil dan keadaan terbawa dari bingkai lain (melanggar kontrak seek).
- Teks putih di atas berkas putih tidak terbaca: jauhkan berkas dari pita kalimat.
- `ukur.json` bisa meleset satu baris. Kotak sorot diukur dari DOM dengan `cariTeks(f, teks, ke, akar)`, dan dicari di dalam kartu yang benar, karena potongan Feed memuat beberapa kartu.
- `feed-tutup.html` tidak ada. Feed memakai `feed-rincian`, dengan kamera mulai di judul kartu lalu turun.
- Draf AI asli: 15 baris, 10 tercentang, Budi Santoso ganda 60% perlu dicek, gaji tidak dicentang, tombol "Terapkan 10 baris". Obrolan dibuat cocok dengan data ini.

## Status (6 Nov 2026 siang)
- A sampai E (0-91 dtk) sudah dibangun dan ditinjau per still.
- BERIKUTNYA:
  - F tagihan QRIS (invoice-publik, cap LUNAS) dan G gaji (gaji-draf, DITAHAN dengan alasan asli).
  - H otomasi konkret (alur: invoice lunas lalu kerja Kirim pesanan, tiga kali), tanya data.
  - I kamera (CCTV asli pasar.mp4 sebagai urutan JPG + jejak.json + gambar.js, lalu angka ke peta panas).
  - J belajar format (struk SPBU ditolak, AI mencerna, pemindai baru diperiksa, struk berikutnya Rp0).
  - K tiga perangkat (hari-1440/768/390), L penutup logo.
- Sesudah itu: draf 30 fps, suara (V-23: skill sound-effects, efek CC0 dari mg-repo/skills/sound-effects/sfx, musik Mixkit), final.
- Klon skill: `<scratchpad>/mg-repo` (commit 3d83d98).
