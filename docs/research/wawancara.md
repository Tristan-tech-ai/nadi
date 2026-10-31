# Wawancara suara asinkron (F2-03)

Ditulis 31 Okt 2026. Masalah P01 (rekrutmen): pemilik UMKM tidak sempat mewawancarai setiap pelamar, dan pelamar yang paling cocok sering lepas karena jadwal. Wawancara asinkron membalik urutannya:
1. Pelamar menjawab 3 sampai 5 pertanyaan lewat rekaman suara di HP, kapan saja.
2. Nadi menulis transkripnya.
3. Pemilik membaca ringkasan dan memutar klip yang penting saja.

Kriteria terima: WER transkrip korpus suara uji tercatat; penilai melihat ringkasan dan klip.

## Alur
1. **Pertanyaan dari topi.** Lowongan bertopi menurunkan 3 sampai 5 pertanyaan dari keahlian dan tanggung jawab topi (sama dengan rubrik F2-02). Contoh: "Ceritakan pengalamanmu melayani pelanggan". Pertanyaan yang menyangkut atribut terlindungi tidak pernah dibuat; penjaga bias F2-02 juga memeriksa teks pertanyaan.
2. **Rekam di HP, tanpa akun.** Halaman `/lamar/[kode]` menawarkan rekaman setelah CV terkirim.
   - Rekaman memakai MediaRecorder, maksimal 90 detik per jawaban.
   - Berkas audio diunggah ke bucket pribadi `berkas`, jalur `{usaha}/wawancara/{sha256}.webm`, lewat slot satu kali seperti CV.
   - Batas unggah harian Q-01 berlaku.
3. **Transkrip.**
   - Jalur utama: Whisper lewat transformers.js di perangkat penilai (pemilik/admin), saat penilai membuka hasil wawancara. Audio tidak dikirim ke layanan pihak ketiga dan tidak memakai token AI.
   - Hasil transkrip disimpan, sehingga transkrip dibuat sekali per jawaban.
   - Model diunduh hanya saat fitur dibuka (aturan docs/research/ml-browser.md).
4. **Nilai dengan rubrik.**
   - Transkrip dicocokkan ke kriteria topi dengan pencocokan imbuhan dari F2-02 (`nilaiPelamar`), tanpa model.
   - Ringkasan berisi kriteria yang terlihat, kutipan kalimat pendukung, dan durasi.
   - Atribut terlindungi tidak dinilai; nama dan suara tidak masuk skor.
5. **Penilai melihat ringkasan dan klip.** Kartu pelamar menampilkan skor rubrik, kutipan per kriteria, dan tombol putar klip per jawaban. Keputusan tetap Setujui atau Tolak oleh pemilik.

## Model ASR
| Kandidat | Sumber | Lisensi | Catatan |
|---|---|---|---|
| `onnx-community/whisper-base` | Hugging Face, library transformers.js, unduhan ±196 rb | Apache-2.0 (model asli OpenAI MIT) | multibahasa, ukuran kecil, kandidat utama di HP penilai |
| `onnx-community/whisper-small` | Hugging Face, transformers.js, ±150 rb | Apache-2.0 | lebih akurat, lebih berat; untuk laptop penilai |
| `onnx-community/whisper-tiny` | sudah diukur latensinya (docs/research/ml-browser.md) | Apache-2.0 | akurasi Bahasa Indonesia diduga rendah |
| Fine-tune Indonesia (`octava/whisper-small-indonesian-*`, Apache-2.0) | Hugging Face | Apache-2.0 | belum ada versi ONNX; dataset spesifik bencana; dicatat untuk nanti |

Pilihan akhir ditentukan oleh WER terukur pada korpus di bawah ini, bukan klaim model card.

## Korpus suara uji
- **Syarat:** sintetis (penjaga: hanya data sintetis) dan berlisensi bebas.
- **Yang ditolak:**
  - Suara Piper `id_ID-news_tts-medium`: model card hanya menulis "License: See URL" yang menunjuk korpus lain, jadi lisensinya tidak jelas.
  - Windows di mesin ini hanya punya suara en-US.
- **Rencana:**
  - Mesin: eSpeak NG lewat `@echogarden/espeak-ng-emscripten` 0.3.5, lisensi GPL-3.0. Program ini hanya dipakai sebagai alat di luar repo; berkas WAV keluarannya yang masuk `fixtures/korpus/suara/` bersama teks rujukannya.
  - Isi: 20 kalimat jawaban wawancara khas F&B dan toko, 5 sampai 25 kata per kalimat, termasuk angka, nama tempat, dan kata ulang.
- **Batas yang diketahui:**
  - Suara eSpeak terdengar robotik, jadi WER korpus ini adalah proksi kasar.
  - Akurasi pada rekaman HP sungguhan (bising dapur, logat daerah) belum terukur. Hal ini dicatat jujur di layar penilai ("transkrip mesin, putar klip bila ragu").

## Ukuran keberhasilan
- WER korpus per model (`werKorpus` di `src/lib/wawancara/wer.ts`, dibobot jumlah kata) tercatat di `docs/quality/wawancara.md`.
- Latensi transkrip per menit audio diukur di perangkat penilai.
- Penilai bisa menilai satu pelamar (ringkasan, kutipan, klip) dalam waktu kurang dari 1 menit.
