# Audio iklan: musik, efek suara, campuran (D-23)

Dibaca 4 Nov 2026. Video promo Nadi tidak memakai narasi suara di versi pertama, jadi musik dan efek suara memikul seluruh audionya.

## 1. Sumber musik dan lisensinya

| Sumber | Status untuk iklan Nadi | Dasar |
|---|---|---|
| Katalog musik HeyGen, akun gratis | Ditolak | Hasil paket gratis hanya "solely for personal, non-commercial, and internal evaluation purposes" dan dilarang untuk "advertising" (Ketentuan HeyGen Bagian 4, diperbarui 16 Okt 2026, heygen.com/terms) |
| Jamendo, lagu CC BY 3.0 | Dipakai | CC BY mengizinkan pemakaian komersial dengan atribusi; dicari lewat Openverse (api.openverse.org, filter license=cc0,by, category=music) |
| Pixabay Music | Cadangan | Lisensi Pixabay: boleh komersial, tanpa atribusi, dilarang menjual ulang berkasnya (pixabay.com/service/terms, versi 18 Nov 2024) |
| MusicGen lokal | Tidak dipakai | Bobot model berlisensi nonkomersial, jadi status hasilnya untuk iklan tidak jelas |

Atribusi lagu CC BY ditulis di kartu akhir video (kecil), di deskripsi saat dibagikan, dan di docs/ASSETS.md.

## 2. Cara "mendengar" lagu: analisis yang dipakai sebagai pengganti telinga

Lagu dianalisis dengan librosa 0.11 dan ffmpeg. Hasilnya dicatat per lagu di docs/promo/audio/analisis-<lagu>.md.

| Ukuran | Alat | Dipakai untuk |
|---|---|---|
| Tempo dan grid ketukan | `librosa.beat.beat_track` | Potongan adegan jatuh di ketukan pertama birama |
| Kekuatan onset per waktu | `librosa.onset.onset_strength` | Menemukan hentakan (drum masuk) untuk detik 8 |
| Energi per bagian | RMS tiap 2 detik + `librosa.segment.agglomerative` | Bagian sepi untuk intro, bagian ramai untuk puncak |
| Kecerahan (spectral centroid) dan isi rendah | `librosa.feature.spectral_centroid`, pita < 120 Hz | Menilai apakah lagu terlalu gelap atau terlalu tipis di HP |
| Kunci nada | rata-rata chroma | Menyetel nada efek suara (denting, chime) agar satu kunci dengan lagu |
| Kenyaringan terintegrasi, rentang, puncak sebenarnya | ffmpeg `ebur128=peak=true` | Target campuran |

Kriteria memilih lagu:
- Ada bagian awal yang tenang sekitar 8 detik, lalu hentakan jelas.
- Tempo 100 sampai 130 BPM.
- Ada bagian puncak yang bisa dipotong ke 58 detik.
- Akhir bisa ditutup dengan akord tanpa terdengar terpotong.
- Bukan tipe "korporat generik" yang datar: energi berubah minimal dua kali.

## 3. Efek suara: bunyi biasa yang diolah

Prinsip dari praktik penata suara (Krotos, "Film sound design"; Violet Recording, "How to layer sounds"; diakses 4 Nov 2026). Sumbernya blog vendor, jadi angka di bawah adalah titik awal untuk diuji, bukan standar.

- **Lapisan menurut fungsi.** Satu bunyi besar terdiri dari empat lapisan:
  - serangan (transien tajam, 2 sampai 5 kHz);
  - badan (bunyi utama);
  - berat (pita rendah 60 sampai 120 Hz);
  - ekor (ruang dan peluruhan).

  Setiap lapisan di-solo, dan bagian yang dobel dibuang.
