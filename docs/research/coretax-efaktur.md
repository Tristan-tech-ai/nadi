# Coretax: berkas impor Faktur Pajak Keluaran (M-09)

Dibaca 5 Nov 2026 dari halaman resmi DJP "Template XML dan Converter Excel ke XML" (https://www.pajak.go.id/en/node/112031).

## Sumber yang diunduh dan dibaca
- `ConverterEfakturCoretax__v1.6.zip` (https://pajak.go.id/sites/default/files/2026-01/ConverterEfakturCoretax__v1.6.zip): templat Excel `Sample Faktur PK Template v.1.6.1.xlsx`, contoh `Sample Faktur PK Template v.1.4.xml`, catatan rilis (v1.6, 22 Jul 2025). Berkas .exe pengubah tidak dijalankan.
- `bppu.zip` dan `BPPU Excel to XML v.3.xlsx` (e-Bupot Unifikasi, untuk tugas lanjutan).
- Salinan contoh resmi: `fixtures/korpus/efaktur/resmi/sample-faktur-pk-v1.4.xml`.

## Isi yang dipakai
- Akar `TaxInvoiceBulk` dengan `TIN` penjual lalu `ListOfTaxInvoice/TaxInvoice`; urutan elemen diikuti persis (tes `jalurElemen` sama dengan contoh).
- Lembar Keterangan templat: tanggal faktur, Jenis Faktur selalu Normal, kode transaksi 01 sampai 10, Keterangan Tambahan dan Cap Fasilitas hanya untuk kode 07/08, ID TKU penjual 22 angka, NPWP/NIK pembeli 16 angka (0000000000000000 bila jenis ID bukan TIN), nomor dokumen pembeli wajib untuk selain TIN, ID TKU pembeli 000000 untuk selain TIN, angka maks 2 desimal.
- Rumus lembar DetailFaktur: DPP = Jumlah x Harga - Diskon; DPP Nilai Lain = 11/12 x DPP; Tarif PPN 12; PPN = DPP Nilai Lain x Tarif / 100.
- Satuan ukur UM.0001 sampai UM.0039 dan jenis ID pembeli dari REF-General.

## Temuan yang perlu diingat
- DJP tidak menerbitkan XSD. Contoh resmi merujuk `TaxInvoice.xsd`, tetapi berkasnya tidak ada di paket. Nadi menulis skema turunan `docs/pajak/coretax/TaxInvoice.xsd`. Contoh resmi wajib lolos skema itu, diperiksa di gerbang langkah efaktur.
- Contoh XML resmi menulis `BuyerCountry` IND, sedangkan daftar REF-KodeNegara memakai kode ISO 3 huruf (IDN). Nadi menulis IDN, dan skema menerima pola 3 huruf.
- Contoh XML mengosongkan nama dan alamat pembeli TIN karena Coretax mengisinya dari data DJP. Nadi tetap mengisinya karena kolom itu wajib di templat.

## Keputusan isi berkas
- Harga invoice dianggap termasuk PPN bila identitas menyebutnya (bawaan). DPP = harga / 1,11 untuk kode 04 atau / 1,12 untuk kode 01, dibulatkan 2 desimal.
- Barang/Jasa selalu A dengan kode 000000. Satuan dari kolom satuan baris, bawaan UM.0021 Piece.
- Referensi berisi nomor invoice Nadi.
- Invoice batal tidak ikut. Invoice tanpa data pembeli dipisah dan ditampilkan untuk dilengkapi.

## M-09B: e-Bupot Unifikasi, retur, rekap, kalender (5 Nov 2026)
- Kode objek pajak dan tarif: 198 baris lembar REF templat resmi "BPPU Excel to XML v.3.xlsx" (https://pajak.go.id/sites/default/files/2025-09/BPPU%20Excel%20to%20XML%20v.3.xlsx), disimpan di tabel kode_objek_pajak. Tidak ada tarif yang ditulis dari ingatan.
- Berkas BpuBulk mengikuti urutan contoh resmi bppu.xml (https://pajak.go.id/sites/default/files/2024-12/bppu.zip). Fasilitas N/A, GovTreasurerOpt N/A, dan SP2DNumber nil dipakai karena usaha bukan instansi pemerintah (lembar BPPU).
- Retur: di Coretax retur faktur keluaran dibuat oleh pembeli lewat Retur Faktur Masukan; paket resmi hanya memuat templat "Retur Faktur PM". Nadi menyediakan penyusun XML Retur Faktur Masukan untuk retur ke pemasok (lib dan tes). Layarnya belum, karena tagihan pemasok belum menyimpan nomor faktur pajak pemasok.
- Flag DPP Lain Retur mengikuti faktur asal (templat: "sama dengan data di Faktur yang akan diretur"), true untuk kode 04.
- Jatuh tempo dari teks PMK 81/2024 (https://peraturan.bpk.go.id/Download/366884/2024pmkeuangan081.pdf, dibaca 5 Nov 2026):
  - Pasal 94 ayat (2): setor PPh 4(2), 15, 21, 22, 23, 25, 26 paling lambat tanggal 15 bulan berikutnya.
  - Pasal 94 ayat (3) huruf e: setor PPN paling lambat akhir bulan berikutnya, sebelum SPT Masa PPN disampaikan.
  - Pasal 171 ayat (1): lapor SPT Masa PPh paling lama 20 hari setelah Masa Pajak berakhir.
  - Pasal 171 ayat (13): lapor SPT Masa PPN paling lambat akhir bulan berikutnya.
  - Pasal 100 dan 173: batas yang jatuh pada Sabtu, Minggu, libur nasional, hari pemilu, atau cuti bersama nasional digeser ke hari kerja berikutnya. Nadi memakai tabel libur_nasional (SKB 2026). Libur pemilu belum ada di tabel.
- Rekap PPN keluaran per masa: DPP dan PPN dihitung dari baris invoice dengan rumus faktur. Jumlahnya dibandingkan dengan kredit 4-100 jurnal terbit invoice. Toleransi pembulatan 1 rupiah per baris.

## Belum
- Kreditkan faktur masukan dan rekonsiliasi keluaran-masukan.
- Layar retur ke pemasok, karena butuh nomor faktur pajak pemasok di tagihan.
- Bukti potong A1 tahunan dan pembetulan.
