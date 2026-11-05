# Eval foto struk klaim (M-18B)

Diukur 6 Nov 2026. Korpus sintetis `fixtures/korpus/struk` (32 struk: SPBU, parkir, tol, ojek daring, rumah makan, hotel, toko,
kuitansi tulis tangan tanpa nama toko), dirender jadi foto oleh `apps/web/scripts/korpus/struk-foto.py`:

- **normal**: foto lurus, sedikit derau dan miring;
- **sulit**: miring lebih jauh, buram, kontras rendah, bayangan, kertas thermal pudar.

Jawaban benar di `fixtures/korpus/struk/harapan.json`.

## Tangga di layar Klaim

1. OCR di HP (tesseract.js `ind`, `src/lib/ocr.ts`), lalu aturan `bacaStruk`. Tidak memakai token.
2. Bila keyakinan OCR kurang dari 85 (`AMBANG_OCR`) atau total tidak terbaca, foto diunggah. `baca-berkas` lalu membaca dengan `mode: "struk"`:
   - model ringan dulu;
   - model berat bila total kosong atau keyakinan di bawah `ambang_naik` (ID model di tabel `konfigurasi`);
   - jalur ini tidak membuat usulan nota.
3. Angka apa pun yang terisi diperiksa staf sebelum klaim diajukan. Pemilik atau atasan tetap menyetujui di Feed.

## Hasil

| Set | OCR saja: total benar | Diterima dari OCR (salah) | Dialihkan ke model | Model: total benar | Tangga: total benar |
|---|---|---|---|---|---|
| normal | 32/32 (100%) | 29 (0) | 3 | belum diukur terpisah | 32/32 (100%) |
| sulit | 20/32 (62,5%) | 1 (0) | 31 | 31/32 (96,9%) | 31/32 (96,9%) |

Rincian lain:
- **Tanggal pada set sulit:** OCR saja 14/32 benar, jalur model 32/32 benar.
- **Token:** jalur model memakai rata-rata 240 token per foto (token masuk + keluar, `pemakaian_ai` tugas `baca_struk`). Model berat tidak pernah terpakai: semua jawaban model ringan berkeyakinan ≥ ambang.
- **Kecepatan OCR di perangkat:** rata-rata 221 ms per foto normal dan 128 ms per foto sulit (Node, laptop uji).

Satu salah baca: struk-13 sulit, rumah makan. Model menulis 88.600, padahal yang benar 83.600 (keyakinan 0,85). Angka 3 yang pudar terbaca 8. Kesalahan seperti ini tertangkap karena:
- staf memeriksa jumlah sebelum mengajukan;
- foto struk ikut menempel pada klaim;
- pemilik atau atasan menyetujuinya di Feed.

Batas kategori juga menolak jumlah di atas sisa batas.

## Cara mengulang

Jalankan dari `apps/web`:

- `node scripts/eval-struk-foto.ts` (set normal) dan `TINGKAT=sulit node scripts/eval-struk-foto.ts` (set sulit):
  - jalankan OCR;
  - menulis `fixtures/korpus/struk-foto[/sulit]/ocr/*.txt`;
  - mencetak kebijakan.
- `TINGKAT=sulit node scripts/eval-struk-model.ts`:
  - memanggil Edge Function yang terdeploy dengan akun uji A (usaha "Uji Klaim E2E");
  - foto diberi ekor byte unik per jalan agar tidak dianggap berkas sama;
  - memakai token sungguhan.
- Vitest `src/lib/klaim/struk-foto.test.ts`:
  - menguji ulang teks OCR tersimpan tanpa jaringan;
  - set normal ≥ 90%;
  - set sulit harus < 90%, bukti bahwa jalur model memang dibutuhkan. Tes ini bisa merah bila OCR saja tiba-tiba cukup.
