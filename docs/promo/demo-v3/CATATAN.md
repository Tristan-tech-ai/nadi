# Video demo Nadi v3: catatan kerja (baca dulu setelah kompaksi)

Dimulai 6 Nov 2026 atas perintah Tristan: "usahakan mulai membuat video dulu … catat semua hal yang sudah di pelajari dan yang wajib di baca atau di tonton lagi … tambahkan Audio setelahnya, footage bisa keep placeholder". Bagian lain repo Nadi yang tidak berhubungan dengan video tidak dikerjakan sampai video ini jadi.

## Wajib dibaca lagi (urut)

1. `docs/promo/riset-video/GERAK.md`: pola lintas 8 rujukan dan keputusan film Nadi. **Paling penting.**
2. `docs/promo/riset-video/UJI-GERAK.md`: enam kesalahan uji gerak pertama, yang wajib tidak terulang.
3. `docs/promo/riset-video/bedah/orTd3grSYsQ.md` (rujukan 8, vibe yang dipilih Tristan) dan `bedah/yRc5HcGJ-Cs.md` (rujukan 4, paling dekat dengan arah Nadi).
4. `bedah/wwIt5ZvROrs.md` (rujukan 7: pemindaian invoice dan persetujuan) dan `bedah/awUYikrGsKk.md` (rujukan 5: bukti belajar).
5. `bedah/xNUx-rMGvvw.md` (rujukan 1: isolasi fokus dan morph) dan `bedah/k3d_xeVxEOE.md` (rujukan 3: karakter berulang, suara ketik bernada, sunyi).
6. `docs/design/DIRECTION.md`, `ANTI-SLOP.md`, `VOICE.md`: warna kertas/tinta/kunyit/cap/daun, huruf Plus Jakarta Sans/Bricolage/Plex Mono, tanpa UI miring 3D, tanpa gradien ungu.
7. `docs/promo/demo-v2/STORYBOARD.md`: isi babak lama (fitur dan aset). Gaya geraknya usang dan diganti GERAK.md.
8. Memori `feedback-video-taste`: penilaian Tristan dan cara menonton dan mendengar yang benar.

## Wajib ditonton lagi bila ragu soal rasa

Lembar bingkai sudah ada di scratchpad (`bedah/r1..r8/lembar/lembar_XX.png`, 6 bingkai/dtk, 24 bingkai per lembar). Bingkai fps asli di transisi ada di `bedah/r8/asli/`.

Bagian yang paling layak ditonton ulang:

| Rujukan | Detik | Isi |
|---|---|---|
| 8 | 10,6-11,1 | tarik mundur 5 bingkai |
| 8 | 26,4-31 | montase bukti dan stabilo dorong masuk |
| 8 | 39,6-42 | sel terisi, tarik mundur 0,47× |
| 8 | 78,9-84 | tarik mundur ke dinding, logo |
| 4 | 9-21 | makro kotak tanya, tombol mic, gelombang suara |
| 4 | 26-31 | status berganti dengan ikon |
| 7 | 14-20 | pemindaian invoice |
| 7 | 35-40 | persetujuan bertingkat |
| 1 | 24-26 | isolasi fokus |
| 1 | 64-68 | morph tombol |

## Aturan yang sudah dipelajari (ringkas)

**Kamera**
- Masuk ke detail lewat potongan keras ke bidikan dekat, atau dorong 1,2-1,7× dalam 12-16 bingkai.
- Keluar ke konteks lewat tarik mundur 0,35-0,8× dalam 33-73 bingkai.
- Kurva tarik mundur: ease-out dengan awalan lembut (puncak di ±30%), kira-kira `cubic-bezier(0.35,0,0.1,1)`, bukan `power3.out` yang memuncak sejak awal.
- Dorong penekanan memakai ease-in-out. Gerak yang berakhir di potongan memakai linear atau ease-in.
- Tanpa guncangan kamera, tanpa miring 3D.

