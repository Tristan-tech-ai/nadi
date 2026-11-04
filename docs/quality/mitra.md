# Direktori mitra (F6-04)

## Bukti
- Migrasi `20261104051000_mitra.sql`, md5 tanpa spasi `4934bc29`, sama dengan berkas repo.
- Tes SQL `supabase/tests/mitra.test.sql` 16/16, merah dulu karena tabel belum ada. Yang diuji:
  - tanpa kolom uang;
  - anon tidak membaca direktori;
  - data contoh tidak terverifikasi;
  - layanan harus milik mitra, dan pesan 10 sampai 1.000 huruf;
  - idempoten dan batas 10 sehari;
  - batal;
  - staf, admin, dan usaha lain dibatasi.
- e2e `e2e/mitra.spec.ts` lokal dan produksi:
  - spanduk data contoh dan label izin dengan pasalnya;
  - kirim permintaan ke psikolog contoh, dengan pesan "tidak sampai ke siapa pun";
  - permintaan muncul di Permintaanmu, lalu dibatalkan;
  - axe tanpa pelanggaran serius di 390 dan 1440 px, terang dan gelap, tanpa gulir datar.
- e2e `@bahasa-akun` memeriksa `/app/mitra` mode Inggris. Nama dan layanan mitra dari database bertanda lang=id.
- Tautan ke `/app/mitra` ada di halaman Orang dan Kompas Pajak.
