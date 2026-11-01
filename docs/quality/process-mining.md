# Kualitas: alur nyata vs alur kertas (F6-03)

Diperiksa 1 Nov 2026.

## Bukti
- Migrasi `20261101034000_alur_proses.sql` (sidik ccacf7bd, 84 migrasi), tes SQL `supabase/tests/alur_proses.test.sql`: merah sebelum migrasi (isi ulang, fungsi, demo), 24/24 dalam uji kering dan 24/24 setelah apply. Kasus sintetis berjalur diketahui: jumlah kasus, selesai, sesuai kertas, sisi + median (17,5 hari), median siklus (14), varian teratas, enam penyimpangan, jendela 7 hari, isolasi usaha, trigger dari RPC sungguhan (buat_invoice, catat_pengingat, tandai_lunas, batal_invoice, ubah_tahap_lamaran, insert lamaran), staf/anon ditolak, jenis tak dikenal ditolak, demo 20 invoice + 15 lamaran, isi demo idempoten.
- get_advisors: hanya WARN SECURITY DEFINER untuk public.alur_proses (disengaja, peran diperiksa di dalam lewat peran_aktif, pola sama dengan pembanding_usaha).
- Vitest `src/lib/alur/alur.test.ts` 6/6 (merah dulu: modul belum ada).
- e2e `e2e/alur.spec.ts` lokal 2/2: /demo dan /demo/toko, axe tanpa pelanggaran serius di 390/1440 terang/gelap, tanpa gulir samping, tanpa tanda pisah, tanpa kode mentah (pengingat_).

## Isi demo (fnb, 1 Nov 2026)
- Invoice: 20 kasus, 18 selesai, 12 sesuai kertas, median siklus 13,2 hari; 5 dari 17 lunas lewat jatuh tempo, 2 lewat jatuh tempo tanpa pengingat, 1 batal setelah pengingat.
- Rekrut: 15 kasus, 11 selesai, 5 sesuai kertas; 3 dari 5 diterima tanpa ditinjau, 3 dari 6 ditolak tanpa ditinjau, 2 menggantung lebih dari 14 hari.

## Batas yang diketahui
- Riwayat tahap lamaran sebelum migrasi hanya punya tahap terakhir (isi ulang: masuk lalu tahap terakhir).
- Umur kejadian 90 hari, jadi jendela alur paling panjang 90 hari.
- Tanggal lunas yang diisi mundur dicatat pukul 12.00 zona usaha; urutan dengan pengingat di hari yang sama bisa tidak persis.
- Regresi tes SQL invoice/rekrut lama tidak dijalankan ulang penuh; jalur yang sama (buat_invoice, tandai_lunas, batal_invoice, catat_pengingat, ubah_tahap_lamaran, insert lamaran) dijalankan di tes ini dan lulus dengan trigger baru.