**UI**
- DOM asli direkonstruksi sebagai lapisan: kartu, tombol, sel, angka, dan kursor bergerak sendiri-sendiri.
- Lapisan tambahan (stabilo, cap, kursor) **diposisikan dari elemen yang diukur** (ukur.mjs atau getBoundingClientRect), tidak ditebak.
- Bingkai akhir diisi 70-80% oleh jendela Nadi.
- Selama tahan, selalu ada satu perubahan isi di layar.

**Tulisan**
- Kalimat diketik di tengah (±3-4% tinggi frame), ≤ 8 kata, ditahan 1-1,5 dtk.
- Masalah dibuka dengan kalimat yang diketik lalu disunting.
- Gelembung hanya untuk kalimat pengguna yang mendesak.
- Tanpa narator.

**Bukti**
- Pemindaian berkas dengan pita sorot kunyit dan kotak per bidang.
- Log status asli Nadi ("Membaca…", "Siap ditinjau").
- Kasus kedua selesai sendiri: struk SPBU ke-4 token 0 dari eval T-01B.
- Penghitung angka hanya untuk angka nyata.

**Karakter:** cap stempel kembali sepanjang film (Setujui menjadi cap DISETUJUI, lalu logo di akhir).

**Suara** (dikerjakan SETELAH gambar):
- **Alas musik:**
  - ±115 BPM, mix −14 LUFS, ≤ −1 dBTP, LRA 6-9;
  - drum berhenti sebelum fitur kunci, lalu masuk lagi saat aksi;
  - satu bagian tanpa musik dengan suara toko nyata.
- **Efek** hanya untuk aksi yang terlihat, dari foley rekaman nyata berlisensi bebas:
  - ketik: rumpun klik mikro tidak teratur 30-80 ms;
  - klik: transien 10-20 ms, 0-2 bingkai setelah gambar;
  - whoosh hanya untuk satu kejadian besar.

## Alat yang sudah ada (scratchpad sesi; jalur penuh di STATE.md)

| Alat | Isi |
|---|---|
| `bedah/gerak.py` | potongan, gerak kamera per bingkai, lembar 6 fps |
| `bedah/kurva.py` | kurva easing per jendela waktu |
| `bedah/asli.py` | lembar fps asli |
| `bedah/lihat_bunyi.py`, `bedah/efek.py` | spektrogram, stem, efek per kejadian |
| `stem/htdemucs/r1..r8` | stem demucs 8 rujukan |
| `audio-venv` | librosa, opencv, matplotlib, demucs |
| `uji-gerak/buat.py` | contoh pembangkit HyperFrames dari DOM Feed (sumber DOM: `docs/promo/film-langsung/assets/app/*.html`, `ukur.json`) |

## Rencana film (dikerjakan di folder ini)

- **Hasil:** `docs/promo/demo-v3`, HyperFrames 0.9.8, 1920×1080 30 fps, ≤ 5 menit.
- **Pembangkit:** `buat.py` membangun `index.html`.
- **Placeholder:** footage CCTV dan aset yang belum ada ditandai kotak berlabel "PLACEHOLDER: …" di dalam bingkai. Placeholder diganti sebelum rilis.

Babak (dari STORYBOARD v2, dengan gaya GERAK.md):

| Babak | Waktu | Isi |
|---|---|---|
| 0 kait | 0-6 dtk | bidikan dekat angka nota yang dipindai, lalu tarik mundur ke kartu usulan |
| 1 masalah | | kalimat diketik "Masih mengetik ulang nota satu per satu?", lalu disunting; berkas berantakan di belakang; kartu fakta harga |
| 2 Nadi muncul | | kotak Lempar |
| 3 MCP | | AI-mu menyiapkan draf, pemilik menerapkan di Nadi |
| 4 Lempar dan Feed | | pindai, kartu tumbuh, Setujui menjadi cap |
| 5 invoice + QRIS | | |
| 6 gaji | | |
| 7 Mata | | footage CCTV placeholder |
| 8 otomasi + tanya data | | |
| 9 belajar format | | struk ke-4 token 0 |
| 10 satu kerangka di semua layar | | |
| 11 kartu akhir | | |

