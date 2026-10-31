# Upah sehari untuk penggantian cuti (F3-07)

Ditulis 1 Nov 2026. Menutup butir "BELUM TERVERIFIKASI" di docs/research/serah-terima-sql.md (pembagi upah harian untuk sisa cuti tahunan saat berhenti, PP 35/2021 Pasal 40 ayat (4) huruf a).

## Sumber yang dibaca
- **PP 36/2021 Pengupahan**, teks asli https://peraturan.go.id/files3/pp-no-36-tahun-2021_asli.pdf (62 halaman, diakses 1 Nov 2026; laman JDIH BPK https://peraturan.bpk.go.id/Details/161909/pp-no-36-tahun-2021).
- **PP 51/2023** (perubahan pertama), https://peraturan.bpk.go.id/Details/270269/pp-no-51-tahun-2023: hanya mengubah Pasal 26, 28, 30, 33, 34, 35 (upah minimum). Pasal 17 tidak disebut.
- **PP 49/2025** (perubahan kedua, ditetapkan 17 Des 2025), https://peraturan.bpk.go.id/Details/339037/pp-no-49-tahun-2025: hanya mengubah Pasal 27, 28, 34. Pasal 17 tidak disebut.
Pemeriksaan "pasal yang diubah" dilakukan dengan mencari "Ketentuan Pasal N" di teks PDF hasil ekstraksi; PDF ber-OCR bisa melewatkan baris, jadi ini bukti kuat tetapi bukan pembacaan manual halaman per halaman.

## Kutipan
- **PP 36/2021 Pasal 17:** "Dalam hal Upah ditetapkan secara harian, perhitungan Upah sehari sebagai berikut: a. bagi Perusahaan dengan sistem waktu kerja 6 (enam) hari dalam seminggu, Upah sebulan dibagi 25 (dua puluh lima); atau b. bagi Perusahaan dengan sistem waktu kerja 5 (lima) hari dalam seminggu, Upah sebulan dibagi 21 (dua puluh satu)."
- **Pasal 40 ayat (5) dan Pasal 46:** pengusaha wajib membayar upah pekerja yang tidak masuk karena menjalankan cuti tahunan "sebesar Upah yang biasa diterima oleh Pekerja/Buruh"; Pasal 47: pelaksanaannya diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau PKB.
- **Pasal 66-67** (dasar pesangon/UPMK): upah pokok + tunjangan tetap; untuk upah harian, upah sebulan = 30 x upah sehari. Ini untuk pesangon, bukan untuk penggantian cuti.

## Kesimpulan jujur
- Pembagi 25/21 **terverifikasi** sebagai rumus resmi upah sehari dari upah sebulan, tetapi teksnya berlaku "dalam hal Upah ditetapkan secara harian". **Tidak ada pasal yang menyebut pembagi khusus untuk uang penggantian cuti** yang belum diambil (PP 35/2021 Pasal 40 ayat (4) huruf a hanya menyebut hak itu, tanpa rumus).
- Keputusan Nadi: hak_berhenti menawarkan **saran** sisa cuti x (upah sebulan / 25 untuk pola 6 hari, / 21 untuk pola 5 hari), dengan keterangan di layar: "Rumus upah sehari mengikuti PP 36/2021 Pasal 17. Aturan penggantian cuti tidak menyebut pembaginya; ikuti perjanjian kerja atau peraturan perusahaan bila berbeda." Nilai bisa diubah pemilik sebelum usulan dibuat; usulan menyimpan rumus dan sumbernya.
- Upah sebulan yang dipakai: pokok + tunjangan tetap (orang_rahasia.gaji.pokok + tunjangan_tetap), mengikuti "Upah yang biasa diterima" Pasal 46; tidak memakai tunjangan tidak tetap.
- Konsekuensi untuk aturan_bertanggal: tambah baris `upah.pembagi_harian` {pola_6: 25, pola_5: 21} terverifikasi=true dengan sumber Pasal 17, supaya angka tidak ditulis di kode.
