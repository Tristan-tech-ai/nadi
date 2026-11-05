# Pola lintas 8 video rujukan (V-13I)

Disusun 6 Nov 2026 dari 8 bedah di `bedah/`. Kedelapan bedah itu ditonton bingkai demi bingkai (6 bingkai/dtk, dan fps asli di transisi), gerak kameranya diukur, dan bunyinya dipisah per stem (demucs htdemucs). Pengukuran bunyi adalah pembacaan sinyal, bukan penilaian telinga.

Berkas ini menggantikan bagian "pola" di RUJUKAN.md dan menjadi dasar storyboard baru (V-06 dibuka ulang).

## Angka per rujukan

| Rujukan | Jenis | Dtk | fps | LUFS | LRA | Narasi | Latar |
|---|---|---|---|---|---|---|---|
| 8 orTd3grSYsQ (vibe) | demo produk | 87 | 24 | −28,0 | 8,6 | tidak | krem polos |
| 4 yRc5HcGJ-Cs | demo produk | 100 | 60 | −17,5 | 6,8 | tidak (ada suara dikte produk) | putih + langit malam |
| 7 wwIt5ZvROrs | demo produk animasi | 48 | 30 | −16,2 | 2,3 | tidak | ungu tua |
| 5 awUYikrGsKk | demo produk animasi | 95 | 30 | −13,6 | 1,9 | tidak | putih + biru bercahaya |
| 1 xNUx-rMGvvw | demo produk animasi | 98 | 25 | −17,6 | 6,5 | tidak | gelap + gradien |
| 2 KNAGNQeu5J8 | peluncuran + narasi | 94 | 30 | −18,4 | 4,4 | ya | biru es / biru tua |
| 6 pZv7me6dFns | peluncuran + narasi | 53 | 30 | −17,8 | 3,5 | ya | foto tembok + biru |
| 3 k3d_xeVxEOE | identitas merek | 109 | 30 | −19,0 | 15,3 | tidak | putih |

## Gerak kamera

**1. Masuk ke detail cepat, keluar ke konteks lambat.**

| Gerak | Nilai terukur |
|---|---|
| Dorong ke tombol atau kartu | 12-16 bingkai (0,4-0,55 dtk) pada 1,2-1,7× |
| Tarik mundur ke layar utuh atau ke dunia | 33-73 bingkai (1,1-2,4 dtk) pada 0,35-0,8× |

- Rujukan 8 sering masuk ke detail dengan **potongan keras ke bidikan dekat**, bukan dengan zoom.
- Rujukan 4 hampir tidak menggerakkan kamera: bidikan makro tersusun, lalu potong.

**2. Kurva.**
- Tarik mundur dan geser yang diam di akhir hampir selalu **ease-out**, dengan puncak kecepatan di 4-30% durasi.
- Yang paling bersih terukur: ease-out expo (rujukan 6, galat 0,019), lalu ease-out cubic dan quint (rujukan 1, 5, 7, 8).
- Dorong penekanan memakai **ease-in-out** (rujukan 8 pada 30,0 dtk: 1,32× dalam 14 bingkai).
- Gerak yang berakhir di potongan memakai kurva linear atau ease-in, supaya momentumnya terbawa (rujukan 2, 6, 8).

**3. Gulir dan geser di dalam layar yang sama** menggantikan potongan:
- 700-1.600 px dalam 20-99 bingkai;
- gulir cepat (20-27 bingkai) dengan ease-out quint di rujukan 5.

**4. Tidak ada guncangan kamera.**
- Miring 3D hanya di rujukan animasi (1, 5, 7, 2), dan DIRECTION Nadi melarangnya.
- Blur gerak hanya pada dorong cepat dan huruf (rujukan 2, 5).

**5. Penutup.** Tarik mundur panjang ke "dinding banyak pekerjaan" (rujukan 8: 0,2× dalam 101 bingkai; rujukan 2: 0,35×; rujukan 4: daftar terjadwal di ponsel), lalu potong ke logo di tengah.

## UI direkonstruksi sebagai lapisan

Teknik yang muncul di ≥ 3 rujukan:

| Teknik | Rujukan |
|---|---|
| Komponen tunggal diperbesar sampai detailnya terbaca (kotak tanya, tombol, kartu), tanpa bingkai peramban | 1, 2, 4, 5, 6, 8 |
| Kalimat diketik di dalam UI sebagai cerita (prompt, pesan, nama formulir) | 2, 4, 5, 6, 7, 8 |
| Status kerja sebagai kalimat yang berganti atau log bercentang ("Searching…", "Reviewing…", "Knowledge saved") | 2, 4, 5, 8 |
| Isolasi fokus: sekeliling meredup atau buram, satu elemen terangkat | 1, 5, 7 |
| Morph: tombol menjadi elemen berikutnya, kata menjadi UI | 1, 5, 6, 7 |
| Kartu hasil tumbuh dari kotak masukan, isinya muncul berselang 0,2-0,35 dtk | 2, 4, 8 |
| Penghitung angka sebagai bukti | 1, 2, 6 |
| Bukti belajar atau ulang: kasus kedua langsung selesai | 5, 4 (deck diperbarui), 8 |
| Kata pengapit di kiri dan kanan UI | 1, 6, 7 |

