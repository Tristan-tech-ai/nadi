# Paket audio v2 (V-05)

Tujuh efek dan satu sonic logo untuk video demo V-07, dibuat ulang setiap kali dari bahan mentah berlisensi bebas dengan `buat.py`. Fungsi olahnya ada di `../audio/olah.py`, risetnya di `../riset-video/SUARA.md`. Sumber dan lisensi tiap bahan mentah tercatat di `docs/ASSETS.md` dan di `SUMBER` di dalam `buat.py`. Lagu dasar tidak masuk repo; buat.py memotongnya dari berkas yang diunduh ulang dari URL resminya.

| Berkas | Resep singkat (lengkap di buat.py) | dBTP | Dtk |
|---|---|---|---|
| klik.wav | klik CC0, transien 0,12 dtk, highpass 150 Hz, +3 dB 4 kHz, kompresi 4:1, ruang 12% | −3,0 | 0,72 |
| ketik.wav | ketikan CC0 terpadat 1,2 dtk, pita 250 Hz-10 kHz, kompresi 2,5:1 | −3,0 | 1,20 |
| cap.wav | klik −3 semitone + dentum mesin lowpass 400 Hz (+8 ms) + ekor RT60 0,8 dtk, lem 3:1 | −3,0 | 1,56 |
| lempar.wav | whoosh CC0, lalu kertas mendarat di +320 ms, ruang 15% | −3,0 | 1,32 |
| notifikasi.wav | dua ketuk lembut (klik +5 semitone, lowpass 5 kHz) berjarak 90 ms. Bukan nada sintetis | −3,0 | 0,75 |
| transisi.wav | swipe CC0, highpass 250 Hz, +2 dB 5 kHz | −3,0 | 1,05 |
| sonic-logo.wav | kertas menggeser, lalu cap mendarat di 0,55 dtk, reverb RT60 1,4 dtk, 2,0 dtk | −3,0 | 2,00 |

## Uji potongan 20 dtk (6 Nov 2026, diukur ffmpeg ebur128)

- Bed: lagu dasar mulai 15 dtk (bagian penuh pertama), 117 BPM, fade masuk 0,4 dtk dan keluar 1,5 dtk.
- Delapan efek ditaruh di bingkai 30 fps yang jatuh pada ketukan ke-4, 8, 10, 16, 20, 28, 32, dan 34. Bingkainya dihitung dari indeks ketukan, bukan dijumlah berulang.
- Setiap efek digeser maju sebesar letak serangannya sendiri, supaya bunyi tiba satu bingkai setelah gambarnya.
- Hasil: −20,5 LUFS / −3,9 dBTP sebelum, **−14,2 LUFS / −1,5 dBTP** sesudah normalisasi dua lintasan.
- Serangan efek di jalur efek terukur 18,7-33,8 ms setelah bingkai gambarnya (sasaran 0-67 ms, satu bingkai = 33,3 ms). Angka per efek ada di `laporan.json`.

Diukur, bukan didengar. Akhir lagu dan titik loop perlu didengar Tristan sebelum V-07 dirilis.
