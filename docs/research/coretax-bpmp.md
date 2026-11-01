# Ekspor siap Coretax: Bukti Potong PPh 21 bulanan pegawai tetap (BPMP) (F4-08)

Ditulis 1 Nov 2026. Sumber primer: halaman DJP "Template XML dan Converter Excel ke XML" (https://www.pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml, dibaca 1 Nov 2026), berkas **BPMP Excel to XML v.3** (https://pajak.go.id/sites/default/files/2025-04/BPMP%20Excel%20to%20XML%20v.3.xlsx) dan contoh **bpmp.zip** (bpmp.xml, https://pajak.go.id/sites/default/files/2024-12/bpmp.zip). Disimpan untuk diperiksa di scratchpad, tidak di repo (berkas milik DJP).

## Mengapa BPMP
Data Nadi yang paling dekat dengan kewajiban Coretax adalah slip gaji (F1-05): PPh 21 masa dengan tarif efektif rata-rata (TER). Faktur pajak keluaran hanya untuk PKP (PPN), sedangkan invoice Nadi belum berPPN.

## Struktur template v.3 (sheet DATA)
- Baris 1: "NPWP Pemotong" di A1, nilai di B1 (16 digit, harus sama dengan NPWP yang login).
- Baris 4 judul kolom mulai B: Masa Pajak | Tahun Pajak | Status Pegawai | NPWP/NIK/TIN | Nomor Passport | Status | Posisi | Sertifikat/Fasilitas | Kode Objek Pajak | Penghasilan Kotor | Tarif | ID TKU | Tgl Pemotongan. (Kolom P-R berisi rumus pembantu TER A/B/C; kolom L di template memakai rumus yang memilih TER dari status PTKP.)
- Data mulai baris 5.
- Petunjuk (sheet BPMP), kolom Excel -> XML: NPWP Pemotong -> TIN; Masa Pajak -> TaxPeriodMonth (1-12); Tahun Pajak -> TaxPeriodYear; Status Pegawai -> CounterpartOpt (Resident | Foreign); NPWP/NIK/TIN -> CounterpartTin (NIK pegawai tetap, wajib valid); Nomor Passport -> CounterpartPassport (bila asing); Status -> StatusTaxExemption (TK/0..TK/3, K/0..K/3, HB/0..HB/3); Posisi -> Position; Sertifikat/Fasilitas -> TaxCertificate (N/A | DTP | ETC); Kode Objek Pajak -> TaxObjectCode (21-100-01 pegawai tetap; 21-100-02 pensiun teratur; 21-100-32 fasilitas daerah tertentu); Penghasilan Kotor -> Gross; Tarif -> Rate (persen; koma jadi titik di XML); ID TKU -> IDPlaceOfBusinessActivity (22 digit, NPWP + 000000); Tgl Pemotongan -> WithholdingDate (YYYY-MM-DD, tidak boleh sebelum masa pajak).
- XML contoh: akar MmPayrollBulk > TIN, ListOfMmPayroll > MmPayroll (urutan elemen seperti di atas), CounterpartPassport kosong ditulis xsi:nil="true".

## Kendala dan keputusan
1. **NIK tidak disimpan mentah di Nadi** (hanya hash + 4 digit akhir sejak F0; keputusan privasi). Kolom NPWP/NIK/TIN tidak bisa diisi otomatis. Rencana: ekspor Excel sesuai template dengan kolom itu kosong dan ditandai, akuntan mengisinya di Excel sebelum memakai konverter DJP; layar menyebut jumlah baris yang perlu diisi. Menyimpan NIK terenkripsi adalah keputusan terpisah (butuh kunci di Vault), tidak dikerjakan diam-diam.
2. NPWP pemotong dan ID TKU diisi pemilik/akuntan sebagai profil usaha (bukan rahasia; dicetak di bukti potong).
3. Gross = bruto PPh 21 slip (pendapatan + iuran JKK, JKM, BPJS Kesehatan yang ditanggung usaha, sesuai susunSlip); Rate = tarif TER yang dipakai slip bulan itu; masa Desember (Pasal 17) tidak memakai BPMP TER (dilaporkan berbeda) dan dikecualikan dengan catatan.
4. Ekspor dibuat sebagai .xlsx dengan exceljs (sudah dipakai korpus), kolom dan baris persis seperti template v.3; diuji dengan membaca ulang berkas hasil dan membandingkan judul kolom dengan template resmi.
5. Ruang Akuntan multi-klien: daftar usaha tempat pengguna menjadi akuntan aktif, ringkasan per usaha (slip disetujui bulan lalu, invoice belum dibayar, PPh final berjalan), dan tombol ekspor per usaha.
