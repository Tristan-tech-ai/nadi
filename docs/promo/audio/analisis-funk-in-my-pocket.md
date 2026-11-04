# Analisis musik video promo D-21

Dibaca dan diukur 5 Nov 2026. Lima kandidat instrumental dari Jamendo lewat Openverse (api.openverse.org/v1/audio, filter license=by, source=jamendo, category=music), diunduh dari tautan file Openverse untuk dianalisis di scratchpad (tidak disimpan di repo).

Alat: librosa 0.11.0 (beat_track, onset_strength, agglomerative 8 bagian pada MFCC), ffmpeg ebur128. Skrip: analisis di scratchpad loop, ringkasannya di tabel ini.

| Lagu | Pencipta | Halaman | Lisensi | Tempo (BPM) | Kestabilan ketukan (CV jarak ketukan, kecil = rapi) | Awal jendela 55 dtk terbaik (dtk) | Dinamika (RMS p95/p10) | Kenyaringan utuh (LUFS) |
|---|---|---|---|---|---|---|---|---|
| OptiKill - Funk in my Pocket | OptiKill | https://www.jamendo.com/track/1715120 | CC BY 3.0 | 129.2 | 0.034 | 61.23 | 6.5 | -11.8 |
| Super Power Pop Rock | Kara Square | https://www.jamendo.com/track/1163228 | CC BY 3.0 | 107.7 | 0.044 | 118.31 | 17.7 | -12.4 |
| D-Funk Express | Doctor Frost | https://www.jamendo.com/track/1497577 | CC BY 3.0 | 117.5 | 0.016 | 68.17 | 2.4 | -9.4 |
| East Side Bar (Instrumental) | Josh Woodward (Instrumental Versions) | https://www.jamendo.com/track/626396 | CC BY 3.0 | 95.7 | 0.032 | 52.24 | 4.1 | -13.2 |
| Trivial Call | Blue Dot Sessions | https://www.jamendo.com/track/1365386 | CC BY 3.0 | 95.7 | 0.1 | 55.29 | 13.8 | -15.6 |

## Pilihan: Funk in my Pocket (OptiKill)

- Tempo 129,2 BPM: 1 bar = 1,8576 dtk, jadi 28 bar = 52 dtk pas untuk video di bawah 60 dtk dan setiap potongan adegan jatuh di garis bar.
- Ketukan rapi (CV 0,034) dengan energi tinggi; D-Funk Express lebih rapi (0,016) tetapi dinamikanya datar (2,4) dan sangat keras (-9,4 LUFS), terasa seperti musik klub.
- Lagu ukulele (Trivial Call) terlalu pelan dan ketukannya longgar (CV 0,1) untuk kursor dan cap yang mengikuti ketukan.
- Jendela energi tertinggi dimulai 61,23 dtk dan tidak melewati batas bagian (30,2 sampai 121,9 dtk), jadi tidak ada perubahan bagian di tengah video.
- Downbeat dicari dari kuat onset per fase 4 ketukan: fase 0, ketukan pertama yang terdeteksi 2,39 dtk dalam jendela, jadi musik dimulai 61,762 dtk agar bar pertama jatuh di detik 0.

## Campuran (docs/promo/audio/campur.py)

- Efek suara dibuat sendiri dengan ffmpeg: sapu, kertas, dentum, klik, taruh, cetak, cap, geser, tik, ketuk. Diolah dengan lapisan (amix beberapa pembangkit), EQ (equalizer, highpass, lowpass, bandpass), pitch (frekuensi meluncur di aevalsrc, asetrate untuk tik), kompresi (acompressor), dan gema (aecho).
- Puncak tiap efek dikalibrasi ke sasaran: aksen (cap, dentum, ketuk) sekitar 4 dB di atas puncak musik, efek kecil (kertas, klik, tik, cetak) di bawahnya.
- Musik -6 dB, ditekan di bawah efek dengan sidechaincompress (rasio 3, attack 5 ms, release 150 ms), memudar 1,6 dtk di akhir.
- loudnorm dua langkah ke -14 LUFS dan TP -1,5, diukur ulang dengan ebur128=peak=true pada berkas akhir.

| Berkas | LUFS terintegrasi | True peak (dBTP) |
|---|---|---|
| docs/promo/nadi-promo.mp4 (52,0 dtk) | -14,1 | -1,3 |
| docs/promo/teaser-15.mp4 (14,9 dtk) | -14,1 | -1,4 |
| docs/promo/fitur/lempar.mp4 | -13,8 | -3,8 |
| docs/promo/fitur/feed.mp4 | -14,1 | -1,9 |
| docs/promo/fitur/mata.mp4 | -13,8 | -3,9 |
| docs/promo/fitur/sarapan.mp4 | -13,8 | -2,4 |
