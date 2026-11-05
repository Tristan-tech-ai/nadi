# Sound design untuk video SaaS Nadi (V-02)

Ditulis 6 Nov 2026. Bagian 1 adalah riset dengan sumbernya. Bagian 2 adalah rantai olah yang bisa dijalankan (`docs/promo/audio/olah.py`) beserta hasil ujinya.
Catatan jujur: aku tidak bisa mendengar. Semua penilaian di sini berasal dari pengukuran (LUFS, true peak, durasi, bentuk gelombang), bukan dari telinga.
Titik loop musik dan akhir lagu tetap perlu diperiksa telinga Tristan sebelum V-07 dirilis.

## 1. Yang dikerjakan sound designer profesional

| Kerja | Isinya | Sumber |
|---|---|---|
| Spotting | Membuat daftar setiap aksi di layar yang perlu bunyi (klik, kertas jatuh, cap, angka mendarat, potongan adegan). Bunyi hanya untuk aksi yang terlihat, dan bunyi yang diulang punya 2-3 variasi | skill HyperFrames `sound.md` (3 Nov 2026) |
| Sinkron ke bingkai | Puncak bunyi jatuh satu frame setelah gambarnya, karena cahaya sampai lebih dulu dari suara. Gerak yang harus kena ketukan mulai 40-190 ms lebih awal | `sound.md`, `film.md` |
| Layering transien, badan, ekor | Satu bunyi besar disusun dari tiga lapis: transien (serangan, frekuensi tinggi), badan (berat, frekuensi rendah-tengah), dan ekor (ruang, reverb). Transien diletakkan sedikit di depan badan supaya memimpin, dan geseran waktu kecil mengubah kesan besar dan tenaga | Pixflow, "Sound effects layering"; DJ TechTools, "How to make a great snare"; tulisan desain suara senjata FPS (Lior Tega) |
| EQ | Memotong dengung di bawah 80-150 Hz, menekan frekuensi kasar 2,5-3,2 kHz, memberi kilau sekitar 3-4 kHz. Setiap lapis mendapat pita frekuensinya sendiri supaya tidak keruh | Pixflow; skill media-use `mixing.md` |
| Kompresi | Kompresi cepat untuk merapikan transien; kompresi lambat (lem) pada hasil lapisan supaya terdengar satu benda | Joe's Daily; `mixing.md` |
| Reverb dan ruang | Ekor memberi ruang dan rasa nyata. Reverb konvolusi = sinyal dikonvolusi dengan respons impuls ruang | Pixflow; dokumentasi filter ffmpeg `afir` |
| Pitch | Menurunkan nada memberi kesan lebih besar dan berat (dipakai untuk transien cap) | Pixflow |
| Ducking | Bed musik diturunkan ke ±0,3-0,4 saat ada suara atau efek utama, lalu naik lagi | `mixing.md` |
| Sonic logo | Satu bunyi khas di kartu akhir, sekali dalam film. Untuk Nadi: cap stempel, karena stempel adalah bahasa visual Nadi (DIRECTION.md) | `sound.md` (riser ke dentum hanya sekali, di hasil atau tanda) |
| Kenyaringan | Diukur dengan ITU-R BS.1770 (K-weighting, blok 400 ms, gerbang mutlak −70 LUFS, gerbang relatif −10 LU). EBU R128: −23 LUFS ±0,5 LU (±1 LU bila tidak praktis), true peak ≤ −1 dBTP, momentary 400 ms, short-term 3 dtk. Spotify: −14 LUFS terintegrasi, true peak −1 dBTP (−2 dBTP bila master lebih keras dari −14 LUFS). YouTube −14 LUFS hanya dari sumber pihak ketiga, belum dari dokumen resmi YouTube | EBU R 128 (tech.ebu.ch, r128v5_0); Wikipedia "EBU R 128"; support.spotify.com "Loudness normalization" (dibaca 6 Nov 2026) |

Target Nadi (**pilihan**): mix akhir −14 LUFS ± 0,5 LU dan ≤ −1 dBTP, karena video diputar di laptop juri, YouTube, dan HP. Efek one-shot dinormalkan ke −3 dBTP, lalu kerasnya di mix diatur gain per efek, 3-6 dB di atas bed.

## 2. Rantai olah yang bisa dijalankan

`python olah.py <folder-mentah> <folder-keluar>` membutuhkan ffmpeg 8.1+ dan numpy. Bahan mentahnya tiga berkas dari Wikimedia Commons, diunduh ke folder sementara (tidak masuk repo):
- "Computer Mouse Click.wav" (CC0);
- "Book paper pages assorted.ogg" (domain publik);
- "Stomping machine.ogg" (domain publik).

Berkas akan dicatat di docs/ASSETS.md begitu dipakai di video (V-05).

