# Riset ekspor-impor untuk usaha Indonesia (R-EKSIM)

Ditulis 4 Nov 2026 atas permintaan Tristan ("bisnis besar sering ekspor impor, riset dulu aturannya"). Tujuan: tahu apa yang bisa Nadi kerjakan untuk usaha yang mengekspor atau mengimpor tanpa melanggar aturan, tanpa izin khusus (PPJK), dan tanpa fitur penghindaran bea/pajak.

Status angka: **T** = dibaca dari teks/abstrak resmi; **B** = belum terverifikasi ke teks pasal (dari ringkasan resmi lain atau berita), tidak boleh dipakai sebagai preset sampai dicek (aturan "konfigurasi adalah data").

## 1. Peraturan inti (sumber primer, diakses 4 Nov 2026)

| Bidang | Peraturan | Status | Sumber |
|---|---|---|---|
| Kepabeanan ekspor | PMK 155/PMK.04/2022 Ketentuan Kepabeanan di Bidang Ekspor, berlaku 2 Jan 2023, mencabut PMK 145/PMK.04/2007; pelaksana PER-9/BC/2023 | T (identitas) | peraturan.bpk.go.id/Details/230762; jdih.kemenkeu.go.id/dok/155-pmk-04-2022 |
| Kepabeanan impor | PMK 190/PMK.04/2022 Pengeluaran Barang Impor untuk Dipakai (PIB, pembetulan PIB) | T (identitas), status perubahan B | jdih.kemenkeu.go.id (190~PMK.04~2022.pdf) |
| Barang kiriman | PMK 4/2025, perubahan kedua PMK 96/2023; PIBK untuk penerima bukan badan usaha s.d. FOB USD1.500; berlaku 5 Mar 2025 | B (dari ringkasan) | peraturan.bpk.go.id/Details/313252 |
| PPh 22 impor | PMK 51/2025, ditetapkan 25 Jul 2025, berlaku 1 Agu 2025 (BN 2025 No. 549); DJBC sebagai pemungut impor; tidak final kecuali BBM/BBG ke penyalur; lampiran barang hal 18-106 | T (abstrak resmi JDIH) | jdih.kemenkeu.go.id/dok/pmk-51-tahun-2025 |
| Tarif PPh 22 impor | Pasal 3 ayat (1) huruf a angka 1: a) barang tertentu 10%, b) barang tertentu lainnya 7,5% (dengan/tanpa API), c) kedelai, gandum, terigu 0,5% dengan API, d) emas batangan 0,25%, e) barang lain dengan API 2,5%, f) huruf c dan e tanpa API 7,5%, g) barang tidak dikuasai 7,5% dari harga lelang; dasar nilai impor | **T** (OCR PDF resmi BPK Download/388104, 4 Nov 2026) | peraturan.bpk.go.id/Details/326296 |
| PPN impor | PMK 131/2024: tarif 12%, DPP nilai lain 11/12 dari nilai impor untuk barang bukan mewah (efektif 11%); barang mewah 12% DPP penuh | T (penjelasan resmi DJP) | pajak.go.id/node/113453 |
| Devisa hasil ekspor (DHE) SDA | PP 36/2023, diubah PP 8/2025 (berlaku 1 Mar 2025), PP 2/2026, PP 21/2026 (ditetapkan 6 Mei 2026, berlaku 1 Jun 2026; mengubah Pasal 18A dan peralihan PPE) | T (identitas) | peraturan.bpk.go.id/Details/314625, /349944 |
| Besaran DHE | PP 2/2026 (ditetapkan 14 Jan 2026, berlaku 26 Feb 2026): wajib bila nilai Ekspor pada PPE paling sedikit USD250.000 (Pasal 6 ayat (2)), ditempatkan paling lambat akhir bulan ketiga setelah bulan pendaftaran PPE (Pasal 6 ayat (3)); 100% paling singkat 12 bulan (Pasal 7 ayat (1)-(2)) dan paling sedikit 30% paling singkat 3 bulan untuk migas (Pasal 7 ayat (2a)) menurut pasal sanksi; penukaran ke Rupiah paling banyak 50% (Pasal 11A ayat (1a)). PP 21/2026 Pasal 18A: perjanjian bilateral, pertambangan paling sedikit 30% paling singkat 3 bulan, boleh di bank devisa yang ditetapkan BI; PPE sejak 1 Jun 2026 | **T** (OCR PDF resmi BPK Download/413643 dan /413644) | peraturan.bpk.go.id/Details/349943, /349944 |
| Surat Keterangan Asal | Permendag 24/2018 diubah terakhir Permendag 34/2023; e-SKA di e-ska.kemendag.go.id (Permendag 37/2022); SKA Preferensi per perjanjian dagang | T (identitas) | peraturan.bpk.go.id (Permendag 37/2022) |

