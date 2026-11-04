# Katalog fitur Mekari lawan Nadi (4 Nov 2026)

Setiap baris adalah satu kemampuan Mekari. Kemampuan ini dirangkum dari bagian pusat bantuan, tabel paket, dan API; rinciannya ada di [inventaris/](inventaris/).

Kolom **Bagian** menyebut kategori/bagian pusat bantuan sumbernya. `alat/cek_cakupan.py` memastikan setiap bagian di inventaris masuk ke salah satu baris.

**Status di Nadi:**

| Status | Arti |
|---|---|
| ADA | Sudah ada dan cukup untuk kebutuhan usaha kecil-menengah |
| SEBAGIAN | Inti ada, bagian tertentu kurang (disebut) |
| BELUM | Tidak ada dan bisa dibangun sendiri |
| MITRA | Butuh pihak ketiga berizin atau kerja sama. Ada jalan pengganti yang sah, lihat [pihak-ketiga.md](pihak-ketiga.md) |
| LUAR | Bukan perangkat lunak (jasa manusia, acara, komunitas) |

Kolom **Tugas** menunjuk tugas di [rencana.md](rencana.md).

## Talenta (HR, absen, gaji)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| TA-01 | Direktori karyawan + profil lengkap (pribadi, keluarga, pendidikan, pengalaman, rekening, BPJS, NPWP, riwayat), impor massal | Employees/Employee Directory; Employee Profile; For Employee/Employee Profile | /app/orang: nama, HP, NIK hash, topi, gaji rahasia, impor dari Excel/KTP lewat Lempar | SEBAGIAN: keluarga, pendidikan, riwayat jabatan, dokumen per orang | M-11 |
| TA-02 | Struktur organisasi, cabang, job level, posisi, SBU, multi NPWP, cost center, bagan organisasi | Settings/Company; Launchpad/Company | topi, peta organisasi (Kerja > peta), tempat absen, multi usaha | SEBAGIAN: job level/golongan, cost center, multi NPWP satu usaha, bagan atasan-bawahan | M-11 |
| TA-03 | Custom fields karyawan | Settings/Company | kolom data jsonb, tanpa layar | BELUM | M-11 |
| TA-04 | Peran akses fleksibel dan custom roles | Settings/Users | pemilik, admin, akuntan, staf (tetap) | SEBAGIAN: peran kustom berbasis izin | M-21 |
| TA-05 | Alur persetujuan bertingkat per jenis pengajuan, delegasi | Settings/Workflows; Inbox | Feed usulan untuk_peran, rute pemilik bila uang besar, izin otopilot | SEBAGIAN: rantai atasan langsung > HR > pemilik, delegasi saat cuti | M-11 |
| TA-06 | Employee self-service web + mobile | For Employee/*; Mobile App/*; Settings/ESS | PWA staf: absen, izin, slip, jadwal, kerja, rekam ilmu | ADA (profil sendiri dan pengajuan data belum) | M-11 |
| TA-07 | Onboarding karyawan baru (daftar tugas, dokumen, akun) | Employees/New Joiner; Employees/Onboarding | akun staf + PIN, topi otomatis | SEBAGIAN: daftar periksa onboarding | M-11 |
| TA-08 | Offboarding, resign, transfer/mutasi/promosi dengan riwayat | Employees/Offboarding; API Employee Transfer | Serah terima, hak berhenti, wawancara keluar, SK mutasi | SEBAGIAN: alur transfer/promosi + riwayat jabatan dan gaji | M-11 |
| TA-09 | Teguran / surat peringatan | Employees/Reprimand; API Reprimand | surat keluar 3 jenis | BELUM: SP1-SP3 dengan masa berlaku | M-11 |
| TA-10 | Manpower planning: rencana posisi, headcount, anggaran per periode | Employees/Manpower Planning | lowongan per topi | BELUM | M-14 |
| TA-11 | Templat dokumen karyawan (kontrak, offering, keterangan) diisi otomatis | Productivity/Document Templates; Company/Files | surat keluar (SK mutasi, surat tugas, keterangan kerja) + QR verifikasi | SEBAGIAN: templat bebas (kontrak PKWT, offering) | M-11, M-17 |
| TA-12 | Pengumuman + tanda sudah dibaca (acknowledgement) | Company/Announcement; Dashboard/Announcement | push pemberitahuan pemilik | BELUM | M-11 |
| TA-13 | Form dan survei karyawan | Productivity/Forms and Surveys; API Form | wawancara keluar | BELUM | M-11 |
| TA-14 | Aset perusahaan yang dipinjam karyawan | Company/Assets; API Asset | Serah terima butir barang | SEBAGIAN: daftar aset + pinjam/kembali | M-06 |
| TA-15 | File perusahaan, aktivitas pengguna, antrean proses, notifikasi | Company/Files; Company/User Activity; Company/Queue Activity; Company/Notification | Lempar (arsip berkas), audit_log, push | SEBAGIAN: layar log aktivitas | M-21 |
| TA-16 | Insights: headcount, absensi, payroll, karyawan berisiko, kinerja, lembur, dasbor kustom, report builder | Insights/*; Company/Report Builder; Dashboard/*; Time/Time Reports | KPI, beban tim, sinyal beban, alur nyata, Sarapan Data | SEBAGIAN: dasbor HR baku + pembuat laporan | M-23 |
| TA-17 | Absensi mobile: selfie, GPS/geofence, liveness AI, kunci absensi | Time/Attendance; Mobile App/Time Management | QR TOTP 15 detik + cek wajah di perangkat; geofence radius per tempat dengan pesan jarak; kunci absensi per bulan (M-12) | ADA | M-12 |
| TA-18 | Live tracking karyawan lapangan (rute, kunjungan, penyimpangan) | Time/Live Tracking; API Live Attendance | tidak ada | BELUM (dengan izin orangnya, UU PDP) | M-15 |
| TA-19 | Shift, scheduler, multiple shift, on-call, tukar shift | Time/Scheduler; Time/Multiple Shift; Time/On-call; Time/Calendar; Settings/Time | jadwal shift, tukar shift, usulan jadwal, batas PP 35/2021; shift siaga (on-call) (M-12) | SEBAGIAN: banyak shift sehari belum diuji khusus | M-12 |
| TA-20 | Lembur: pengajuan karyawan, aturan, perhitungan | Time/Overtime; API Overtime | catat_lembur pemilik/admin + upah lembur di slip; staf mengajukan lembur sendiri lewat Feed (M-12) | ADA | M-12 |
| TA-21 | Cuti: jatah, saldo, carry forward, cuti per jam, block leave | Time/Time Off; API Time Off | izin otopilot, jatah cuti, bukti | SEBAGIAN: cuti per jam, block leave, sisa cuti terbawa belum | M-12 |
| TA-22 | Kalender kerja dan libur nasional | Time/Calendar | libur nasional dan cuti bersama 2026 bertanggal dari SKB 3 menteri (setneg.go.id), tampil di Jadwal (M-12) | SEBAGIAN: belum mengurangi hari kerja di hitungan izin dan gaji | M-12 |
| TA-23 | Tablet absen (Talenta Portal), mesin sidik jari, absen tanpa sentuh | Mobile App/Talenta Portal; API Fingerprint | kios tablet token nmk_; log mesin sidik jari/wajah (CSV/Excel) lewat Lempar dibaca tanpa AI menjadi rekap absen (M-12) | SEBAGIAN: sambungan langsung ke mesin tetap MITRA | M-12 |
| TA-24 | Proyek, tugas, timesheet | Productivity/Projects and Tasks; API Task and Timesheet | papan kerja poin, estimasi kerja AI, beban | SEBAGIAN: proyek + jam per proyek | M-12 |
| TA-25 | Payroll: komponen, struktur gaji, run payroll, PPh 21 TER, BPJS, THR, prorata, mingguan, kunci dan publikasi slip, riwayat | Payroll/Payroll Processing; Payroll/Payroll Components; Payroll/Salary Structure; Settings/Payroll | slip bulanan, PPh 21 TER/Pasal 17, BPJS, lembur, Gerbang Gaji, tahan slip, tautan slip; THR Permenaker 6/2016 dihitung database (/app/gaji/thr, usulan ke Feed); batas potongan Pasal 65 PP 36/2021 ditegakkan di slip | SEBAGIAN: THR, prorata, payroll mingguan/harian, komponen kustom, struktur gaji | M-10 |
| TA-26 | Simulasi pajak, compensation planning (kenaikan gaji) | Payroll/Tax Simulation; Payroll/Compensation Planning | Kompas Pajak (PPh final UMKM) | BELUM | M-10 |
| TA-27 | Compliance: eBupot 21/26 ke DJP, laporan BPJS, SPT 21 | Payroll/Compliance; Payroll/Reports | ekspor BPMP (templat Excel Coretax) di Ruang Akuntan | SEBAGIAN: berkas BPJS, bukti potong A1. Kirim langsung ke DJP: MITRA | M-09, M-10 |
| TA-28 | Payroll disbursement dan berkas e-banking | Payroll/Payroll Processing; API Payroll Payment Schedule | tautan slip + wa.me | SEBAGIAN: berkas transfer massal format bank. Transfer otomatis: MITRA | M-10 |
| TA-29 | Alokasi biaya payroll ke cost center/cabang | Payroll/Payroll Allocation; API Cost Center | jurnal gaji tunggal | BELUM | M-10 |
| TA-30 | Reimbursement, cash advance, pinjaman karyawan | Finance/*; Mobile App/Reimbursement; Settings/Finance; API Loans, Reimbursement | kasbon (uang muka upah) dari kas usaha sendiri, jurnal piutang karyawan 1-150, cicilan dibatasi 50% upah (PP 36/2021 Pasal 63 dan 65) | SEBAGIAN: cicilan otomatis di slip, reimbursement, dan pinjaman lain belum | M-18, M-10 |
| TA-31 | Rekrutmen ATS: lowongan, kandidat, talent pool, asesmen, MBTI, CV parsing, AI scoring, kalender, laporan, job portal | Recruitment/*; For Employee/Recruitment | lowongan, /lamar, baca CV tanpa model, rubrik, wawancara suara + transkrip, uji kerja, IPIP, Bank Talenta, status pelamar, lingkaran rekrut, penjaga bias | SEBAGIAN: kalender wawancara, laporan rekrutmen. Pasang ke job portal: MITRA | M-14 |
| TA-32 | Kinerja: goals KPI/OKR, review (diri, atasan, rekan), kalibrasi, talents/9-box, kompetensi, suksesi, IDP | Performance Management/* | KPI dari papan kerja, kolam bonus | SEBAGIAN: siklus review dan goal | M-13 |
| TA-33 | LMS: materi, tes, progres, sertifikat | LMS/* | Rekam ilmu (SOP rekaman + langkah) | SEBAGIAN: kursus, kuis, sertifikat | M-13 |
| TA-34 | Inbox persetujuan terpusat | Inbox/* | Feed Keputusan | ADA | - |
| TA-35 | Integrasi (Jurnal, Bluebird, mesin absen, bank, job portal), API, webhook | Integrations/*; API Talenta | satu database (tanpa integrasi), MCP, rencana webhook W-08 | SEBAGIAN | W-08 |
| TA-36 | Liveness AI dan validasi wajah | Time/Attendance | cek wajah di perangkat, gambar tidak diunggah | ADA | - |
| TA-37 | Payroll Service (jasa penggajian oleh manusia) | halaman /produk/payroll-service | Ruang Akuntan + direktori mitra | LUAR | - |
| TA-38 | Panduan mulai, pengumuman produk, video | Getting Started/*; Video; What's New; FAQ; Employees/Overview Employee; Payroll/Overview Payroll; Company/Overview Company; Settings/Overview Settings, Account | /panduan, demo | ADA | - |

## Jurnal (akuntansi, stok, produksi)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| JU-01 | Dasbor, sekilas bisnis, ringkasan eksekutif bulanan lewat email | Beranda/*; Laporan/Sekilas Bisnis | Sarapan Data (push pagi), kartu Uang usaha di Feed (kas, tagihan, utang, laba bulan ini), /app/buku (M-01) | ADA | M-01 |
| JU-02 | Bagan akun, saldo awal, jurnal umum, tutup buku, kunci periode | Daftar Akun/*; Daftar Lainnya/Daftar Penutupan Buku & Kunci Periode | ledger, 17 akun bawaan, posting/balik jurnal, kunci/buka periode, saldo awal + penyeimbang, tutup buku tahunan ke laba ditahan, neraca saldo CSV (M-01) | ADA | M-01 |
| JU-03 | Penjualan: penawaran, pemesanan, pengiriman (surat jalan), penagihan, uang muka, retur, draft dan approval, impor templat | Penjualan/*; Pemenuhan/Penjualan; Daftar Lainnya/Cara Pembayaran, Syarat Pembayaran | invoice bernomor, QRIS statis, pengingat 4 tahap; /app/jual: penawaran > pesanan > surat jalan > invoice, uang muka, retur/nota kredit dengan stok kembali (M-03) | SEBAGIAN: draf dan approval penjualan, impor templat | M-03 |
| JU-04 | Multiple withholding (potong PPh di invoice), tukar invoice/faktur | Penjualan/Multiple Withholding; Penjualan/Tukar Invoice; Pembelian/Tukar Faktur; Daftar Lainnya/Pajak | lunas dipotong PPh oleh pembeli ke 1-430, jenis PPh 23/4(2)/22 (M-03) | SEBAGIAN: tukar invoice/faktur | M-03, M-09 |
| JU-05 | e-Meterai pada invoice | Penjualan/Stamp eMeterai | tidak ada | MITRA (Peruri lewat distributor resmi) | M-17 |
| JU-06 | Pembelian: permintaan, penawaran, pesanan, penerimaan, tagihan pemasok, pembayaran, approval | Pembelian/*; Pemenuhan/Pembelian | /app/beli: permintaan (PR), pesanan (PO), penerimaan barang masuk stok, tagihan pemasok dicocokkan ke PO (selisih), jatuh tempo, bayar sebagian, retur/nota debit, saldo per pemasok; nota Lempar menyebut PO yang cocok dan jadi hutang saat disetujui; PIB impor | SEBAGIAN: penawaran harga dari pemasok dan approval berjenjang PO belum | M-04 |
| JU-07 | Biaya dengan approval draft | Biaya/* | Lempar nota, Feed | ADA (dasar); pemetaan akun per kategori belum | M-04 |
| JU-08 | Kontak: pelanggan, supplier, karyawan, pihak lain, grup, kredit/debit memo | Kontak/* | graf usaha (pihak), saldo per pelanggan (/app/jual) dan per pemasok (/app/beli), nota kredit dan nota debit | SEBAGIAN: buku kontak terpusat (alamat, NPWP, grup) belum | M-03, M-04 |
| JU-09 | Produk dan jasa: kategori, satuan, varian, bundle, konversi, aturan harga, barcode, batch/seri | Produk/*; Daftar Lainnya/Atribut Varian Produk, Satuan Produk, Produk | /app/barang: produk barang/jasa/paket, satuan besar + faktor, barcode, kode; layar varian (induk + ciri) dan harga grosir bertingkat yang terisi sendiri di invoice, daftar produk dari Excel/foto lewat Lempar jadi usulan produk.impor (M-02B) | ADA | M-02, M-02B |
| JU-10 | Persediaan: penyesuaian, stok opname, nilai (rata-rata), hitung ulang, tipe penyimpanan | Produk/Penyesuaian Stok; Daftar Lainnya/Penghitungan Ulang Nilai Persediaan, Tipe Penyimpanan Persediaan | rata-rata tertimbang bergerak, opname per produk dengan jurnal selisih 5-200, kartu stok berjalan (M-02); hitung stok banyak barang dari foto/Excel lewat Lempar jadi opname gudang utama (M-02B) | SEBAGIAN: hitung ulang nilai persediaan dan tipe penyimpanan belum | M-02, M-02B |
| JU-11 | Gudang, multi gudang, transfer gudang, lokasi rak/bin | Produk/Gudang, Multi Gudang, Transfer Gudang | gudang banyak, gudang utama untuk invoice, pindah gudang dengan nilai rata-rata (M-02); lokasi rak/bin per stok dan laporan stok per gudang (M-02B) | ADA | M-02, M-02B |
| JU-12 | Produksi: BoM bertingkat, perintah kerja, biaya standar, assembly/disassembly, pemetaan akun | Produksi/* | tidak ada | BELUM | M-07 |
| JU-13 | Pemenuhan pesanan: ambil barang, segregasi stok, surat jalan, terima barang | Pemenuhan/* | tidak ada | BELUM | M-02, M-03 |
| JU-14 | Kas dan bank: akun, transfer, terima/kirim uang, pemetaan kas | Kas & Bank/* | /app/kas: rekening kas/bank/dompet (akun 1-10x/1-11x), saldo, pindah dana, uang masuk/keluar ke akun pilihan | ADA | M-05 |
| JU-15 | Rekonsiliasi bank: manual, aturan, otomatis, batal | Kas & Bank/Rekonsiliasi Bank, Aturan Rekonsiliasi, Rekonsiliasi Bank Otomatis, Mengembalikan Rekonsiliasi | /app/kas: mutasi CSV atau e-statement Lempar dicocokkan ke invoice, tagihan pemasok, jurnal yang sudah tercatat, atau aturan kata kunci pengguna; cocokkan semua usulan; batal = jurnal dibalik; korpus 3 format bank 21/22 per format, 0 salah | ADA | M-05 |
| JU-16 | Cashlink feeds (mutasi bank otomatis) | Kas & Bank/Cashlink Feeds | unggah CSV mutasi di /app/kas; e-statement PDF/CSV lewat Lempar masuk ke rekening Bank saat disetujui | MITRA (API bank SNAP / agregator); pengganti sudah jalan: CSV dan Lempar; alamat email lempar belum dibangun (butuh layanan email masuk, biayanya belum diriset) | M-05 |
| JU-17 | Aset tetap: daftar, saldo awal, penyusutan, aset tertunda, dijual/dilepas | Aset/* | tidak ada | BELUM | M-06 |
| JU-18 | Laporan 40+: neraca, laba rugi, arus kas, buku besar, neraca saldo, umur piutang/hutang, penjualan/pembelian per pihak/produk, persediaan, aset, pajak, kurs, bank | Laporan/* | /app/buku: neraca, laba rugi, arus kas tidak langsung, neraca saldo, buku besar, umur tagihan; CSV + cetak PDF (M-01) | SEBAGIAN: laporan per pelanggan/produk/pajak/kurs menyusul M-02, M-03, M-08, M-09 | M-01 |
| JU-19 | Multi mata uang, kurs, revaluasi, laba rugi kurs | Daftar Lainnya/Daftar Mata Uang; Laporan/Pertukaran Kurs | invoice ekspor USD + kurs per invoice | SEBAGIAN: revaluasi + selisih kurs pelunasan | M-08 |
| JU-20 | Anggaran dan laba rugi anggaran | halaman /produk/jurnal/rencana-anggaran; API Budget | tidak ada | BELUM | M-08 |
| JU-21 | Tag/dimensi (cabang, proyek), aturan tagging, laba rugi dimensional | Daftar Lainnya/Tag; Pengaturan/Aturan Tagging | tidak ada | BELUM | M-08 |
| JU-22 | Transaksi berulang (jadwal) | Daftar Lainnya/Daftar Jadwal Berulang | tidak ada | BELUM | M-08 |
| JU-23 | Templat dokumen, invoice berbranding, pro forma, progress invoice, invoice gabungan | Pengaturan/Template; Penjualan/Penagihan Penjualan | invoice cetak bawaan | SEBAGIAN | M-03 |
| JU-24 | Pengaturan: perusahaan, penjualan, pembelian, produk, custom field, pemetaan akun, pengguna, approval, tagihan langganan | Pengaturan/* | /app/perusahaan | SEBAGIAN | M-01, M-21 |
| JU-25 | Daftar audit, daftar transaksi, lampiran, cutoff, limit transaksi | Daftar Lainnya/Daftar Audit, Daftar Transaksi, Daftar Lampiran, Periode Cutoff, Sekilas Menu Daftar Lainnya, Perhitungan Transaksi Berjalan; Memulai/Limitasi Pembuatan Transaksi | audit_log, berkas bukti di usulan | SEBAGIAN: layar daftar audit | M-21 |
| JU-26 | Impor/ekspor data, migrasi dari aplikasi lain | Beranda/Migrasi Data; Daftar Lainnya/Daftar Import dan Ekspor; Penjualan/Mengimpor Template | Lempar Excel/CSV | SEBAGIAN: impor COA, saldo awal, kontak, produk, ekspor semua data | M-24 |
| JU-27 | Konsolidasi beberapa perusahaan | Aplikasi/Konsolidasi; Integrasi/Jurnal Consolidation | banyak usaha per akun, terpisah | BELUM | M-08 |
| JU-28 | Jurnal Mobile | Jurnal Apps/Jurnal Mobile | PWA | ADA | - |
| JU-29 | Asisten AI (Airene): analisis laporan, tanya data | Beranda/Mekari Airene | MCP (AI milik pengguna), Sarapan Data | SEBAGIAN: tanya data di dalam aplikasi | M-22 |
| JU-30 | Mekari Pay: terima pembayaran (VA, QRIS dinamis, kartu), bayar supplier, saldo | Mekari Pay/* | QRIS statis pemilik, transfer, tunai; mutasi masuknya dicocokkan di /app/kas | MITRA (PJP berizin BI); sambung payment gateway milik pemilik belum diriset | M-05 |
| JU-31 | Jurnal Touch (POS), Jurnal Channel (marketplace), App Store, integrasi software lain | Integrasi/* | MCP, rencana W-08/W-09 | SEBAGIAN: POS BELUM, marketplace MITRA | M-19, W-08, W-09 |
| JU-32 | Landed cost | tabel paket Jurnal 360 | jurnal PIB (bea, PPh 22, PPN impor) | SEBAGIAN: alokasi biaya ke harga pokok barang | M-02 |
| JU-33 | Studi kasus per tipe bisnis, panduan, FAQ, video, sistem pembayaran langganan, referral | Studi Kasus/*; Memulai dengan Jurnal/*; FAQ; Video; What's New | /panduan, /fitur/*, paket industri | ADA (isi panduan diperluas bersama fitur) | - |

## Klikpajak (pajak)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| KP-01 | e-Faktur keluaran (Coretax): buat, impor massal, retur, batal, PDF | E-Faktur/Pajak Keluaran, NSFP, Dokumen lain; E-Faktur Coretax/* | /app/pajak/faktur: berkas impor XML Faktur Pajak Keluaran Coretax dari invoice (susunan contoh resmi DJP, rumus templat v.1.6.1, lolos skema turunan + aturan DJP) | SEBAGIAN: retur, batal, dan PDF faktur belum; mengirim langsung ke DJP: MITRA | M-09 |
| KP-02 | e-Faktur masukan: kreditkan, rekonsiliasi keluaran-masukan, rekapitulasi, lapor SPT Masa PPN | E-Faktur/Pajak Masukan, Rekonsiliasi, Rekapitulasi, Lapor SPT Masa PPN; E-Faktur Coretax/Faktur Masukan | rekap PPN keluaran per masa dicocokkan dengan jurnal penjualan; berkas XML Retur Faktur Masukan (templat resmi, lib) | SEBAGIAN: kreditkan faktur masukan dan rekonsiliasi keluaran-masukan belum; lapor SPT Masa PPN: MITRA | M-09 |
| KP-03 | e-Bupot Unifikasi, 21/26, non resident: buat, impor, kirim massal, arsip, pembetulan | E-Bupot/*; E-Bupot Coretax/* | BPMP PPh 21 (Excel Coretax); potong PPh Unifikasi atas tagihan pemasok (198 kode objek pajak DJP) + berkas XML BpuBulk e-Bupot Unifikasi | SEBAGIAN: unifikasi (PPh 23/4(2)/15/22) dan A1 tahunan | M-09 |
| KP-04 | e-Billing: buat ID billing, bayar massal, impor ID billing | Bayar Pajak/* | jumlah setor PPh dipotong dan PPN keluaran per masa + jatuh tempo PMK 81/2024 (geser hari libur) | MITRA (kode billing lewat Coretax/PJAP; bayar lewat bank/PJP); pengganti: hitung jumlah setor + pengingat + panduan buat billing di Coretax | M-09 |
| KP-05 | Lapor SPT Masa 21/26, Unifikasi, Badan, SPT Tahunan 1771 | Lapor Pajak/* | Kompas Pajak PPh final UMKM; kalender setor/lapor PMK 81/2024 Pasal 94, 100, 171, 173 | SEBAGIAN: kertas kerja SPT (angka siap salin) + kalender lapor | M-09 |
| KP-06 | Pengecekan dan pemadanan NPWP | Memulai Klikpajak/Pengecekan NPWP | cek bentuk NPWP 16 angka, NIK 16 angka, NITKU 22 angka diawali NPWP (identitas_pajak, pembeli_pajak) | SEBAGIAN: pemadanan ke data DJP tetap MITRA | M-09 |
| KP-07 | Pengaturan akun, perusahaan, penandatangan, multi NPWP, dasbor, Company ID | Pengaturan/*; Dasbor/* | identitas pajak penjual (NPWP, NITKU, harga termasuk PPN, kode transaksi) di /app/pajak/faktur | SEBAGIAN | M-09 |
| KP-08 | Integrasi Jurnal ke pajak | Integrasi/* | satu database | ADA (by design) | - |
| KP-09 | Riwayat aktivitas, panduan, FAQ, video | Memulai Klikpajak/*; FAQs; Video; What's New | audit_log, /panduan | ADA | - |

## Qontak (pelanggan, CRM, kampanye)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| QO-01 | Kotak masuk omnichannel (WhatsApp API, IG, FB, email, live chat, Telegram, marketplace) | Conversation Management/Multi-channel integration, Inbox & Inquiry Management | Bagikan dari WA ke Nadi, wa.me | MITRA untuk WhatsApp API/Meta/marketplace; BELUM untuk web chat sendiri, Telegram Bot API, email masuk | M-16 |
| QO-02 | Penugasan chat ke agen, eskalasi, jam operasional, templat, lampiran, log | Conversation Management/*; Customer Support & Ticketing/Inquiry Assignment | tidak ada | BELUM | M-16 |
| QO-03 | Chatbot AI dan AI agent, ringkas/parafrase chat, produktivitas agen | AI Chatbot & Automation/* | model di Edge Function, tangga kecerdasan | BELUM | M-16 |
| QO-04 | Tiket, SLA hitung mundur, umpan balik/CSAT, laporan layanan | Customer Support & Ticketing/* | tidak ada | BELUM | M-16 |
| QO-05 | Basis pengetahuan | Operation & Workflow Automation/Knowledge Base | Rekam ilmu (internal) | BELUM untuk pelanggan | M-16 |
| QO-06 | CRM: kontak, perusahaan, deal pipeline, produk, field, goal, dokumen, catatan, tugas | Sales Management/*; Customer Data Platform/Contact (CRM), Company Module; Operation & Workflow Automation/Task Management, Product Catalog | graf usaha (pihak) | BELUM | M-15 |
| QO-07 | Live location dan kunjungan sales lapangan | Sales Management/Live Location & Tracking | tidak ada | BELUM (dengan izin) | M-15 |
| QO-08 | Laporan sales, report builder | Report Management/* | tidak ada | BELUM | M-15, M-23 |
| QO-09 | Customer Data Platform, kontak omnichannel, insight pelanggan, segmen | Customer Data Platform/* | tidak ada | BELUM | M-15 |
| QO-10 | Kampanye WhatsApp blast, kampanye email, evaluasi | Marketing & Campaign Management/* | tidak ada | MITRA (WhatsApp API berbayar per pesan, email butuh layanan kirim); pengganti: daftar penerima + tautan wa.me satu per satu, ekspor segmen | M-16 |
| QO-11 | Workflow automation | Operation & Workflow Automation/Workflow Automation | aturan otomatis, izin otopilot, rute | SEBAGIAN | M-20 |
| QO-12 | Call center, cloud PBX, WhatsApp Call | Call & Voice/* | tidak ada | MITRA (operator telekomunikasi) | - |
| QO-13 | Loyalitas pelanggan (poin) | Loyalty Management/* | tidak ada | BELUM | M-16 |
| QO-14 | Janji temu (appointment) | Qontak Appointment Management/* | tidak ada | BELUM | M-16 |
| QO-15 | WhatsApp Commerce (katalog dan keranjang di WA) | Qontak Commerce/* | tidak ada | MITRA (WhatsApp API); pengganti: halaman katalog publik + pesan wa.me terisi | M-16 |
| QO-16 | Conversion API (Meta) | Conversion API Management/* | tidak ada | MITRA (Meta) | - |
| QO-17 | Kinerja agen, QA scorecard | General & Platform/Agent Performance and Quality Assurance | tidak ada | BELUM | M-16 |
| QO-18 | Akun, izin pengguna, akun WhatsApp, Meta Business Portfolio, BSUID, pengaturan, Qontak One, notifikasi | General & Platform/*; Qontak One/* | peran tetap, push | SEBAGIAN | M-21 |
| QO-19 | Paket kasus, video, rilis, konsultan | Video; What's New; General & Platform/Mekari Qontak Consultant | /panduan | ADA / LUAR untuk konsultan | - |

## Sign (tanda tangan dan dokumen)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| SI-01 | Tanda tangan elektronik tersertifikasi | Document/Tanda Tangan Dokumen; Mobile App/Menandatangani Dokumen | tidak ada | MITRA (PSrE berinduk Kominfo); pengganti: tanda tangan elektronik tidak tersertifikasi dengan jejak bukti (lihat pihak-ketiga.md) | M-17 |
| SI-02 | Unggah dan kirim dokumen, urutan penanda tangan, pengingat, kedaluwarsa, kelola dokumen | Document/Unggah dan Kirim Dokumen, Mengelola Dokumen, Sekilas Menu Dokumen | surat keluar terbit + QR | BELUM | M-17 |
| SI-03 | Templat dan kirim massal, berbagi templat | Templates/* | templat surat keluar | SEBAGIAN | M-17 |
| SI-04 | Repositori kontrak, field lintas perusahaan, pengingat berakhir | Contracts/* | kontrak_selesai di gerbang gaji | BELUM | M-17 |
| SI-05 | Approval request, workflow, form template | Approvals/* | Feed usulan | SEBAGIAN | M-17, M-20 |
| SI-06 | e-Meterai (beli, bubuhkan) | e-Meterai/* | tidak ada | MITRA (Peruri lewat distributor resmi) | M-17 |
| SI-07 | Signing proof (bukti tanda tangan) | Signing Proof/*; Mobile App/Signing Proof | /v/<kode> verifikasi surat | SEBAGIAN | M-17 |
| SI-08 | Kontak, tag, insight, custom fields, preferensi, notifikasi | Contacts/*; Insight/*; Settings/*; Getting Started/* | tidak ada | BELUM | M-17 |
| SI-09 | Fitur AI dokumen (ringkas, cari klausul) | Document/Fitur AI | Lempar membaca 14 jenis berkas | SEBAGIAN | M-17 |
| SI-10 | Cap perusahaan digital (corporate stamp) | pusat bantuan Mekari umum (Corporate Stamp) | tidak ada | BELUM (gambar cap tidak tersertifikasi) | M-17 |
| SI-11 | Aplikasi mobile, FAQ, video, rilis | Mobile App/*; FAQ; Video; What's New | PWA | ADA | - |

## Expense (pengeluaran, perjalanan, pembelian, kartu)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| EX-01 | Klaim karyawan dengan OCR struk, kategori, saldo per kategori | Expense Claims/*; Expense Mobile/Mobile Home | Lempar nota (pemilik) | BELUM untuk karyawan | M-18 |
| EX-02 | Kebijakan pengeluaran (batas per kategori, per tujuan) | Expense Policies/* | tidak ada | BELUM | M-18 |
| EX-03 | AI Checker kebijakan dan kewajaran klaim | Approval Process/AI Checker | Gerbang Gaji (pola), keyakinan baca | BELUM | M-18 |
| EX-04 | Perjalanan dinas: pengajuan, uang muka, laporan, kebijakan tujuan | Business Trip/*; Expense Mobile/Mobile Trip | tidak ada | BELUM | M-18 |
| EX-05 | Pembelian: purchasing, vendor, vendor portal, pajak | Purchase Management/*; Expense Mobile/Mobile Purchase | Lempar nota pemasok, /app/beli (PR, PO, penerimaan, tagihan, retur) | SEBAGIAN: portal pemasok dan pajak pembelian (PPN masukan per tagihan) belum | M-04 |
| EX-06 | Workflow persetujuan klaim/trip/pembelian/vendor | Workflow Setup/*; Approval Process/Approvals | Feed | SEBAGIAN | M-18 |
| EX-07 | Kartu korporat virtual/fisik, kartu debit bisnis | Corporate Cards/* | tidak ada | MITRA (bank penerbit/PJP) | - |
| EX-08 | Pengiriman uang internasional, kalkulator kurs | halaman /produk/expense/international-remittance, kalkulator-mata-uang | kurs isian di invoice ekspor | MITRA untuk remitansi; kalkulator kurs dari kurs publik BELUM | M-08 |
| EX-09 | Akun, multi company, custom fields, scheduler, pengguna | Account Management/*; User Management/*; Getting Started/* | multi usaha | SEBAGIAN | M-21 |
| EX-10 | Integrasi Jurnal | Mekari Jurnal Integration/* | satu database | ADA (by design) | - |
| EX-11 | Video dan rilis | Video; What's New (Video); What's New (Guidebook) | /panduan | ADA | - |

## Produk lain (pusat bantuan Mekari umum dan halaman produk)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| LA-01 | Flex: akses gaji lebih awal (EWA), benefit fleksibel, asuransi, cicilan, Flex Savings, poin dan promo | Mekari Flex for Company/*; Mekari Flex for Individual Employee/*; Flex Savings/* | tidak ada | MITRA (lembaga keuangan berizin OJK); pengganti: kasbon dari kas usaha sendiri dengan potongan gaji yang disepakati | M-10 |
| LA-02 | Capital: pembiayaan invoice, pembelian, persediaan, revolving | halaman /produk/capital/* | tidak ada | MITRA (OJK); pengganti: paket data laporan siap kirim ke pemberi pinjaman pilihan pemilik | M-01 |
| LA-03 | POS: produk, pesanan, pengaturan, integrasi Jurnal | Mekari POS/* | tidak ada | BELUM | M-19 |
| LA-04 | Officeless: Studio, Workflow, Insight, Connection, Settings; jasa aplikasi kustom | Mekari Officeless/* | aturan otomatis, MCP | SEBAGIAN: pembuat alur + formulir kustom; jasa = LUAR | M-20 |
| LA-05 | Mekari Account: satu akun, info pribadi, perusahaan, keamanan, marketplace, integrasi, Mekari Access (2FA, SSO) | Mekari Account/* | satu akun Supabase, ganti usaha | SEBAGIAN: 2FA TOTP, sesi perangkat; SSO SAML butuh paket berbayar Supabase (keputusan Tristan) | M-21 |
| LA-06 | Mekari Partners Platform (program mitra/reseller) | Mekari Partners Platform/* | direktori mitra | SEBAGIAN: program rujukan mitra akuntan | M-24 |
| LA-07 | Stream: OCR dan IDP | halaman /produk/stream/* | Lempar Saja + ekstraktor terkompilasi 0 token | ADA (lebih hemat) | - |
| LA-08 | Desty: omnichannel commerce marketplace | halaman /produk/desty/ | tidak ada | MITRA (API marketplace) | W-09 |
| LA-09 | Pay: gerbang pembayaran | halaman /produk/pay/ | QRIS statis | MITRA (PJP) | M-05 |
| LA-10 | Flow: otomasi antaraplikasi | halaman /produk/flow/ | MCP, rencana W-08 | SEBAGIAN | W-08, M-20 |
| LA-11 | Airene: asisten AI | halaman /produk/airene/ | MCP, Sarapan Data | SEBAGIAN | M-22 |
| LA-12 | Rilis produk, panduan, video (umum) | General/*; Video | /panduan | ADA | - |
| LA-13 | Mekari University, Community, Event, Payroll Service | halaman umum | tidak relevan | LUAR | - |

## Ringkasan status

Dihitung oleh `alat/cek_cakupan.py --hitung` dari kolom Status (kata pertama). Tabel di atas berisi 134 baris, dan seluruh 545 bagian pusat bantuan tercakup.

| Status | Jumlah |
|---|---|
| ADA | 23 |
| SEBAGIAN | 57 |
| BELUM | 35 |
| MITRA | 17 |
| LUAR | 2 |

Sebagian baris MITRA punya bagian yang bisa dibangun sendiri tanpa mitra. Contohnya web chat dan Telegram di QO-01, serta berkas impor Coretax di KP-01. Bagian itu masuk tugas di rencana.md.
