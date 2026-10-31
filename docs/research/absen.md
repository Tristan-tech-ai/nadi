# Absen QR berputar + cek wajah hidup (F1-02)

Dibaca 31 Okt 2026. Sumber di akhir.

## Masalah yang dijawab
Absen dititipkan (teman memindai atau memotret QR untuk temannya) dan pegawai siluman (P03, P04). Syaratnya: orangnya hadir di tempat, pada saat itu, dan wajahnya hidup, tanpa menyimpan foto wajah.

## Rancangan
1. **QR berputar (TOTP, RFC 6238).** Setiap tempat punya rahasia acak 20 byte di skema `app` (tidak terbuka ke API). Kode 6 angka = HOTP(rahasia, T), T = floor(waktu Unix / 15), HMAC-SHA1, pemotongan dinamis RFC 4226. Dihitung di Postgres (pgcrypto `hmac`). Tablet kios (pemilik/admin masuk) meminta kode lewat RPC `kode_absen` dan menampilkannya sebagai QR berisi URL `/absen?t=<tempat>&k=<kode>`; rahasia tidak pernah keluar dari database.
2. **Validasi.** RPC `absen_catat` menerima kode langkah sekarang atau satu langkah sebelumnya (RFC 6238: paling banyak satu langkah untuk keterlambatan jaringan), jadi kode berlaku 15 sampai 30 detik. Kode yang sama tidak diterima dua kali untuk orang dan jenis absen yang sama (RFC 6238 §5.2). Foto QR yang dikirim ke teman kedaluwarsa sebelum sempat dipakai.
3. **Cek wajah hidup di perangkat.** MediaPipe Face Landmarker (`@mediapipe/tasks-vision` 1.2.0, model `face_landmarker.task` Apache-2.0 sudah di `public/mediapipe`) berjalan di browser, mode VIDEO, `outputFaceBlendshapes` dan `outputFacialTransformationMatrixes`. Tantangan acak: kedip (blendshape `eyeBlinkLeft/Right` naik di atas 0,5 setelah di bawah 0,2) lalu menoleh ke arah yang diminta (yaw dari matriks transformasi melewati ±15°). Foto atau layar statis tidak bisa berkedip dan menoleh sesuai urutan acak. Hanya hasil (lulus, kedip, menoleh) yang dikirim; gambar kamera tidak pernah diunggah atau disimpan.
4. **Catatan.** Absen menjadi kejadian `absen.masuk` / `absen.pulang` (sumber `pwa`) dengan tempat, langkah TOTP, dan ringkasan cek wajah.

## Batas yang jujur
- Cek wajah berjalan di perangkat staf, jadi orang yang sengaja mengakali aplikasi (memalsukan hasil cek) tidak tertahan oleh langkah ini saja. Pertahanannya berlapis: QR 15 detik mewajibkan hadir di tempat, dan pola absen aneh ditandai belakangan (F1-04 Gerbang Gaji).
- Tablet kios v1 masuk sebagai pemilik/admin. Token khusus kios (hanya bisa meminta kode) dicatat sebagai tugas lanjutan.

## Sumber (diakses 31 Okt 2026)
- RFC 6238 TOTP: https://datatracker.ietf.org/doc/html/rfc6238 (T = (waktu Unix - T0)/X dibulatkan ke bawah, X bawaan 30, HMAC-SHA1/256/512 boleh, paling banyak satu langkah untuk keterlambatan jaringan, kode yang sudah sah tidak boleh diterima kedua kali, vektor uji Lampiran B)
- RFC 4226 HOTP §5.3 pemotongan dinamis: https://datatracker.ietf.org/doc/html/rfc4226
- MediaPipe Face Landmarker web: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js (opsi numFaces, outputFaceBlendshapes, outputFacialTransformationMatrixes, mode VIDEO, 52 blendshape, *Left/*Right milik subjek)
- npm @mediapipe/tasks-vision 1.2.0 (30 Okt 2026)
