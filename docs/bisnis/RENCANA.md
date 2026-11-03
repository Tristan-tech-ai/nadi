# Rencana bisnis Nadi sebagai SaaS

Ditulis 3 Nov 2026 atas permintaan Tristan. Semua angka harga, biaya, dan pasar di bawah adalah RUMUS dan KERANGKA; angka nyata
diisi dari sumber primer (halaman harga resmi pesaing, tarif resmi penyedia, data pemakaian Nadi sendiri) dan ditandai sumbernya.
Angka karangan dilarang (ANTI-SLOP S34).

## 1. Riset harga (B-01)
- Pesaing per kategori yang dipakai UMKM Indonesia: kasir/operasional, HR dan gaji, akuntansi, absen. Ambil harga dari halaman resmi
  masing-masing dengan tanggal akses; catat satuan harganya (per usaha, per karyawan, per outlet, per fitur).
- Pertanyaan yang dijawab: berapa yang sudah dibayar UMKM untuk 3-4 aplikasi terpisah yang digantikan Nadi, dan satuan harga apa
  yang paling mudah dipahami pemilik warung.

## 2. Paket (B-02)
Kerangka awal (angka menyusul B-01, diuji dengan biaya per usaha dari H-01):
- Gratis: 1 usaha, sedikit orang, Lempar Saja dengan kuota AI kecil, Feed, absen, invoice. Tujuan: akuisisi tanpa biaya iklan.
- Usaha: gaji + PPh 21 + BPJS, izin otopilot, jadwal, Sarapan data, Ruang Akuntan untuk 1 akuntan.
- Tumbuh: banyak cabang, Mata + Peta usaha, rekrut + wawancara, MCP untuk AI milik pengguna, prioritas batch malam.
- Perusahaan: SSO, audit, dukungan, kontrak tahunan.
Satuan harga kandidat: per usaha per bulan + per orang aktif di atas batas paket. Tagihan tahunan dengan potongan.

## 3. Ekonomi unit (B-02, model di docs/bisnis/model.xlsx)
- ARPU = pendapatan per akun berbayar per bulan.
- Biaya layanan per usaha (COGS) = token AI + storage + egress + bagian infrastruktur tetap (dari H-01, bukan tebakan).
- Margin kotor = (ARPU - COGS) / ARPU. Target SaaS sehat dicatat dari sumber yang dikutip, bukan dari ingatan.
- CAC = biaya pemasaran dan penjualan / akun berbayar baru.
- Churn bulanan c; umur pelanggan = 1 / c; LTV = ARPU x margin kotor / c.
- Masa balik CAC = CAC / (ARPU x margin kotor).
- Konversi gratis ke berbayar diukur dari data, awal berupa skenario rendah/tengah/tinggi.

## 4. Modal dan runway (B-03)
- Kebutuhan modal untuk N pengguna berbayar = (biaya tetap bulanan x bulan sampai N) + (CAC x akun baru) + COGS paket gratis
  - pendapatan pada periode itu; ditambah cadangan.
- Biaya tetap: infrastruktur di tiap tingkat paket penyedia (Supabase, Vercel, model AI) dari halaman harga resmi, domain, tanda
  tangan aplikasi bila ada, waktu tim.
- Tiga skenario (hemat, wajar, agresif) untuk N = 100, 1.000, 10.000 usaha; keluaran: bulan ke titik impas, modal maksimum yang
  terpakai, runway.

## 5. Investor (B-04, paling akhir)
- Syarat sebelum mencari investor: angka nyata pemakaian dan retensi, bukan proyeksi saja.
- Bahan: pitch deck (masalah, solusi, demo, pasar dari sumber resmi, ekonomi unit, tim, permintaan dana), demo hidup, video promo.
- Daftar akselerator, program inkubasi, dan investor tahap awal yang aktif di Indonesia, diverifikasi dari situs resmi masing-masing.
- Menghubungi investor atau mendaftar program = tindakan atas nama Tristan; loop menyiapkan bahan dan menulisnya di UNTUK-TRISTAN.md.

## Tugas
B-01 riset harga pesaing; B-02 paket + model ekonomi unit (xlsx); B-03 modal dan runway tiga skenario; B-04 pitch deck + daftar
investor/akselerator terverifikasi.
