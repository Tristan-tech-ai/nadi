# Kualitas transkrip wawancara suara (F2-03)

Diukur 31 Okt 2026 di laptop pengembang (CPU, Node 24, transformers.js 4.3.1, dtype q8).
- **Korpus:** `fixtures/korpus/suara`, 20 jawaban wawancara F&B/toko, 210 kata, 117,3 detik audio sintetis eSpeak NG 16 kHz.
- **Perintah:** `TRANSFORMERS=<jalur transformers.js> node scripts/eval-wawancara.ts` dari `apps/web`.
- **Rumus:** WER dibobot jumlah kata (`werKorpus`): substitusi + hapus + sisip dibagi kata rujukan.

| Model | WER | Substitusi / hapus / sisip | Waktu transkrip 117 dtk audio | Muat model | Unduhan q8 (encoder + decoder gabungan) |
|---|---|---|---|---|---|
| onnx-community/whisper-tiny | **3,96** | 83 / 109 / 640 | 20,7 dtk | 7,7 dtk | ±39 MB (docs/research/ml-browser.md) |
| onnx-community/whisper-base | **0,86** | 117 / 17 / 46 | 14,2 dtk | 11,3 dtk | ±77 MB |
| onnx-community/whisper-small | **0,43** | 74 / 16 / 1 | 28,7 dtk | 31,3 dtk | ±249 MB |

Contoh (s02, rujukan: "Saya biasa menyambut tamu, mencatat pesanan, dan membersihkan meja setelah tamu pulang."):
- **tiny:** "yang bisa membuat kamu, mencakar persahalang, memberi kan menjadi kamu-pulang." (halusinasi)
- **base:** "Syabiasa Menyambut Tarmu Mencata Pesanan Dan membersikan Menyasa Tala Tarmu Pula"
- **small:** "Saya biasa menyambut kamu, mencatat pesanan dan membersihkan meja setelah kamu pulang." (WER 0,17)

## Tafsiran jujur
- **Suara eSpeak robotik dan beraksen asing.** WER di atas adalah proksi kasar yang kemungkinan lebih buruk daripada suara manusia, tetapi akurasi pada rekaman HP sungguhan (bising dapur, logat daerah) **belum terukur**.
- **tiny tidak layak** untuk Bahasa Indonesia; ia mengarang kalimat (640 sisipan).
- **base terlalu banyak salah** (WER 0,86) untuk dipakai menilai.
- **small terbaik** (WER 0,43), tetapi berat: unduhan ±249 MB, sekali per perangkat lalu tersimpan di cache browser.
- **Kesalahan small** kebanyakan kata yang mirip bunyi ("tamu" jadi "kamu") dan kata yang tergabung ("hariminggu"). Rubrik pencocokan imbuhan cukup tahan terhadap kesalahan seperti ini, tetapi tidak sempurna.

## Keputusan
- Transkrip memakai **whisper-small q8** di perangkat penilai, diunduh hanya saat penilai membuka wawancara pertama kali.
- Layar penilai menyebut "transkrip mesin, bisa salah dengar; putar klip bila ragu".
- **Klip suara selalu tersedia di samping transkrip.** Keputusan tetap di pemilik.
- Bila perangkat penilai tidak sanggup memuat model, transkrip ditunda dan penilai tetap bisa memutar klip.
- Sebelum diterapkan, WER diukur ulang pada rekaman suara manusia sintetis yang lebih alami bila sudah ada suara TTS Bahasa Indonesia berlisensi jelas.
