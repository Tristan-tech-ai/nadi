# Rasio baca tanpa model per jenis berkas (H-02)

4 Nov 2026. Alat ukur: `app.rasio_baca(hari)` (migrasi 20261104040000_rasio_baca, sidik 4c07d2ac, 90 migrasi, tes SQL
rasio_baca 7/7, merah dulu: fungsi belum ada). Operator saja, tidak dibuka ke API. Token = baca_berkas + tulis_aturan per berkas.

## Sebelum (produksi, 30 hari, data uji)
| Jenis | Berkas | Tanpa model | Model | Rasio | Token |
|---|---|---|---|---|---|
| cv | 47 | 0 | 47 | 0% | 250.402 |
| invoice | 8 | 2 | 6 | 25% | 62.992 |
| ktp | 23 | 0 | 23 | 0% | 60.596 |
| mutasi | 8 | 4 | 4 | 50% | 37.292 |
| nota | 41 | 35 | 6 | 85% | 30.856 |
| absen | 4 | 2 | 2 | 50% | 28.369 |
| slip_gaji | 8 | 6 | 2 | 75% | 15.261 |
| excel_karyawan | 1 | 0 | 1 | 0% | 13.465 |
| **semua** | 140 | 49 | 91 | 35% | 499.233 |

CV memakan separuh semua token baca berkas. Sebabnya: setiap pelamar memakai tata letak sendiri, jadi aturan per tata letak
(ekstraktor terkompilasi) tidak pernah terpakai ulang, tetapi model berat tetap dipanggil untuk menulis aturan itu
(12 panggilan tulis_aturan untuk CV, 42.715 token, semuanya sia-sia).

## Yang diubah
1. `supabase/functions/baca-berkas/cv.ts`: pengurai CV berteks dari judul bagiannya (Pengalaman/Riwayat Pekerjaan/Work
   Experience, Keahlian/Kemampuan/Skills, Pendidikan/Education), tiga pola baris pengalaman, posisi dari "Melamar sebagai",
   "Posisi yang dilamar", "Applying for". Bila nama tidak ditemukan atau satu baris pengalaman tidak terurai: null, jatuh ke
   model. Lebih baik membayar token daripada mencatat pelamar yang salah. Dicoba setelah aturan tersimpan, juga untuk lamaran.
2. `tulis_aturan` tidak lagi dipanggil untuk CV.
3. Usulan menyebut sumbernya: "Dibaca dari bagian-bagian CV, tanpa AI. Periksa ejaan nama dan tempat kerja."

## Bukti
- vitest cv.test.ts 3/3 (merah dulu: modul belum ada): korpus 4 dari 4 CV dengan semua bidang benar (sebelumnya 0 dari 4 tanpa
  model), dua format lain (judul bagian lain, "di" sebagai pemisah, "sekarang", bahasa Inggris), dan teks bukan CV ditolak.
- Produksi: baca-berkas v11 (isi index/inti/ekstraktor/cv identik repo, md5 per berkas dicocokkan); e2e produksi lamar.spec
  lulus, CV pelamar terbaca `sumber: aturan`, 0 token, 0 panggilan model.

## Batas yang diketahui
- Korpus CV sintetis memakai satu templat; dua format tambahan hanya di tes unit. CV nyata dengan tabel dua kolom atau
  pengalaman yang ditulis beberapa baris akan tetap ke model (aman, tetapi berbayar).
- KTP (jenis kedua terbanyak, 60.596 token) adalah foto; perlu OCR di perangkat yang cukup yakin, jadi belum disentuh di sini.
