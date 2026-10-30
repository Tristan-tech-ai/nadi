# Eval Lempar Saja

Dijalankan 2026-10-30T19:55:55.006Z oleh `node scripts/eval-lempar.ts` (apps/web) terhadap Edge Function baca-berkas produksi Supabase.
Satu berkas korpus sintetis per jenis. Benar bila jenis tepat dan semua bidang kunci (fungsi `nilai` di supabase/functions/baca-berkas/inti.ts) cocok dengan jawaban.

**Hasil: 10 dari 10 benar.** Total token tercatat: 20021.

| Berkas | Jenis terbaca | Keyakinan | Panggilan model | Token | Penilaian | Waktu |
|---|---|---|---|---|---|---|
| nota/nota-01.png | nota | 93% | 1 | 561 | benar | 7.9 dtk |
| invoice/invoice-01.pdf | invoice | 95% | 1 | 2284 | benar | 3.6 dtk |
| slip_gaji/slip-01.pdf | slip_gaji | 95% | 1 | 2120 | benar | 3.0 dtk |
| ktp/ktp-01.png | ktp | 90% | 1 | 637 | benar | 3.2 dtk |
| cv/cv-01.pdf | cv | 95% | 1 | 2158 | benar | 3.2 dtk |
| surat_sakit/sakit-01.png | surat_sakit | 95% | 1 | 512 | benar | 2.9 dtk |
| absen/absen-01.xlsx | absen | 93% | 1 | 5371 | benar | 12.7 dtk |
| mutasi/mutasi-01.csv | mutasi | 95% | 1 | 3013 | benar | 9.3 dtk |
| surat/surat-01.pdf | surat | 95% | 1 | 2061 | benar | 2.7 dtk |
| excel_karyawan/karyawan-8-kolom-acak.xlsx | excel_karyawan | 97% | 1 | 1304 | benar | 5.3 dtk |

## Catatan

- Semua 10 berkas cukup dibaca model ringan (keyakinan 90-97%, di atas ambang naik 0,75), jadi model berat tidak terpanggil.
- Instruksi sistem di-cache: dari 10 panggilan, 17.784 token masuk terbaca dari cache, 1.976 ditulis ke cache, 10.908 token masuk biasa, 9.113 token keluar (tabel pemakaian_ai, 31 Okt 2026).
- Dijalankan ulang tanpa `--garam`: 10/10 berkas dijawab "sudah pernah, tidak diproses ulang" dalam 0,6-0,8 dtk tanpa token baru (berkas sama tidak diproses dua kali).
- Percobaan pertama gagal 10/10: skema keluaran dengan satu varian per jenis (anyOf) ditolak API, "The compiled grammar is too large". Diganti skema kecil + bidang_json yang dirapikan rapikan().
- Batas eval ini: satu berkas per jenis, semuanya sintetis dan bersih. Foto nota asli (miring, buram, tulisan tangan) belum diuji.
