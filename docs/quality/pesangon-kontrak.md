# Cadangan pesangon: kontrak dan iuran dana pensiun (F4-09B)

Ditulis 4 Nov 2026. Rumus dan kutipan: docs/research/pesangon-f4-09.md bagian F4-09B.

## Bukti
- vitest `src/lib/gaji/pesangon.test.ts` 30/30 (8 kasus baru merah dulu):
  - kompensasi 9 bulan Rp3.000.000, 18 bulan Rp6.000.000;
  - kurang dari 1 bulan Rp0, pecahan dibuang;
  - kontrak tanpa mulai atau gaji tetap meminta isian;
  - iuran pensiun tertutup paling banyak sebesar kewajiban, tidak berlaku untuk kompensasi;
  - kekurangan = kewajiban - iuran tertutup - saldo.
- Tes SQL `supabase/tests/pesangon_kontrak_pensiun.test.sql` 15/15 (merah dulu: tabel, fungsi, aturan belum ada). Regresi `cadangan_pesangon.test.sql` 22/22.
- Migrasi `20261104049000_pesangon_kontrak_pensiun.sql`, md5 tanpa spasi `4d0099f7`, sama dengan berkas repo.
- e2e `e2e/pesangon-kontrak.spec.ts` (Warung Uji A):
  - baris kontrak "Uang kompensasi PKWT: 9 / 12 x Rp4.000.000" Rp3.000.000, dan catatan Pasal 16 ayat (6);
  - iuran Rp5.000.000 disimpan, lalu baris tetap menampilkan "Tertutup iuran dana pensiun Rp5.000.000" dan total tertutup tampil;
  - axe tanpa pelanggaran serius di 390 dan 1440 px, terang dan gelap, tanpa gulir datar;
  - data uji dinonaktifkan di akhir, bukan dihapus.
- Foto: baris tetap, baris kontrak, dan ringkasan kartu. Kartu penuh Warung Uji A berisi ratusan karyawan sisa uji, jadi foto seluruh kartu tidak terbaca.