| Langkah | Fungsi | Cara |
|---|---|---|
| Spotting otomatis | `jendela_terkuat` | Jendela RMS terbesar lewat jumlah bergeser O(N), lalu mundur ke awal serangan (sampel pertama > 10% puncak) |
| Potong + fade | `olah` | `-ss/-t`, `afade` masuk 10 ms dan keluar 30-150 ms supaya tidak berbunyi klik di ujung |
| EQ | `olah` | `highpass`, `lowpass`, `equalizer` (peaking) |
| Kompresi | `olah` | `acompressor` cepat (attack 0,5-5 ms) per lapis; lem lambat (attack 8 ms, release 150 ms) di hasil lapisan |
| Pitch | `olah` | `asetrate` × 2^(−3/12) lalu `aresample` (turun 3 semitone) |
| Reverb konvolusi | `ir_ruang`, `reverb` | IR sintetis berbenih (derau yang meluruh eksponensial pada RT60 dan makin gelap di ekor) lewat `afir`. Masukan diberi `apad` sepanjang IR, karena afir memotong keluaran sepanjang masukan |
| Layering | `lapis` | `adelay` per lapis + `volume` + `amix normalize=0` |
| Normalisasi efek | `puncak` | Gain linier ke −3 dBTP |
| Normalisasi mix | `normalkan` | Ukur, gain linier ke −14 LUFS, naik sampel 4× (192 kHz), `alimiter level=0` di −1,5 dBFS, turun ke 48 kHz, ukur ulang, koreksi gain sampai ±0,5 LU (paling banyak 3 putaran) |

## 3. Hasil uji (diukur ffmpeg ebur128, 6 Nov 2026)

"Sebelum" adalah potongan mentah yang sama sebelum diolah. Bunyi di bawah 1 dtk diukur di jendela 1 dtk (diberi senyap di belakangnya), karena BS.1770 mengukur blok 400 ms dan bunyi lebih pendek dari itu terbaca −inf.

| Bunyi | Sebelum LUFS / dBTP / dtk | Sesudah LUFS / dBTP / dtk | Rantai |
|---|---|---|---|
| Klik UI | −36,5 / −7,9 / 0,12 (jendela 1 dtk) | −32,3 / −3,0 / 0,72 (jendela 1 dtk) | highpass 150 Hz, +3 dB di 4 kHz, kompresi 4:1, ruang 12% basah |
| Kertas nota | −21,2 / −5,9 / 0,71 (jendela 1 dtk) | −16,4 / −3,0 / 1,31 (utuh) | pita 300 Hz-9 kHz, −3 dB di 2,5 kHz, kompresi 3:1, ruang 18% |
| Cap stempel (3 lapis) | −18,4 / −0,8 / 0,35, potongan mesin mentah (jendela 1 dtk) | −24,0 / −3,0 / 1,56 (utuh) | transien klik −3 semitone (−4 dB), badan dentum lowpass 400 Hz (+6 dB, +8 ms), ekor reverb RT60 0,8 dtk (−6 dB, +8 ms), lem 3:1 |
| Mix uji 8 dtk (bed derau sintetis + 3 efek) | −27,0 / −7,0 | **−13,6 / −1,5** | gain per efek −4 sampai −8 dB, lalu `normalkan` |

Yang kupelajari dari pengujian ini (kesalahan yang ditemukan, lalu diperbaiki):
1. **One-shot tidak boleh dipaksa ke LUFS.** Klik 0,12 dtk tidak punya loudness terintegrasi (−inf): `loudnorm` menolak `measured_I=-inf`. Cap berekor panjang yang dipaksa ke −16 LUFS akan melampaui puncak. Efek dinormalkan menurut puncak; LUFS hanya untuk mix akhir.
2. **`alimiter` di ffmpeg menyalakan level otomatis secara bawaan.** Akibatnya sinyal didorong ke batas: mix pertama menembus 0,0 dBTP. Dengan `level=0` dan naik sampel 4×, true peak tertahan di −1,5 dBTP.
3. **`afir` memotong ekor reverb sepanjang masukan.** Cap pertama hanya 0,36 dtk tanpa ekor. Dengan `apad` sepanjang IR, ekornya utuh 1,56 dtk.
4. **Limiter menurunkan loudness.** Mix pertama berhenti di −15,0 LUFS. Ukur ulang lalu koreksi gain membawanya ke −13,6 LUFS (dalam ±0,5 LU).
5. **Spotting dengan konvolusi biasa terlalu lambat** untuk rekaman 78 dtk (lebih dari 4 menit). Dengan jumlah bergeser kumulatif, prosesnya kurang dari 2 dtk.

## 4. Dipakai di V-05 dan V-07

- V-05 mengumpulkan bahan mentah berlisensi bebas (klik, ketik, kertas, gesekan, whoosh, dentum, ambience toko) dan menjalankannya lewat `olah.py`. Setiap berkas dicatat di docs/ASSETS.md.
- V-07 memakai `normalkan` pada mix akhir dan melaporkan LUFS/true peak dari berkas render. Pemeriksaan telinga oleh Tristan dicatat terpisah.