Dibaca 4 Nov 2026 (R-EKSIM2):
- **BTKI 2022**: PMK 26/PMK.010/2022 (berlaku 1 Apr 2022; HS 2022 + AHTN 2022; pos tarif 8 digit; tarif ad valorem dan/atau spesifik; 11.552 pos), diubah PMK 10/2024, PMK 62/2025, dan PMK 50/2026 (perubahan ketiga) (peraturan.bpk.go.id/Details/215104; jdih.kemenkeu.go.id/dok/26-pmk-010-2022). Konsekuensi: tarif bea masuk per pos tidak disalin ke Nadi; pengguna mengisi tarif dari BTKI/INSW (insw.go.id) per barang, Nadi menyimpan sumbernya.
- **Kurs pajak**: ditetapkan mingguan dengan KMK (mis. KMK 25/MK/EF.2/2026, 2 Jun 2026; jdih.kemenkeu.go.id), tabel di fiskal.kemenkeu.go.id; JPY per 100 Yen; mata uang di luar lampiran memakai kurs spot harian terhadap USD. Dipakai untuk bea masuk, PPN, PPh impor. Nadi menyimpan kurs + nomor KMK per transaksi, isian pengguna sampai ada pengambilan otomatis dari situs resmi.
- **API dalam NIB**: PP 5/2021 Pasal 176 ayat (5): NIB dapat berlaku sebagai API (API-U atau API-P, pilih satu), juga sebagai hak akses kepabeanan; Permendag 20/2021 mewajibkan importir memiliki NIB yang berlaku sebagai API; Permendag 37/2025 mengatur pencabutannya (peraturan.go.id). B untuk rincian syarat API-P/API-U (belum dibaca pasal demi pasal); untuk Nadi cukup isian "punya API: ya/tidak" yang menentukan tarif PPh 22.
- Belum: INSW/CEISA 4.0 (akun dan hak akses), tidak dibutuhkan karena Nadi tidak mengisi dokumen pabean.

## 2. Alur dan siapa yang mengisi

**Impor (barang untuk dipakai):** NIB berfungsi sebagai API (OSS, B) -> pesanan dan invoice pemasok luar negeri (valuta asing) -> pengiriman (B/L atau AWB) -> **PIB** diajukan importir atau PPJK lewat CEISA/INSW dengan kode HS -> pembayaran bea masuk, PPN impor, PPh 22 impor (billing) -> penjaluran dan pengeluaran barang (SPPB) -> pencatatan persediaan dan kredit pajak (PPN impor bisa dikreditkan, PPh 22 impor dengan API tidak final).

**Ekspor:** kontrak/pesanan pembeli -> invoice dan packing list (valuta asing) -> **PEB** diajukan eksportir atau PPJK lewat CEISA -> pemeriksaan bila perlu, NPE -> pengapalan -> SKA lewat e-SKA bila pembeli butuh tarif preferensi -> penerimaan pembayaran lewat bank devisa; untuk eksportir SDA wajib DHE ke rekening khusus sesuai PP 36/2023 dan perubahannya.

Yang mengisi dokumen pabean adalah importir/eksportir sendiri dengan akun CEISA, atau PPJK berizin. Bank mengurus devisa dan pelaporan DHE.

## 3. Apa yang bisa dan tidak bisa Nadi kerjakan

Bisa (tanpa izin khusus, data milik usaha sendiri):
- Invoice dan packing list ekspor dalam bahasa Inggris dan valuta asing (USD dulu), dengan kurs yang dicatat dan sumbernya.
- **Perkiraan** biaya mendarat impor (landed cost): nilai pabean (CIF) x kurs + bea masuk (tarif diisi pengguna dari BTKI sampai tabel resmi terverifikasi) + PPN impor (12% x 11/12) + PPH 22 impor (tarif terverifikasi dulu); selalu bertanda perkiraan, bukan billing resmi.
- Lempar dokumen pabean yang sudah jadi (PIB/PEB/SPPB/NPE, invoice pemasok) lalu Nadi membaca dan mencatat ke pembukuan: utang pemasok valas, persediaan, PPN impor sebagai pajak masukan, PPh 22 impor sebagai kredit pajak.
- Pengingat: dokumen SKA per pengapalan; untuk eksportir SDA, pengingat kewajiban DHE (tanpa menghitung keringanan apa pun).

Tidak:
- Mengisi atau mengirim PIB/PEB ke CEISA atas nama pengguna (butuh akun pengguna atau PPJK berizin; risiko hukum).
- Menentukan kode HS secara otomatis sebagai keputusan final (salah klasifikasi = bea salah, sanksi); boleh menyarankan dengan catatan "periksa ke BTKI/PPJK".
- Fitur apa pun yang menurunkan nilai pabean, memecah kiriman agar di bawah batas, atau menghindari DHE (dilarang penjaga: tanpa penghindaran pajak/bea).

## 4. Tugas turunan (ditambahkan ke antrean)
- **B-EKSIM1** invoice dan packing list ekspor (Inggris, USD, kurs tercatat). SELESAI 4 Nov 2026: /app/ekspor, cetak /cetak/ekspor/<id>, docs/quality/invoice-ekspor.md.
- **B-EKSIM2** kalkulator perkiraan biaya mendarat impor (bertanda perkiraan; tarif PPh 22 dan PPN dari aturan bertanggal terverifikasi).  SELESAI 4 Nov 2026: /app/impor, docs/quality/biaya-impor.md.
- **R-EKSIM2** verifikasi teks pasal: PMK 51/2025 (tarif), PP 2/2026 + 21/2026 (DHE), BTKI 2022, KMK kurs, API dalam NIB; isi aturan_bertanggal dengan status terverifikasi.
- **B-EKSIM3** baca dokumen pabean yang dilempar (PIB/PEB/SPPB) menjadi usulan jurnal.
