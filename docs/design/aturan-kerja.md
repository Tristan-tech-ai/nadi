# Kartu "Aturan kerja" di /app/perusahaan (Q-22)

Ditulis 1 Nov 2026, pasangan docs/research/pola-kerja.md. Satu tempat pemilik memilih pola kerja usaha; angka yang muncul semuanya dari pasal yang sudah dikutip (PP 35/2021 Pasal 21 ayat (2) dan 22, PP 36/2021 Pasal 17; docs/research/shift-f3-06.md dan upah-harian.md).

## Isi kartu (pemilik; admin dan akuntan melihat baca saja)
- Judul: "Aturan kerja".
- Pilihan dua baris (radio besar, bukan dropdown):
  - "6 hari seminggu, 7 jam sehari" dengan keterangan "Libur 1 hari seminggu. Upah sehari = upah sebulan dibagi 25."
  - "5 hari seminggu, 8 jam sehari" dengan keterangan "Libur 2 hari seminggu. Upah sehari = upah sebulan dibagi 21."
- Di bawah pilihan, satu kalimat sumber: "Mengikuti PP 35/2021 Pasal 21 dan 22 serta PP 36/2021 Pasal 17. Total tetap 40 jam seminggu."
- Kotak centang: "Jam kerja kami diatur sendiri di perjanjian kerja atau peraturan perusahaan" (PP 35/2021 Pasal 21 ayat (4)); bila dicentang, keterangan "Peringatan jadwal tetap tampil, tetapi hanya batas lembur yang menghentikan penyimpanan."
- Satu tombol utama: "Simpan aturan kerja".

## Dampak yang dijelaskan sebelum menyimpan
Bila pola berubah dan usaha sudah punya data: lembar konfirmasi berisi angka nyata, bukan kalimat umum:
- "Lembur hari libur yang sudah tercatat (12 baris) tidak berubah."
- "Mulai sekarang, lembur hari libur dicatat dengan aturan pola 5 hari."
- "Slip yang sudah disetujui tidak berubah. Slip draf bulan ini dihitung ulang saat kamu menyiapkannya lagi."
Tombol "Ganti ke 5 hari" dan "Batal". Tanpa dialog bawaan browser (S52); lembar bawah.

## Keadaan
- Belum pernah disimpan: pilihan 6 hari tampil terpilih dengan keterangan "Bawaan Nadi untuk warung dan toko. Ganti bila usahamu libur 2 hari seminggu."
- Berhasil: "Tersimpan. Usahamu bekerja 5 hari seminggu."
- Galat: "Aturan kerja belum tersimpan. Coba lagi; pilihanmu masih ada."
- Staf tidak melihat kartu ini.

## Teks (VOICE)
Sapaan "kamu"/"usahamu"; angka dengan satuan; tanpa tanda pisah panjang; tanpa kata "silakan". Status tidak hanya warna: pilihan terpilih diberi tanda centang dan teks "dipakai sekarang".

## Uji
e2e: pemilik mengganti pola, lembar dampak menyebut jumlah lembur lama, simpan, catat lembur libur pola lain ditolak dengan pesan yang menyebut pola usaha; admin melihat baca saja. Foto 390/1440 terang/gelap, axe.
