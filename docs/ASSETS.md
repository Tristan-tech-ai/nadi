# Aset dan lisensinya

Setiap font, ikon, gambar, model ML, atau berkas pihak ketiga dicatat di sini sebelum dipakai.

| Aset | Sumber (URL) | Lisensi | Dipakai di | Tanggal |
|---|---|---|---|---|
| transformers.js 4.3.1 (Hugging Face) | https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1 (dimuat worker apps/web/public/transkrip-worker.js, tidak dibundel) | Apache-2.0 | transkrip wawancara di perangkat penilai | 31 Okt 2026 |
| Model ucapan whisper-small ONNX q8 (onnx-community) | https://huggingface.co/onnx-community/whisper-small (diunduh peramban penilai; ID di public.konfigurasi model_transkrip) | Apache-2.0 | transkrip wawancara | 31 Okt 2026 |
| IPIP Big-Five Factor Markers 50 butir + terjemahan Indonesia (Hanif Akhtar) | https://ipip.ori.org/ dan https://ipip.ori.org/IndonesianBFM.htm | domain publik (pernyataan resmi IPIP) | apps/web/src/lib/rekrut/ipip-50.ts | 31 Okt 2026 |
| MediaPipe face_landmarker.task | https://ai.google.dev/edge/mediapipe | Apache-2.0 | apps/web/public/mediapipe | 30 Okt 2026 |
| Plus Jakarta Sans (Gumpita Rahayu, Tokotype) | https://github.com/tokotype/PlusJakartaSans lewat next/font/google (di-host sendiri saat build) | SIL OFL 1.1 | huruf antarmuka | 31 Okt 2026 |
| Bricolage Grotesque | https://fonts.google.com/specimen/Bricolage+Grotesque lewat next/font/google | SIL OFL 1.1 | judul besar | 31 Okt 2026 |
| IBM Plex Mono | https://github.com/IBM/plex lewat next/font/google | SIL OFL 1.1 | nomor dokumen, kode | 31 Okt 2026 |
| Phosphor Icons (@phosphor-icons/react 2.1.10) | https://github.com/phosphor-icons/react | MIT | ikon (ketebalan regular, bold untuk 12 px) | 31 Okt 2026 |
| Logo Nadi (nota + denyut) | dibuat sendiri, apps/web/src/components/ui/logo.tsx | milik proyek | logo | 31 Okt 2026 |
| Korpus suara uji wawancara (fixtures/korpus/suara, 20 WAV 16 kHz mono + jawaban.json) | dibuat sendiri dari teks sintetis lewat eSpeak NG (Echogarden 3.4.0, npm, lisensi MIT AND GPL-3.0; hanya alat, bukan dependensi) dan ffmpeg; skrip apps/web/scripts/korpus/suara.mjs | teks milik proyek; audio keluaran program: hak cipta keluaran mengikuti input kecuali sebagian besar keluaran disalin dari teks program (https://www.gnu.org/licenses/gpl-faq.html#GPLOutput, dibaca 31 Okt 2026) | uji WER transkrip F2-03 | 31 Okt 2026 |
| Ilustrasi Nadi (Nota, Lempar, Amplop, Surat, Papan, Kalender, Slip, Kunci) | dibuat sendiri sebagai SVG sebaris, apps/web/src/components/ilustrasi (garis tinta currentColor, isian token kertas-2 dan kunyit, tanpa gradien, masing-masing < 15 KB, dicek ilustrasi.test.tsx) | milik proyek | keadaan kosong Feed, Kerja, Izin, Gaji, Agenda surat, Surat keluar, Serah terima; kepala Lempar | 1 Nov 2026 |
| Model deteksi objek RF-DETR nano ONNX q8 (onnx-community/rfdetr_nano-ONNX) | https://huggingface.co/onnx-community/rfdetr_nano-ONNX (diunduh saat uji; nanti oleh peramban pemilik) | Apache-2.0 | Mata: deteksi orang per cuplikan (F5-01) | 1 Nov 2026 |
| Foto latar "Empty restaurant interior HC08164.jpg" (Community Archives), versi 960 px | https://commons.wikimedia.org/wiki/File:Empty_restaurant_interior_HC08164.jpg | CC0 | fixtures/korpus/mata/sumber/latar.jpg, korpus uji Mata | 1 Nov 2026 |
| Foto "Man sitting by alcohol bottles (Unsplash).jpg" (Hatim Belyamani), versi 960 px | https://commons.wikimedia.org/wiki/File:Man_sitting_by_alcohol_bottles_(Unsplash).jpg | CC0 | fixtures/korpus/mata/sumber/orang1.jpg | 1 Nov 2026 |
| Foto "Man sitting with laptop (Unsplash).jpg" (Muhammad Raufan Yusup), versi 960 px | https://commons.wikimedia.org/wiki/File:Man_sitting_with_laptop_(Unsplash).jpg | CC0 | fixtures/korpus/mata/sumber/orang2.jpg | 1 Nov 2026 |
| Foto "Person sitting on a bench (Unsplash).jpg" (Olya Kuzovkina), versi 960 px | https://commons.wikimedia.org/wiki/File:Person_sitting_on_a_bench_(Unsplash).jpg | CC0 | fixtures/korpus/mata/sumber/orang5.jpg | 1 Nov 2026 |
