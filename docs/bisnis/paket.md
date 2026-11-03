# Paket dan ekonomi unit (B-02)

Ditulis 3 Nov 2026. Model berumus: docs/bisnis/model.xlsx (lembar Asumsi, Paket, Ekonomi unit; sel biru = isian, kuning = asumsi
tanpa data pelanggan, hitam = rumus; dihitung ulang dengan LibreOffice, 0 galat rumus). Semua harga tanpa PPN, seperti halaman
pesaing. Angka di bawah disalin dari hasil hitung model; ubah isian di model, bukan di berkas ini.

## Paket
| Paket | Harga dasar/bln | Orang termasuk | Orang tambahan | Isi utama |
|---|---|---|---|---|
| Gratis | Rp0 | 5 | tidak bisa | 1 usaha, Lempar 100 berkas/bln, Feed, absen QR, izin, invoice + QRIS |
| Usaha | Rp149.000 | 15 | Rp5.000 | gaji + PPh 21 + BPJS, Gerbang Gaji, izin otopilot, jadwal, Sarapan Data, Ruang Akuntan, 1.000 berkas |
| Tumbuh | Rp349.000 | 50 | Rp5.000 | banyak cabang, Mata + Peta Usaha, rekrut + wawancara suara, MCP, Kompas Pajak, cocok mutasi, 5.000 berkas |
| Perusahaan | mulai Rp1.500.000 | 150 | Rp4.000 | SSO, audit, dukungan prioritas, kontrak tahunan |
Tagihan tahunan = 2 bulan gratis.

## Alasan
- Satuan **per usaha + per orang di atas batas**: pemilik warung paham "per usaha"; harga naik pelan mengikuti jumlah orang, seperti
  aplikasi gaji (Rp6.000-Rp20.000/orang di Gadjian), tanpa menghukum usaha kecil.
- **Usaha Rp149.000** berada di bawah gabungan gaji Gadjian Standar + akuntansi Kledo Pro untuk 10 orang (Rp222.400, harga resmi
  3 Nov 2026), padahal mencakup absen, izin otomatis, invoice QRIS, dan pembacaan berkas.
- **Tumbuh Rp349.000** di bawah satu modul tambahan majoo (Keuangan atau Team Rp499.000 per outlet).
- **Gratis** adalah jalan akuisisi. Biayanya per usaha sekitar Rp2.200/bln (asumsi 1/3 pemakaian usaha aktif), tetapi karena banyak
  usaha Gratis untuk setiap usaha berbayar, inilah biaya terbesar di model (lihat di bawah).

## Ekonomi unit (hasil model, campuran 75% Usaha, 22% Tumbuh, 3% Perusahaan)
| | Hemat | Wajar | Agresif |
|---|---|---|---|
| ARPU berbayar | Rp236.018 | Rp236.018 | Rp236.018 |
| Biaya layanan per usaha berbayar | Rp6.896 | Rp6.896 | Rp6.896 |
| Biaya usaha Gratis per usaha berbayar | Rp106.710 | Rp52.266 | Rp34.118 |
| Margin kotor | 48,9% | 71,9% | 79,6% |
| CAC (asumsi) | Rp150.000 | Rp350.000 | Rp750.000 |
| Churn bulanan (asumsi) | 3% | 5% | 8% |
| LTV | Rp3.844.366 | Rp3.395.500 | Rp2.349.037 |
| LTV/CAC | 25,6x | 9,7x | 3,1x |
| Masa balik CAC | 1,3 bln | 2,1 bln | 4,0 bln |

## Yang terbaca
1. Biaya AI dan server per usaha berbayar (sekitar Rp6.900, H-01) kecil dibanding harga; yang menentukan margin adalah **berapa
   banyak usaha Gratis yang dibiayai per usaha berbayar**. Konversi 2% berarti 49 usaha Gratis per usaha berbayar dan margin
   turun ke 48,9%. Tuas paling murah: kuota Gratis yang ketat (100 berkas) dan ekstraktor 0 token.
2. Skenario paling mahal (CAC Rp750.000, churn 8%) masih lulus ambang LTV/CAC >= 3 dan masa balik <= 12 bulan, tetapi tipis (3,1x).
   Iklan berbayar baru masuk akal setelah churn nyata terukur di bawah 5%.
3. Semua angka kuning adalah asumsi tanpa pelanggan. Model akan diisi data nyata setelah peluncuran: churn, konversi, CAC per kanal.