Status pengerjaan tiap babak dicatat di bawah ini setiap kali ada babak yang selesai dirender dan ditinjau.

## Status

- 6 Nov 2026: catatan ini ditulis. buat.py + gaya.css + ukur.mjs (ukur.json: posisi elemen kartu-nota terukur) dibuat; babak 0 kait (nota direkonstruksi teks, pita pindai, kotak TOTAL, tarik mundur kurva MUNDUR bezier(0.35,0,0.1,1), nota menjadi kartu usulan asli, kamera 2,0x lalu dorong 2,6x ke Rp376.500 + stabilo) dan babak 1 masalah (kalimat diketik, 'satu per satu?' disorot lalu dihapus diganti 'setiap malam?', baris kedua 'Otomatis itu mahal. Yang murah, manual.', berkas samar 38%, PLACEHOLDER kartu harga) sudah ada, 16 dtk. Render pertama ditinjau: perbaikan koordinat baris nota, kartu diperbesar, spasi ganda. BERIKUTNYA: render ulang + tinjau bingkai besar (scratchpad v3.mp4, v3_lihat.png), lalu babak 2 (kotak Lempar, DOM lempar-kosong/membaca/siap), babak 4 (Feed, Setujui jadi cap, DOM feed + kartu-nota-dicap), babak 5 (invoice-publik QRIS), babak 7 Mata (placeholder footage + peta-panas DOM), babak 9 belajar format, kartu akhir; audio terakhir. Render: npx --yes hyperframes@0.9.8 render -o <scratchpad>/v3.mp4 dari folder ini.
- 6 Nov 2026 (render ke-2, ditinjau bingkai besar 0,3/1,3/2,4/3,3/3,9/4,9 dtk): babak 0 benar (TOTAL utuh, pita pindai, kotak TOTAL tepat, kartu asli memenuhi bingkai 2,0x, stabilo tepat di Rp376.500 dari ukur.json). Catatan rasa yang tersisa: transisi nota ke kartu (3,2-3,5 dtk) masih sekadar mengecil-memudar, belum morph yang meyakinkan; babak 1 tahan 3 dtk hanya berkas bergeser pelan. Babak berikut belum dibuat.
- 6 Nov 2026 babak 2 Lempar (16-26 dtk) dibangun: kalimat 'Lempar berkasnya. Nadi yang merapikan.' diketik, area Lempar asli 2,2x, 4 berkas jatuh ke area, lalu jendela daftar Lempar asli (Membaca, lalu Siap ditinjau) 1,45x dengan gulir ease-out. Ditinjau render: (a) huruf ketik kini display none/inline (dulu opacity, kursor terpisah jauh) DIPERBAIKI, (b) zoom area 1,6x terlalu kecil -> 2,2x DIPERBAIKI, (c) BELUM: di DOM lempar-siap baris daftar saling tumpuk ('Siap disetujui' menindih nama berkas, 22-25 dtk), periksa assets/app/lempar-siap.png dan CSS (mungkin elemen absolut/animasi), lalu render ulang dan tinjau; V-07B baru done setelah (c) beres. Babak 0-1 = V-07A done.
- 6 Nov 2026 babak 2 ditinjau ulang (16,6/19,2/22,8/25,0 dtk): (c) tumpuk daftar BERES (penyebab: lapisan Membaca tidak dihilangkan saat Siap muncul, latar transparan; PNG asli bersih). V-07B done. Catatan rasa tersisa untuk dipoles: jendela daftar Lempar baru ~36% lebar bingkai (teks kecil), pertimbangkan 2,0x dengan gulir, atau dua kolom; berkas jatuh masih kecil di dalam area. BERIKUTNYA: V-07C babak 4 Feed (DOM feed + kartu-nota-dicap, Setujui menjadi cap DISETUJUI, ukur tombol dari ukur.json feed.setujui).
- 6 Nov 2026 babak 4 Feed (26-36 dtk) dibangun dan ditinjau 3 putaran: Feed asli 1,45x di jendela, sekeliling meredup 72%, kartu nota diangkat (salinan DOM di posisi terukur, skala 1,05 + bayangan), kursor ke Setujui (di dalam lapisan kamera), klik, cap besar DITERIMA turun (karakter film), mengecil ke posisi cap asli kartu-nota-dicap (ukur.json cap), kartu menjadi baris Diterima asli, penutup kertas menutup kartu lama, kamera mundur 0,86x. PELAJARAN: (1) kursor dan lapisan harus di dalam lapisan kamera yang sama; (2) jangan display:none elemen yang ikut diukur (bilah atas) -> visibility:hidden supaya tata letak sama dengan ukur.json. V-07C done. Rasa tersisa: celah kosong di bawah baris Diterima (kartu asli lebih tinggi), tombol Setujui lain jadi abu karena redup. BERIKUTNYA: V-07D invoice + QRIS (DOM invoice-publik, ukur.json total/qris/bayar).
- 6 Nov 2026 babak 5 invoice + QRIS (36-46 dtk): 'Tagih. Pelanggan bayar QRIS.' diketik, bidikan dekat QRIS 2,4x, tarik mundur 40 bingkai ke tagihan publik asli 1,12x, notifikasi 'Pembayaran masuk Rp1.448.000 dari Hotel Segara, lewat QRIS', lencana BELUM DIBAYAR (posisi terukur) ditutup dan dicap LUNAS, stabilo di total terukur. V-07D done. Rasa: tagihan potret memenuhi tinggi bingkai saja; notifikasi agak kecil (24 px) pertimbangkan 30 px.
- 6 Nov 2026 babak 7 Mata (46-58 dtk): 'Kamera menghitung. Wajah tidak disimpan.' diketik, kotak gelap 1440x810 berlabel PLACEHOLDER footage CCTV asli (V-04) + pelacakan Mata v2 dirancang ulang (V-12), hitungan Masuk/Keluar naik sampai 11/10, lalu peta panas asli dari dekat zona Antrean 1,9x tarik mundur 44 bingkai. V-07E done (dengan placeholder, sesuai izin Tristan). Rasa: kotak placeholder kosong lama 4,6 dtk; peta panas akhir hanya ~33% lebar bingkai -> perbesar S7. Total film kini 58 dtk.