## Tulisan

- 6 dari 8 tanpa narator. Kata dibawa oleh kalimat yang diketik di tengah (huruf sans tebal sedang, ±3-4% tinggi frame) atau oleh isi UI.
- **Masalah dibuka dengan kalimat yang diketik**, kadang disunting: rujukan 5 dan 7, dan rujukan 8 lewat pesan pengguna yang mendesak.
- Kalimat satu baris, ≤ 8 kata. Ditahan ±1-1,5 dtk setelah selesai diketik, lalu dihapus mundur atau dipotong.

## Bunyi

- **Mix.**
  - Film yang terasa mahal punya dinamika: LRA 6,5-15,3 (rujukan 3, 4, 8, 1).
  - Film animasi studio (5, 7) dipadatkan rata (LRA ≤ 2,3) dan melelahkan.
  - Target Nadi: −14 LUFS terintegrasi (diputar di laptop juri dan HP, sesuai SUARA.md), ≤ −1 dBTP, **LRA 6-9 LU** dengan jeda yang disengaja.
- **Musik menandai cerita lewat aransemen, bukan efek:**
  - drum atau bass berhenti sebelum fitur kunci, lalu masuk lagi tepat saat aksi terlihat (rujukan 4, 6, 7, 8);
  - bass baru masuk di puncak montase (rujukan 3);
  - satu bagian tanpa musik dengan suara dunia nyata di titik emosional (rujukan 3).
- **Tempo:** 100-120 BPM pada 6 dari 8 rujukan. Rujukan 8 pada 117 BPM.
- **Efek suara UI hanya pada aksi yang terlihat:**
  - klik: transien 10-20 ms, ekor 20-30 ms, pita lebar 0,5-8 kHz, jatuh 0-2 bingkai setelah gambar (rujukan 8);
  - ketikan: **rumpun klik mikro tidak teratur** 30-80 ms antarklik (rujukan 8), atau rumpun pendek dengan satu pita nada (rujukan 3), mengikuti kata, bukan ketukan musik;
  - whoosh pita lebar ±650 ms pada satu kejadian besar (rujukan 8: folder meledak);
  - ledakan butiran untuk banyak hal yang muncul serentak (rujukan 3).
- **Suara produk sendiri sebagai efek** (rujukan 4: suara dikte diangkat di atas musik).
- **Akhir:** alas berhenti sebelum logo, lalu satu bunyi pendek atau ekor bass rendah. Tidak ada sonic logo panjang.

## Keputusan untuk film Nadi

Pilihan ini kuambil sendiri dan dicatat di DECISIONS saat storyboard ditulis ulang.

1. **Vibe rujukan 8**:
   - satu dunia kertas Nadi (#F6F2EA), satu tugas nyata dari awal sampai akhir;
   - pesan mendesak yang diketik;
   - masuk lewat potongan keras ke bidikan dekat, keluar lewat tarik mundur ease-out;
   - penutup tarik mundur ke dinding banyak pekerjaan Nadi.
2. **Kerapian rujukan 4**: latar polos, hitam di atas kertas, satu aksen kunyit, bidikan makro komponen asli, dan detail jujur ("Kalau disetujui: …", "tanpa AI, token 0", "jendela batal 10 menit").
3. **Teknik bukti dari rujukan 7 dan 5**: pemindaian berkas dengan pita sorot kunyit dan kotak per bidang; log kerja dengan teks status Nadi asli; kasus kedua yang selesai sendiri (struk SPBU keempat token 0 dari eval T-01B).
4. **Isolasi fokus dan morph dari rujukan 1**:
   - satu kartu usulan diangkat dari Feed yang diredupkan;
   - tombol Setujui berubah menjadi cap DISETUJUI;
   - cap menjadi karakter yang kembali sampai logo (pelajaran titik dari rujukan 3).
5. **Suara:**
   - alas ±115 BPM yang dibuka saat Nadi muncul, berhenti sebelum fitur kunci dan masuk lagi saat aksi;
   - babak masalah dan babak Mata memakai suara toko nyata;
   - efek hanya untuk aksi yang terlihat, dari rekaman foley nyata berlisensi bebas, dinilai berdampingan dengan efek rujukan (V-14).
6. **Larangan yang dikukuhkan 8 bedah ini**: tanpa miring 3D, tanpa latar gelap bercahaya, tanpa gradien ungu, tanpa narator, tanpa klaim mutlak, tanpa logo pihak ketiga.

## Uji gerak berdampingan

Lihat `UJI-GERAK.md`. Satu gerak rujukan 8 ditiru di HyperFrames dan diletakkan berdampingan dengan rujukannya.
