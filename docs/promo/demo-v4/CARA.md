# Cara membuat film demo v4

Sumber: skill `Barty-Bart/motion-graphics`, commit 3d83d98 (13 Okt 2026, MIT), dibaca utuh 6 Nov 2026: README, `explainer-engaging`, `explainer-default`, `explainer-high-energy`, `sound-effects` (SKILL + MUSIC). Contoh GIF di `docs/` repo itu juga ditonton per bingkai. Arahan Tristan 6 Nov 2026: buat ulang total mengikuti repo ini, dengan cerita koin dari Tristan (STORY.md).

## Gaya yang dipakai

Film ini menggabungkan tiga gaya skill:
- **explainer-engaging** untuk tulang punggung. Satu benda pahlawan (koin) berjalan melewati stasiun alur kerja. Kamera mengikutinya tanpa potongan, lalu menarik mundur untuk memperlihatkan seluruh perjalanan.
- **explainer-default** untuk babak fitur. Kanvas terang dan lapang, satu baris teks pendek per adegan, kamera mendorong masuk ke teks. UI Nadi dibangun ulang bersih sebagai lapisan dan difilmkan dari dekat saat dipakai (mengetik, hasil, klik).
- **explainer-high-energy** untuk pembuka. Berkas berputar, terowongan harga, lemparan koin. Transisinya berupa benda, bukan potongan.

## Aturan teknis (kontrak halaman)

- Satu `index.html`, `window.VIDEO = {w: 1920, h: 1080, duration}`.
- `window.seek(t)` adalah fungsi murni dari waktu:
  - tanpa transisi atau animasi CSS, tanpa `setTimeout`, tanpa keadaan dari bingkai sebelumnya;
  - acak hanya dari generator berbenih;
  - kamera yang butuh riwayat dipanggang sekali saat dimuat (langkah 1/240 dtk), lalu dibaca balik.
- Font ditanam base64: Plus Jakarta Sans OFL, font aplikasi Nadi.
- `?render` berarti panggung tepat 1920×1080 tanpa kontrol.
- Kamera adalah pembungkus dengan `translate/scale/rotate`, digerakkan `kf` (keyframe ber-ease) atau `track` (spring).
- Spring kamera teredam berat (z ≥ 0,95). Tidak memantul, kecuali benturan koin (squash 1,25 × 0,8 sekitar 60 ms).
- Pergantian adegan memakai gerak kamera atau larutan kabur 0,3-0,4 dtk di kanvas polos. Tanpa potongan keras dan tanpa pudar ke hitam.
- Satu baris teks ditambah satu elemen UI per layar. Teks dan UI hampir tidak pernah berbagi bingkai.
- Kecepatan:
  - mengetik sekitar 25 huruf per detik;
  - jeda 0,5 dtk setelah setiap hasil;
  - judul ditahan sekitar 2 dtk.
- Kursor panah, bergerak melengkung, tiba sesaat sebelum klik, menekan sedikit, lalu riak lembut.
- Kabur dan gradien besar digambar ke kanvas sekali saat dimuat, bukan `filter: blur()` CSS (lambat dipotret).
- **Dilarang:**
  - fakta karangan (jumlah pengguna, testimoni);
  - emoji;
  - bayangan besar;
  - kaca buram di mana-mana;
  - lebih dari satu warna aksen;
  - easing memantul untuk UI.

## Pemeriksaan dan render

1. **Stills:** `node render.mjs index.html cek.png --stills t1,t2,...`, satu waktu per baris beat sheet. Lembar dilihat, dan yang terpotong, bertumpuk, tak terbaca, atau kosong diperbaiki. Termasuk UI yang melewati kotaknya, seperti papan Mata di v3.
2. **Draf:** `node render.mjs index.html draf.mp4 30 1 <inti>`, tanpa motion blur.
3. **Final:** `node render.mjs index.html final.mp4 60 4 <inti>`, motion blur 4 subframe dengan rana 180 derajat.

## Suara (skill sound-effects)

- **Efek:** tanpa bunyi sintetis sama sekali. Semua efek rekaman nyata CC0 dari pustaka skill (`sfx/kit`: whoosh, click, pop, riser, impact, tick), satu bunyi per cue, dengan takes bervariasi.
- **Cue list:** `cues.json` dari timeline. Pemetaan per gerakan:
  - gerak kamera atau whoosh dimulai 2 bingkai lebih awal;
  - muncul: pop;
  - klik: click;
  - ketik: typing;
  - riser berakhir tepat di pukulan;
  - reveal: impact.
- **Ketukan:** beat grid musik diperiksa dengan librosa, low-pass di bawah 120 Hz lalu dibandingkan dengan kick. Potongan besar ditaruh di ketukan dan galatnya dilaporkan dalam ms.
- **Campuran:** musik sekitar -12 dB di bawah efek. Target -16 LUFS terintegrasi dan true peak < -4 dBFS, diukur pada MP4 akhir (stereo dan mono).
- **Bukti:** bingkai sebelum dan sesudah setiap cue plus gelombang suaranya. Lima titik waktu paling berisiko diserahkan ke Tristan untuk didengar dengan headphone. Aku tidak menilai "sudah enak".
- **Musik:** lagu berlisensi jelas. Mixkit Stock Music Free License, diunduh saat dipakai dan tidak di-commit, atau lagu CC BY yang sudah dicatat di ASSETS. Lisensi dicek ulang di halaman sumbernya saat dipakai.
