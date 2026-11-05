# Cara mendengar: efek per kejadian, dibandingkan dengan rujukan (V-14)

Ditulis 6 Nov 2026 setelah Tristan menilai ketikan lama "tidak seperti suara ketikan" dan transisinya "seperti suara animasi busuk".
Kesalahan lama: efek dinilai dari LUFS dan panjangnya saja, dan ketikan adalah satu potongan 1,2 dtk yang diulang.
Cara baru: setiap efek diukur **per kejadian** dengan alat yang sama untuk rujukan dan untuk efek Nadi, lalu keduanya dilihat berdampingan sebagai gambar.

Catatan jujur: aku tidak bisa mendengar. Semua di sini pembacaan sinyal. Penilaian telinga tetap milik Tristan (berkas contoh di bawah, opsional).

## Metode

1. **Pisah stem.** Rujukan dipisah dengan demucs htdemucs menjadi drums, bass, other, dan vocals. Transien UI (klik, ketik) jatuh di stem drums.
2. **Ambil jendela kejadian dari bedah gambar.** Waktu kejadian diambil dari bedah bingkai rujukan 8 (`bedah/orTd3grSYsQ.md`):
   - klik 2,35-2,80 dtk;
   - ketik 10,55-11,05 dtk;
   - "folder meledak" 3,0-3,75 dtk.
3. **Deteksi kejadian** dengan onset strength (hop 2 ms), lalu tiap kejadian diukur:
   - **serangan**: 10% sampai puncak RMS (ms);
   - **ekor**: puncak sampai −20 dB (ms);
   - **centroid** spektrum (Hz);
   - **pita energi** 10-90% (Hz);
   - untuk ketikan: **jarak antarklik** (median dan koefisien variasi).
4. **Gambar berdampingan.** Spektrogram 0-16 kHz dan amplop dB, rujukan di kiri, kandidat di kanan (`dengar/*.png`).
5. **Lolos** bila serangan, pita, centroid, dan panjang ekor sejenis dengan rujukan. Sasaran klik dari GERAK.md: transien 10-20 ms, ekor 20-30 ms, pita 0,5-8 kHz.

Alat: `dengar/mendengar.py` (librosa, matplotlib). Ukuran mentah ada di `dengar/ukur-kandidat.json`, hasil olah di `dengar/ukur-olah.json`.

## Yang terbaca dari rujukan 8

- **Pita atas terpotong tajam di ±10,5 kHz.** Ini tanda kodek/ekspor video. Efek Nadi diberi low-pass curam 10 kHz (Butterworth orde 8) supaya duduk di ruang yang sama dengan musik.
- **Klik:** serangan 6 ms, ekor 12 ms, centroid 5,3 kHz, pita 0,6-8,3 kHz. Klik ganda berjarak ±85 ms.
- **Ketik:** tiap ketukan berpusat ±3,3 kHz dengan tekanan 2-3 kHz, berjarak median 72 ms dan tidak teratur (CV 0,31).
- **Jendela "folder meledak":** bercampur akor musik (garis nada terlihat di spektrogram), jadi bukan efek bersih. Untuk whoosh dipakai pembacaan bedah (desis pita lebar ±650 ms) dan centroid ±2,7 kHz.

## Kandidat (rekaman nyata CC0, freesound lewat Openverse)

| Jenis | Kandidat | Serangan / ekor ms | Centroid Hz | Pita 10-90% Hz | Putusan |
|---|---|---|---|---|---|
| klik | rujukan 8 | 6 / 12 | 5279 | 597-8320 | |
| klik | 534104 mouse-click-double (pbimal) | 6 / 6 | 7346 | 960-9843 | **dipakai**: serangan sama, pita paling dekat |
| klik | 347544 mouse click sounds | 6 / 8 | 8174 | 5309-8859 | ditolak: tipis, tanpa badan di bawah 5 kHz |
| klik | 467490 MacBook trackpad | 8 / 18 | 2163 | 12-550 | ditolak: dentum rendah, bukan klik |
| ketik | rujukan 8 | 10 / 8 | 3262 | 46-3269 | jarak 72 ms |
| ketik | 546164 Keyboard Typing 7, Topre (grcekh) | 6 / 16 | 5397 | 421-6363 | **dipakai**: ketukan paling bersih dan seragam; jarak aslinya 101 ms, jadi disusun ulang |
| ketik | 215744 typing on a laptop keyboard | 6 / 28 | 6193 | 304-10183 | ditolak: ekor panjang, jarak 164 ms |
| ketik | 561102 / 512293 laptop keyboard | 10-12 / 24-43 | 3204-4235 | 46-257 | ditolak: tenaga di bawah 260 Hz (meja) |
| whoosh | 60026 swosh air (qubodup) | 36 / 172 | 1305 | 210-304 | **dipakai** setelah diolah |
| whoosh | 60007 swipe | 26 / 64 | 1698 | 234-515 | ditolak: terlalu pendek |

## Rantai olah dan hasilnya (docs/promo/audio-v2/foley.py)

Rantai: potong satu kejadian → high-pass → low-pass 10 kHz orde 8 → angkat 2,5 kHz → ruang pendek (konvolusi ekor peluruhan, basah −18 dB) → pudar keluar → normalisasi puncak.

| Efek | Rujukan: serangan / ekor / centroid / pita | Hasil olah | Ubahan |
|---|---|---|---|
| klik | 6 / 12 / 5279 / 597-8320 | 12 / 26 / 4309 / 914-7734 | jendela 50 ms, ruang 12 ms |
| ketik (rangkaian uji, jarak 40-90 ms acak) | 10 / 8 / 3262 / 46-3269 | 6 / 20 / 3159 / 421-3562 | 16 ketukan terpisah, dipilih yang kerasnya dalam 6 dB dari median |
| whoosh | ±650 ms, centroid 2702 | 78 / 312 / 2652 / 257-820, panjang 0,98 dtk | diregang 2×, high-pass 600 Hz, +4 dB di 5 kHz |

Lihat `dengar/klik-olah.png`, `dengar/ketik-olah.png`, `dengar/whoosh-olah.png`. Gambar kandidat mentah ada di `dengar/mentah-*.png`.

## Aturan pakai di film (dari pengukuran ini)

- **Ketikan:** satu ketukan per huruf yang muncul, dipilih acak berbenih dari 16 ketukan, kerasnya diacak 0 sampai −3 dB, dan waktunya digeser ±8 ms supaya tidak berirama tetap. Tidak pernah satu potongan yang diulang.
- **Klik:** jatuh 1 bingkai (33 ms) setelah kursor menekan. Klik ganda bila elemen dibuka.
- **Whoosh:** sekali saja, di satu kejadian besar (berkas berjatuhan ke Lempar).
- **Cap:** rekaman cap karet asli setiap kali cap turun (DITERIMA, LUNAS, DITOLAK, kartu akhir).
- **Suara toko nyata** (Supermarket Ambience, neilraouf) di babak masalah dan Mata, di bawah musik.

## Berkas contoh dengar (opsional untuk Tristan)

`docs/promo/audio-v2/contoh-dengar.wav` (7,5 dtk): ketikan, klik ganda, whoosh, cap, notifikasi, kertas. Loop tidak menunggu penilaiannya.

## Batas

- Rujukan diambil dari video terkompresi. Pita di atas 10,5 kHz dan detail transien di bawah 2 ms tidak bisa dibaca.
- Pemisah stem tidak membedakan klik yang ditambahkan editor dari perkusi musik. Bedanya hanya bisa ditebak dari sinkronnya dengan gambar (efek jatuh 0-2 bingkai setelah gambar, perkusi jatuh di ketukan).
