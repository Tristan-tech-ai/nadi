# Mata di browser (F5-01)

Ditulis 1 Nov 2026. Kriteria: pada video uji, status meja benar >= 85%; tidak ada video yang dikirim ke server.

## Sumber primer (diakses 1 Nov 2026)
- Kartu model `onnx-community/rfdetr_nano-ONNX` (Hugging Face): lisensi Apache-2.0, `pipeline_tag: object-detection`, contoh
  `pipeline('object-detection', 'onnx-community/rfdetr_nano-ONNX')` lalu `detector(img, { threshold })`.
- Berkas ONNX di repo itu: `model.onnx` 108,1 MB (fp32), `model_fp16.onnx` 54,4 MB, `model_quantized.onnx`/`model_int8.onnx` 28,8 MB,
  `model_q4.onnx` 25,0 MB, `model_q4f16.onnx` 19,0 MB, `model_bnb4.onnx` 23,5 MB.
- Pengukuran sendiri sebelumnya (docs/research/ml-browser.md): fp32 WebGPU 78-108 ms per gambar setelah pemanasan, WASM ±1 dtk.
- Label keluaran mengikuti COCO (RF-DETR dilatih di COCO): yang dipakai `person`; `dining table` dan `chair` hanya untuk bantuan
  menggambar zona, tidak menentukan status.

## Rancangan
1. Sumber gambar: kamera perangkat (getUserMedia) atau berkas video yang dipilih pemilik. Bingkai dicuplik ke canvas tiap 2 detik
   dan langsung dibuang setelah dideteksi. Tidak ada gambar atau video yang diunggah; yang dikirim ke database hanya kejadian
   perubahan status (zona, status, waktu).
2. Model berjalan di Web Worker (pola public/transkrip-worker.js), transformers.js dari jsDelivr, varian terkuantisasi (q8) diukur
   ulang; ID dan varian model disimpan di public.konfigurasi (kunci model_mata), bukan di kode.
3. Editor zona: pemilik menggambar persegi/poligon di atas cuplikan, memberi nama (Meja 1, Kasir) dan jenis (meja, antrean, rak).
   Koordinat dinormalisasi 0..1 sehingga tidak bergantung resolusi.
4. Resep meja (modul murni `src/lib/mata/resep.ts`): orang dihitung di zona bila titik jangkarnya (tengah, tiga perempat ke bawah
   kotak orang: kira-kira pinggang orang duduk) ada di dalam poligon zona, skor >= ambang. Status meja `terisi` bila ada orang;
   perubahan status butuh beberapa cuplikan berturut-turut (histeresis) supaya orang lewat atau deteksi yang berkedip tidak
   mengubah status. Resep antrean: jumlah orang = median beberapa cuplikan terakhir.
5. Kejadian: `mata.meja` (zona, status, sejak) dan `mata.antrean` (zona, jumlah) hanya saat berubah, lewat RPC berhak pemilik/admin.
6. Uji akurasi: video uji sintetis berlisensi bebas dengan jawaban status per detik per zona; skrip menjalankan model + resep di
   peramban headless dan menghitung persen cuplikan yang statusnya benar.

## Keputusan terbuka
- Kotor/bersih meja tidak diukur di v1 (butuh model lain); hanya terisi/kosong.
- Varian model: q8 dulu (28,8 MB); bila akurasi turun di video uji, fp16.

## Hasil uji akurasi (1 Nov 2026)
- Korpus `fixtures/korpus/mata`: 60 cuplikan kolase (latar ruang makan kosong CC0 + 3 foto orang duduk CC0 ditempel ke 3 zona meja
  sesuai jadwal, plus orang lewat di lorong pada 4 cuplikan), dibuat ulang dengan `python -I scripts/korpus/mata.py <dir>`.
  Jawaban per cuplikan per zona di jawaban.json. Ini kolase sintetis, bukan rekaman kamera sungguhan.
- `node scripts/eval-mata.ts <dir> q8` (transformers.js 4.3.1 di Node, CPU): 90 ms per cuplikan; akurasi status meja dengan
  histeresis 91,7% (bilik kiri 90,0%, meja tengah 95,0%, meja kanan 90,0%), tanpa histeresis 99,4%. Selisih karena histeresis
  menunda peralihan 1-2 cuplikan, dan kolase tidak punya deteksi berkedip yang mau diredam histeresis.
- Deteksi per cuplikan disimpan (deteksi-q8.json) dan diuji vitest `src/lib/mata/korpus.test.ts` (>= 85%, orang lewat tidak
  mengisi meja). Merah sengaja: histeresis dibuat tidak pernah berganti, akurasi 47,2%, tes gagal.
- Belum: rekaman kamera sungguhan, uji di peramban (WebGPU) dengan model yang sama, editor zona, RPC kejadian.
