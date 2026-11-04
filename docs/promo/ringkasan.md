# Nadi dalam satu halaman

**Nadi** adalah sistem kerja untuk usaha kecil Indonesia.

Pemilik cukup memotret atau melempar nota, slip, KTP, CV, surat dokter, Excel, atau mutasi bank. Nadi membaca isinya dan menyiapkan usulan berbukti. Pemilik tinggal menyetujui atau menolak dari HP.

- **Coba tanpa daftar:** https://nadi-swart.vercel.app/demo
- **Video 46 detik:** docs/promo/nadi-promo.mp4
- **Panduan per peran:** https://nadi-swart.vercel.app/panduan

## Masalah
Usaha kecil membayar beberapa aplikasi terpisah dan tetap mengetik ulang angka dari kertas.

Contoh: gaji Gadjian Standar + akuntansi Kledo Pro untuk 10 orang sudah Rp222.400 per bulan (harga resmi, 3 Nov 2026), belum termasuk kasir dan absen.

## Yang sudah berjalan di produksi
- **Gaji:** PPh 21 TER dan BPJS dari teks peraturan resmi bertanggal, lembur sesuai PP 35/2021, slip lewat tautan.
- **Absen dan izin:** absen QR yang berganti tiap 15 detik dengan cek wajah di perangkat. Izin disetujui otomatis bila aturan pemilik terpenuhi, dengan alasan tertulis.
- **Tagihan:** invoice dengan QRIS milik usaha sendiri, pengingat jatuh tempo, dan pencocokan mutasi bank.
- **Mata dan Peta:** kamera atau tablet membaca meja dan antrean di perangkat. Agen lokal 2 MB tersedia untuk kamera CCTV.
- **Sarapan data:** setiap pagi, paling banyak tiga temuan yang berdampak rupiah.
- **Rekrut:** lowongan dengan penjaga bias, wawancara suara, dan uji kerja.

## Kenapa biayanya rendah
AI dipakai bertingkat:
1. aturan pasti lebih dulu;
2. lalu ekstraktor yang sekali dibuat dan dipakai ulang tanpa token;
3. model besar hanya bila keyakinan rendah.

Biaya AI dan server sekitar Rp6.896 per usaha berbayar per bulan (model biaya H-01). Keluaran AI tidak pernah menyetujui uang atau menghapus data.

## Angka uji (bukan pengguna)
- Tata letak nota uji terbaca tanpa model: 5 dari 5.
- Mutasi bank cocok otomatis ke invoice: 91,7%, dengan 0 salah lunas.
- Keadaan meja benar oleh agen kamera: 94,4%.

## Harga rencana
| Paket | Harga per bulan |
|---|---|
| Gratis | Rp0 |
| Usaha | Rp149.000 |
| Tumbuh | Rp349.000 |
| Perusahaan | mulai Rp1.500.000 |

Selama masa uji semua paket gratis. Belum ada pengguna berbayar.

## Langkah berikutnya
- Kumpulkan 100 usaha pertama lewat paket Gratis, mitra akuntan, dan lomba. Modal yang dibutuhkan sebelum impas sekitar Rp1,4 juta (docs/bisnis/modal.md).
- Ganti asumsi churn dan CAC di model dengan data nyata.
- Bila retensi terbukti, cari pendanaan pra-seed.
