# ML di browser: OCR nota, deteksi objek, suara

Diukur 31 Okt 2026 di mesin pengembang (Windows 11, Google Chrome 156 lewat Playwright, headless). Pustaka dimuat dari jsDelivr, model dari Hugging Face. Angka "unduh" adalah jumlah header content-length yang dilihat halaman, dibulatkan; unduhan berikutnya diambil dari cache browser.

## Ringkasan
| Kebutuhan | Pilihan | Lisensi | Unduh pertama | Latensi terukur | Dipakai untuk |
|---|---|---|---|---|---|
| OCR foto nota/KTP | tesseract.js 7.0.0 + data bahasa `ind` | Apache-2.0 | ±2,5 MB | siap 459 ms; 166-280 ms per gambar korpus | Foto nota dibaca jadi teks di HP, lalu aturan tersimpan (0 token) |
| Deteksi objek (Mata) | RF-DETR nano ONNX (`onnx-community/rfdetr_nano-ONNX`) lewat transformers.js 4.3.1 | Apache-2.0 (model dan pustaka) | ±109 MB (fp32) | WebGPU: 78-108 ms per gambar setelah pemanasan (panggilan pertama 2,2 dtk, siap 17 dtk); WASM: ±1.050 ms | Hitung meja terisi/kosong dan antrean dari kamera |
| Suara ke teks | Whisper tiny (`onnx-community/whisper-tiny`) lewat transformers.js | Apache-2.0 (model MIT dari OpenAI) | ±39 MB | WASM: siap 7,1 dtk; 1,2 dtk untuk audio 5 dtk | Catatan suara staf ("izin sakit", laporan singkat) |

## OCR: hasil per berkas korpus
- **nota-01.png** (219 ms, keyakinan 87): semua angka dan total benar. Galat kecil: "NT-4671" terbaca "NI-4671", "1 kg" terbaca "1 ko".
- **nota-02.png** (248 ms, 93): semua baris barang, harga, jumlah, dan total benar.
- **nota-05.png** (280 ms, 87): enam baris barang dan total 1.289.000 benar; "kg" kadang terbaca "ko".
- **ktp-01.png** (166 ms, 83): NIK 16 angka, nama, dan tanggal lahir benar.

Kesimpulan: OCR di perangkat cukup untuk angka (yang paling penting di nota). Huruf kecil (nomor nota, satuan) kadang meleset, jadi hasil OCR hanya dipakai bila:
1. aturan tersimpan cocok;
2. pemeriksaan silang lolos (jumlah baris = total, qty x harga = jumlah);
3. keyakinan OCR >= 85.

Bila salah satu tidak terpenuhi, foto tetap dikirim ke model seperti sekarang.

## Deteksi objek
- **WebGPU tersedia** di Chrome desktop headless. Setelah pemanasan, 78-108 ms per gambar (±10-12 fps): cukup untuk mencuplik meja tiap beberapa detik, tidak perlu video penuh.
- **Tanpa WebGPU** (WASM) ±1 detik per gambar. Masih bisa dipakai untuk mencuplik tiap 5-10 detik.
- **Unduhan 109 MB terlalu berat untuk HP.** Langkah berikutnya: varian terkuantisasi (q8/q4) yang disediakan repo onnx-community, diukur ulang sebelum dipakai di Mata.
- Gambar uji (nota) tidak berisi objek COCO, sehingga 0 deteksi memang yang diharapkan. Akurasi untuk meja restoran diukur nanti dengan foto sintetis atau rekaman uji.

## Whisper
- Hanya latensi yang diukur (audio sintetis nada 220 Hz, 5 dtk). Akurasi bahasa Indonesia belum diukur karena korpus belum punya rekaman suara.
- Rekaman sintetis berbahasa Indonesia ditambahkan ke korpus sebelum fitur suara dibangun.

## Keputusan
1. Tesseract.js dipakai sekarang untuk foto di Lempar Saja (tugas F0-07D): teks OCR dikirim bersama foto, baca-berkas mencoba aturan tersimpan dulu.
2. RF-DETR dan Whisper ditunda sampai fitur Mata dan suara. Keduanya wajib memakai varian terkuantisasi dan diunduh hanya saat fitur dibuka, bukan di muatan awal aplikasi.

## Sumber (diakses 31 Okt 2026)
- tesseract.js: https://github.com/naptha/tesseract.js (npm 7.0.0, 15 Des 2025, Apache-2.0)
- transformers.js: https://github.com/huggingface/transformers.js (npm @huggingface/transformers 4.3.1, 6 Okt 2026, Apache-2.0)
- RF-DETR ONNX: https://huggingface.co/onnx-community/rfdetr_nano-ONNX (Apache-2.0)
- Whisper tiny ONNX: https://huggingface.co/onnx-community/whisper-tiny
- WebGPU di Chrome: navigator.gpu.requestAdapter() mengembalikan adaptor pada pengujian ini
