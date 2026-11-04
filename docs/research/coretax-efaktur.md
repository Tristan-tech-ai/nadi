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

## Belum (tugas lanjutan)
- e-Bupot Unifikasi dari pemotongan atas pembayaran pemasok. Nadi belum mencatat pemotongan di pembelian.
- Retur faktur keluaran.
- Rekap SPT Masa PPN dan kalender setor/lapor.
