# Paket audio v2 (V-05), dibuat ulang dari foley nyata 6 Nov 2026

Semua efek berasal dari **rekaman nyata** berlisensi CC0 (freesound lewat Openverse). Sumber dan lisensi tiap rekaman tercatat di `docs/ASSETS.md`.
Rekaman mentah tidak masuk repo. `foley.py` mengolahnya ulang dengan resep yang sama setiap kali:

```
python foley.py <folder_rekaman_mentah>
```

Cara menilai tiap efek terhadap rujukan: `../riset-video/MENDENGAR.md`. Rantai olah: `../riset-video/SUARA.md` bagian 5.
Versi sebelumnya (klik Commons, dentum mesin, ketikan satu potongan yang diulang) dibuang setelah Tristan menilainya tidak seperti ketikan dan seperti animasi murahan.

| Berkas | Dari rekaman | Olah singkat | Puncak |
|---|---|---|---|
| ketik-00..15.wav | Keyboard Typing 7, Topre (grcekh, 546164) | 16 ketukan terpisah yang kerasnya mirip, 70 ms, pita 350 Hz-10 kHz, +3 dB 2,5 kHz | −6 dBFS |
| klik.wav | mouse-click-double-00 (pbimal, 534104) | 50 ms, pita 300 Hz-10 kHz, +3 dB 2,5 kHz, ruang 12 ms | −3 dBFS |
| cap.wav | 17_stamp, rubber, plastic (15FPanska_KristynaHaupt, 461888) | 350 ms, high-pass 60 Hz, +3 dB 180 Hz, ruang 40 ms | −2 dBFS |
| whoosh.wav | Swosh swoosh whoosh air sound (qubodup, 60026) | diregang 2×, high-pass 600 Hz, +4 dB 5 kHz | −4 dBFS |
| notifikasi.wav | paper3 (florian_reinke, 63512) | high-pass 400 Hz, +2 dB 2,5 kHz | −8 dBFS |
| kertas.wav | Paper sheets (paulocorona, 334994) | 600 ms, pita 200 Hz-10 kHz | −8 dBFS |
| lempar.wav | whoosh + kertas mendarat +320 ms | komposit | −3 dBFS |
| transisi.wav | whoosh −3 dB | komposit, lirih | −6 dBFS |
| sonic-logo.wav | kertas bergeser, cap mendarat di 0,55 dtk, ruang 1,2 dtk | komposit, 2,0 dtk | −3 dBFS |
| toko.wav (tidak di repo) | Supermarket Ambience (neilraouf, 617520) | 50 dtk, pita 80 Hz-9 kHz | −14 dBFS |
| contoh-dengar.wav | rangkaian 7,5 dtk semua efek | untuk didengar Tristan (opsional) | |

## Pakai di film

`docs/promo/demo-v3/campur.py` menaruh efek dari timeline film. Hasil mix dan uji potongan 20 dtk ada di `docs/promo/demo-v3/audio.json` dan CATATAN.md.