- **Waktu.** Transien jatuh sedikit sebelum puncak visual. Untuk Nadi, cap menyentuh kertas di bingkai N, dan transien jatuh di bingkai N, satu bingkai lebih awal dari ekor gerakan.
- **Pitch.** Geser pitch hanya sedikit (± 2 sampai 4 semiton) untuk mengubah "ukuran" benda. Geseran besar memunculkan artefak.
- **EQ.** EQ selalu punya alasan:
  - buang dengung di bawah 40 Hz;
  - beri ruang 1 sampai 3 kHz untuk denting;
  - potong pita tempat musik paling padat.
- **Kompresi.** Kompresi hanya untuk menjinakkan transien liar. Kompresi berlebih membunuh dampak.
- **Ekor.** Ekor yang dipotong pendek membuat bunyi terasa dekat dan kering, cocok untuk antarmuka. Ekor panjang terasa jauh.

Resep untuk video Nadi. Semua bahan CC0/CC BY dari Freesound lewat Openverse, atau dari pustaka bawaan skill media-use (lisensi Pixabay). Diolah dengan ffmpeg memakai `rubberband`, `equalizer`, `highpass`, `lowpass`, `acompressor`, `aecho`, `amix`, dan `adelay`.

| Momen | Bahan mentah | Olahan |
|---|---|---|
| Kertas jatuh di meja | tepuk kertas + ketukan meja kayu | badan kertas pitch -2, berat dari ketukan meja lowpass 150 Hz, ekor pendek |
| Cap DITERIMA turun | pukulan meja + klik plastik | transien klik di depan, badan pukulan meja pitch -3, berat impact bass lowpass 100 Hz, gema ruang kecil 40 ms |
| Jempol mengetuk HP | klik lembut | highpass 300 Hz, pendek, kunci nada tidak relevan |
| Total selesai menghitung | denting garpu ke gelas | disetel ke nada dasar lagu, ekor 600 ms |
| Kertas tersedot | whoosh pendek dibalik dan digabung whoosh maju | pitch naik ikut kecepatan, lowpass bergerak |
| LUNAS | chime + cap | chime satu kunci dengan lagu, ditumpuk di atas cap |
| Meja berubah status | pop lembut | volume rendah, hanya pada perubahan pertama dan terakhir supaya tidak bising |

Hanya perubahan penting yang diberi bunyi (docs/research/psikologi-persuasi.md bagian 5).

## 4. Campuran dan kenyaringan

- **Standar.** AES TD1008 (2021) merekomendasikan kenyaringan distribusi streaming -16 LUFS untuk musik dan -18 LUFS untuk ucapan dan isi campuran. Status B: dari ringkasan Production Advice, dokumen AES belum dibaca langsung.
- **Platform.** Platform video umumnya menurunkan audio di atas sekitar -14 LUFS terintegrasi dan tidak menaikkan yang lebih pelan. Status B: halaman bantuan resmi YouTube tidak ditemukan.
- **Target Nadi.**
  - -14 LUFS terintegrasi ± 1 untuk versi media sosial, -16 LUFS untuk berkas di situs.
  - Puncak sebenarnya ≤ -1 dBTP, diukur ffmpeg `ebur128=peak=true`.
  - Normalisasi dua lintasan `loudnorm`.
- **Keseimbangan.**
  - Efek suara berada 3 sampai 6 dB di atas musik saat terjadi.
  - Musik ditekan pelan di bawah efek penting dengan `sidechaincompress` (rasio 3, attack 5 ms, release 150 ms), supaya cap terdengar tanpa musik hilang.
- **Pemeriksaan tanpa telinga.**
  - Kenyaringan per bagian 2 detik dibuat grafiknya.
  - Spektrogram campuran akhir disimpan sebagai gambar dan diperiksa: lubang di pita rendah atau tumpukan di 2 sampai 5 kHz terlihat di sana.
  - Tidak ada klip (puncak sampel < 0 dBFS).

Analisis di atas dipakai sebagai cara membaca lagu dan campuran: ketukan, bagian, kunci nada, spektrum, dan kenyaringan semuanya terukur. Tristan mendengarkan hasil akhirnya sebagai pemeriksaan terakhir.