## CHECKPOINT (baca ini dulu setelah kompaksi)
Film v3 = 58 dtk: babak 0 kait 0-6,5, 1 masalah 6,5-16, 2 Lempar 16-26, 4 Feed + cap 26-36, 5 tagihan QRIS 36-46, 7 Mata placeholder 46-58. V-07A-E done. SISA: V-07F babak 9 belajar format (struk SPBU ke-1 dibaca model dengan pesan 'Nadi sedang mempelajari format baru, sekali saja', struk ke-4 'tanpa AI, token 0') + babak 3 MCP (chat netral, tulis_draf, layar tinjau draf; DOM perlu ditangkap baru lewat apps/web/scripts/promo-dom.mjs), V-07G babak 6 gaji, 8 otomasi/tanya, 10 satu kerangka, 11 kartu akhir (logo + cap), V-07H audio (V-14 foley nyata, musik 115 BPM, -14 LUFS). Cara kerja: tambah blok babak di buat.py sebelum baris 'durasi = ...', posisi dari ukur.json (tambah TARGET di ukur.mjs bila perlu, jalankan node ukur.mjs), python -I buat.py, npx --yes hyperframes@0.9.8 render -o <scratchpad>/v3.mp4, ambil bingkai besar dengan cv2 ke <scratchpad>/v3_lihat.png lalu Read untuk meninjau.
