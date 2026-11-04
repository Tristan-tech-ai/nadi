# Perkiraan biaya mendarat impor (B-EKSIM2)

Ditulis 4 Nov 2026. Dasar: docs/research/ekspor-impor.md bagian 3 dan aturan bertanggal terverifikasi R-EKSIM2 (`pph22.impor`, `ppn.impor`, migrasi 20261104046000).

## Yang dihitung (`src/lib/impor/biaya.ts`, layar `/app/impor`)
- **CIF:** harga barang (FOB) + ongkos kirim + asuransi, dalam sen USD.
- **CIF rupiah:** CIF x kurs pajak isian pengguna (kurs KMK mingguan).
- **Bea masuk:** tarif ad valorem isian pengguna (dari BTKI atau insw.go.id) x CIF rupiah. Nadi tidak menentukan kode HS.
- **Nilai impor:** CIF + bea masuk. Teks PMK 51/2025 Pasal 3 ayat (2), dari OCR PDF resmi: "nilai berupa uang yang menjadi dasar penghitungan bea masuk yaitu cost insurance and freight ditambah dengan bea masuk dan pungutan lainnya".
- **PPN impor:** 12% x 11/12 x nilai impor untuk barang bukan mewah; 12% x nilai impor penuh untuk barang mewah (PMK 131/2024). PPnBM tidak dihitung.
- **PPh 22 impor:** tarif menurut kelompok dan API (PMK 51/2025 Pasal 3 ayat (1) huruf a angka 1), x nilai impor:
  - barang umum dengan API 2,5%, tanpa API 7,5%;
  - barang tertentu 10%;
  - barang tertentu lainnya 7,5%;
  - kedelai, gandum, terigu dengan API 0,5%, tanpa API 7,5%;
  - emas batangan 0,25%.
- **Uang keluar:** CIF + bea + pajak + biaya lain.
- **Biaya mendarat untuk harga pokok:** CIF + bea masuk + biaya lain. PPN impor (pajak masukan bila PKP) dan PPh 22 (kredit pajak, tidak final) tidak dimasukkan.
- **Pembulatan:** persen dihitung lewat basis poin bulat lalu dibulatkan ke rupiah terdekat. Pembulatan billing resmi bisa berbeda.

## Batas
- Bea masuk tambahan, antidumping, safeguard, tarif spesifik, cukai, dan PPnBM belum dihitung. Layar menyebutnya.
- Perkiraan tidak disimpan dan tidak dikirim ke server. Layar dan kotak "bukan kode billing" menyatakan angka resmi tetap dari PIB di CEISA.
- Kurs tidak diambil otomatis.

## Bukti
- vitest `src/lib/impor/biaya.test.ts` 4/4, merah dulu karena modul belum ada. Contoh: CIF USD 10.850 x Rp16.287,5 = Rp176.719.375; bea masuk 5% Rp8.835.969; nilai impor Rp185.555.344; PPN Rp20.411.088; PPh 22 2,5% Rp4.638.884 (7,5% Rp13.916.651); barang mewah PPN Rp22.266.641.
- e2e `e2e/impor.spec.ts`:
  - angka yang sama di layar;
  - mengganti API, barang mewah, dan emas batangan (0,25%, Rp463.888);
  - sumber tarif dari database tampil;
  - axe tanpa pelanggaran serius di 390 dan 1440 px, terang dan gelap;
  - tanpa gulir datar.
- e2e `@bahasa-akun` memeriksa `/app/impor` mode Inggris; sumber tarif bertanda lang=id.
