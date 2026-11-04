# Klaim pengeluaran karyawan (M-18)

Dibuat 5 Nov 2026.

## Alur
1. Pemilik/admin membuat kategori: nama, batas per orang per bulan (boleh kosong), akun beban 6-xxx, struk wajib atau tidak.
2. Staf mengajukan klaim di /app/klaim. Foto struk diunggah dari peramban seperti bukti izin. Teks e-struk (email atau aplikasi) boleh ditempel; pengurai tanpa model (src/lib/klaim/struk.ts) mengisi jumlah, tanggal, dan menebak kategori. Staf tetap memeriksa.
3. Database (public.ajukan_klaim) menolak: tanpa struk bila wajib, tanggal di masa depan atau lebih dari 60 hari, melebihi batas bulan (pesan menyebut sisa), tanggal di luar perjalanan dinas.
4. Usulan klaim.setujui lewat rantai M-11B: atasan langsung (atau delegasinya), lalu pemilik/admin di Feed.
5. Disetujui: jurnal D akun kategori / K 2-160 Utang penggantian biaya karyawan.
6. Dibayar:
   - lewat slip: komponen pendapatan kode penggantian sebesar sisa klaim yang disetujui; saat periode disetujui klaim lunas (tertua dulu), jurnal D 2-160 / K 1-110;
   - atau kas/bank oleh pemilik: D 2-160 / K 1-100 atau 1-110.

## Perjalanan dinas
- Diajukan staf (tujuan, tanggal, keperluan, uang muka), lewat rantai yang sama.
- Uang muka dibayar pemilik: D 1-160 Uang muka perjalanan dinas / K kas atau bank.
- Klaim perjalanan hanya bertanggal di dalam perjalanan.
- Diselesaikan pengelola setelah semua klaimnya diputus:
  - klaim dipotong dari uang muka (D 2-160 / K 1-160);
  - bila klaim lebih besar, sisanya dibayar seperti klaim biasa;
  - bila uang muka lebih besar, sisanya menjadi kasbon (D 1-150 / K 1-160) yang dicicil lewat slip (M-10B).

## Penggantian di slip
- Komponen penggantian bukan upah: tidak masuk bruto PPh 21 (ringkasKomponen) dan tidak menjadi dasar batas potongan 50% PP 36/2021 Pasal 65 (trigger jaga_potongan_upah dan cicilanKasbon).
- Database menolak penggantian di atas sisa klaim yang disetujui.
- BELUM TERVERIFIKASI: perlakuan PPh 21 atas penggantian biaya berstruk dianggap bukan penghasilan pegawai; pasal PMK yang mengaturnya belum dibaca dari teks resmi. Sampai dibaca, layar menyebutnya penggantian biaya dan akuntan memeriksa.

## Korpus struk
- scripts/korpus/struk.py menulis 32 struk sintetis (SPBU, parkir, tol, ojek daring, rumah makan, hotel, alat tulis, paket data) ke fixtures/korpus/struk dengan harapan.json.
- src/lib/klaim/struk.test.ts mengharuskan total, tanggal, dan kategori masing-masing >= 90%; hasil 32/32 untuk ketiganya.
- Korpus dibuat sendiri, jadi angka ini menguji aturan terhadap format yang dikenal, bukan struk nyata. Struk nyata dan foto (OCR) adalah tugas M-18B.

## Belum
- Baca foto struk dengan model (lewat baca-berkas).
- Uang harian dan batas per kota tujuan.
- Pemeriksa kewajaran berbasis model untuk kategori ragu.
