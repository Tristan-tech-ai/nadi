# Kualitas: Analis Malam + Sarapan Data (F5-03)

Diperiksa 1 Nov 2026.

## Alur
1. 17.40 UTC `app.susun_insight()` (pg_cron nadi-sarapan-susun): per usaha yang dipakai (anggota aktif) dan usaha demo, kandidat dari `app.kandidat_insight` disaring ambang dan diambil paling banyak 3, urut dampak rupiah. Tanpa kandidat yang lolos: tidak ada baris.
2. 17.50 UTC `app.panggil_analis('kirim')` memanggil Edge Function `analis-malam` (token Vault) yang membuat satu Message Batch, satu permintaan per usaha.
3. Tiap 20 menit 18.00 sampai 22.40 UTC `app.panggil_analis('ambil')`: batch yang sudah `ended` dibaca, kalimat yang lolos `periksaKalimat` disimpan sebagai `teks_model` (sekali, tidak menimpa).
4. 23.00 UTC (07.00 WITA) `app.kirim_sarapan()` mengirim satu Web Push per usaha non-demo yang punya insight hari ini (Edge Function push, aksi sarapan, tautan /app#sarapan).

## Bukti
- Migrasi `20261101036000_sarapan_data.sql` (sidik e9be827c, 86 migrasi). Tes SQL `supabase/tests/sarapan_data.test.sql` 20/20: tiga hal persis (Rp1.300.000, Rp1.000.000, Rp250.000) urut dampak dengan teks berangka; usaha berangka kecil dan usaha berambang tinggi tanpa insight; idempoten per hari; RLS dan RPC hanya pemilik/admin (staf, anon, usaha lain ditolak/kosong); bahan Analis Malam hanya peran layanan; teks_model sekali; push diantrekan hanya untuk usaha yang punya insight, demo tidak. Merah dulu: tabel dan fungsi belum ada. Percobaan pertama tes gagal karena data tes (pengingat yang tanggalnya sudah lewat memang tidak pernah dijadwalkan buat_invoice), diperbaiki di tes.
- Vitest `src/lib/analis-malam.test.ts` 6/6: rupiah berubah, bertambah, hilang, tanda pisah, emoji, terlalu panjang ditolak; id asing/ganda diabaikan; custom_id sesuai batas.
- Batch nyata dengan data demo sintetis: lihat bagian hasil di bawah.
- get_advisors: tanpa ERROR; WARN SECURITY DEFINER untuk sarapan_data disengaja (peran diperiksa di dalam).

## Isi demo (1 Nov 2026)
- Warung makan: belanja 7 hari Rp3.148.500 naik Rp1.406.000; 1 tagihan lewat tempo Rp716.000.
- Toko grosir: belanja 7 hari Rp19.850.000 naik Rp7.357.500; 1 tagihan lewat tempo Rp716.000.
- Usaha nyata yang ada saat ini: tidak ada insight yang lolos ambang, jadi tidak ada pesan.

## Batas yang diketahui
- Belanja hanya dari kejadian uang.keluar (nota yang dilempar); usaha yang belum mencatat belanja tidak mendapat insight belanja.
- Ambang diubah lewat pengaturan usaha (belum ada layar).

## Hasil batch nyata (1 Nov 2026, data demo sintetis)
- 1 batch, 2 permintaan (fnb, toko): "2 berhasil, 0 galat, 0 kedaluwarsa"; selesai sebelum panggilan ambil berikutnya (kurang dari 10 menit).
- Token tercatat di pemakaian_ai (tugas analis_malam): 820/244 dan 811/254 (masuk/keluar), harga batch 50%.
- 4 dari 4 kalimat lolos pemeriksaan angka dan tersimpan, contoh: "Belanja kamu 7 hari terakhir Rp19.850.000, naik Rp7.357.500 dari rata-rata mingguan bulan lalu (Rp12.492.500). Nota terbesar dari PT Sumber Pangan Lestari sebesar Rp12.400.000."
- E2E `e2e/sarapan.spec.ts` lokal 2/2: /demo dan /demo/toko, 1 sampai 3 butir berangka rupiah, axe tanpa pelanggaran serius 390/1440 terang/gelap, tanpa gulir samping.
