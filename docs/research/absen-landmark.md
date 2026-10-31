# Fixture landmark dan uji jalur absen berhasil (Q-20)

Ditulis 1 Nov 2026 setelah membaca apps/web/src/lib/absen/wajah.ts, wajah.test.ts, components/absen/cek-wajah.tsx, absen-staf.tsx, app/absen/actions.ts. Lanjutan docs/research/absen-ujung.md.

## Yang ternyata sudah ada
- wajah.test.ts (8 tes) sudah menguji nilaiWajah dengan urutan Bingkai sintetis: orang sungguhan lulus, foto statis ditolak, foto diputar ditolak, arah salah ditolak, harus mulai lurus, dua wajah / bingkai kurang, yawDariLandmark, tantangan acak. Jadi "fixture landmark untuk logika" (opsi 2 di absen-ujung.md) sebagian besar SUDAH ada di tingkat Bingkai. Klaim di absen-ujung.md bahwa logika kedip/menoleh belum teruji terlalu luas.

## Celah yang sebenarnya
1. **Ekstraksi bingkai di cek-wajah.tsx tidak teruji**: indeks landmark hidung 1 dan pipi 234/454, rata-rata blendshape eyeBlinkLeft/Right, `faceLandmarks.length`. Bila indeks salah (mis. pipi tertukar), yaw berbalik tanda dan tantangan "kiri" selalu gagal, tetapi tes unit tetap hijau.
2. **Sambungan layar -> server action -> RPC absen_catat** belum pernah dijalankan dengan hasil lulus di browser.

## Kenapa tidak bisa menukar MediaPipe lewat route Playwright
`@mediapipe/tasks-vision` dibundel dari npm ke chunk Next (dynamic import), bukan dimuat dari CDN; yang diambil dari jsDelivr hanya berkas WASM, dan model dari /mediapipe/face_landmarker.task. Mengganti WASM dengan tiruan yang menghasilkan landmark berarti meniru ABI internal MediaPipe: rapuh dan tidak sepadan.

## Rancangan Q-20
1. **Pisahkan ekstraksi**: fungsi murni `bingkaiDari(hasil)` di src/lib/absen/wajah.ts yang menerima bentuk hasil detectForVideo ({faceLandmarks: {x}[][], faceBlendshapes: {categories: {categoryName, score}[]}[]}) dan mengembalikan Bingkai. cek-wajah.tsx memanggilnya. Fixture JSON kecil fixtures/absen/landmark-*.json: urutan hasil sintetis 478 titik (hanya x yang dipakai; titik lain 0,5) untuk lurus, kedip, menoleh kiri, menoleh kanan, foto statis. Tes: urutan "menoleh kiri" lulus untuk arah kiri dan gagal untuk kanan (menangkap pipi tertukar). Merah sengaja: tukar 234/454, tes harus gagal.
2. **Penanda pengganti untuk e2e lokal**: CekWajah menerima sumber hasil dari `window.__nadiUjiWajah` (larik hasil per bingkai) HANYA bila `process.env.NEXT_PUBLIC_NADI_UJI_WAJAH === "1"` saat build. Nilai itu disetel hanya oleh webServer Playwright lokal, tidak pernah di Vercel. Kamera tetap dibuka (kamera palsu Chromium), MediaPipe tidak dimuat, bingkai diambil dari fixture yang sama dengan uji unit. e2e: kios -> kode QR -> /absen?t&k -> cek wajah (fixture lulus sesuai arah yang diminta, dibaca dari teks status) -> "Absen masuk tercatat" -> kejadian absen.masuk ada di database (execute_sql di tes atau RPC absen_ragu).
3. **Bukti penanda mati di produksi**: e2e terhadap E2E_BASE_URL produksi menyetel `window.__nadiUjiWajah` lalu memastikan absen TIDAK tercatat (kamera palsu tanpa wajah -> pesan "Wajah belum terlihat jelas"). Ditambah cek build: grep chunk produksi tidak memuat `__nadiUjiWajah` (Next mengganti NEXT_PUBLIC_* saat build, sehingga cabang mati dihapus).

## Batas yang tetap jujur
Cek wajah tetap klaim dari perangkat (docs/research/absen.md baris 15): server hanya memeriksa `lulus = true`. Pertahanan nyatanya kode QR bergilir di tempat + batas 5 kode salah per menit (Q-13) + absen_ragu. Q-20 menguji bahwa jalur jujur bekerja, bukan bahwa pemalsuan mustahil.

## Kriteria terima Q-20 (diperbarui)
bingkaiDari + fixture + tes (merah sengaja dengan pipi tertukar); e2e lokal jalur berhasil mencatat absen.masuk; e2e produksi membuktikan penanda tidak berlaku; chunk produksi tanpa __nadiUjiWajah.
