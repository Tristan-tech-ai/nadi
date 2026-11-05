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
| TA-02 | Struktur organisasi, cabang, job level, posisi, SBU, multi NPWP, cost center, bagan organisasi | Settings/Company; Launchpad/Company | topi, peta organisasi (Kerja > peta), tempat absen, multi usaha; jabatan, level, departemen/cost center, atasan langsung, bagan organisasi (/app/orang/kerja, M-11) | SEBAGIAN: multi NPWP satu usaha, cabang per orang | M-11 |
| TA-03 | Custom fields karyawan | Settings/Company | kolom data tambahan per usaha (teks, angka, tanggal, pilihan, ya/tidak) diperiksa database, staf hanya melihat kolom yang diizinkan (M-11B) | ADA | M-11 |
| TA-04 | Peran akses fleksibel dan custom roles | Settings/Users | pemilik, admin, akuntan, staf + peran kustom per izin (/app/akun/keamanan; katalog izin stok.lihat, stok.ubah ditegakkan RLS dan RPC) | SEBAGIAN: katalog izin baru mencakup stok dan produksi | M-21 |
| TA-05 | Alur persetujuan bertingkat per jenis pengajuan, delegasi | Settings/Workflows; Inbox | Feed usulan untuk_peran, rute pemilik bila uang besar, izin otopilot; persetujuan bertingkat atasan langsung lalu pemilik, delegasi saat atasan izin/cuti (M-11B) | SEBAGIAN: rantai atasan langsung > pemilik dengan delegasi untuk izin dan lembur (M-11B); jenis lain (uang, kasbon) dan rantai lebih dari dua tingkat belum | M-11 |
| TA-06 | Employee self-service web + mobile | For Employee/*; Mobile App/*; Settings/ESS | PWA staf: absen, izin, slip, jadwal, kerja, rekam ilmu; data kerja dan surat peringatan sendiri, pengumuman (/app/pengumuman, M-11) | ADA (pengajuan perubahan data belum) | M-11 |
| TA-07 | Onboarding karyawan baru (daftar tugas, dokumen, akun) | Employees/New Joiner; Employees/Onboarding | akun staf + PIN, topi otomatis; daftar periksa onboarding bawaan 6 butir dengan centang (M-11) | SEBAGIAN: unggah dokumen oleh karyawan baru | M-11 |
| TA-08 | Offboarding, resign, transfer/mutasi/promosi dengan riwayat | Employees/Offboarding; API Employee Transfer | Serah terima, hak berhenti, wawancara keluar, SK mutasi; riwayat jabatan (masuk, promosi, mutasi, demosi) dengan tanggal berlaku, daftar periksa offboarding (M-11) | SEBAGIAN: promosi lewat persetujuan bertingkat, riwayat gaji | M-11 |
| TA-09 | Teguran / surat peringatan | Employees/Reprimand; API Reprimand | surat peringatan SP1-SP3 berurutan dengan masa berlaku 6 bulan atau sesuai PK/PP/PKB, SP pertama dan terakhir, SP baru ditolak saat SP3 berlaku (PP 35/2021 Pasal 36 huruf k, Penjelasan Pasal 52); staf melihat SP sendiri (M-11); SP terbit sebagai surat keluar bernomor ber-QR (M-11B) | ADA | M-11 |
| TA-10 | Manpower planning: rencana posisi, headcount, anggaran per periode | Employees/Manpower Planning | /app/rekrutmen: rencana per topi per tahun (target orang, anggaran gaji per bulan, catatan) dibandingkan dengan orang aktif bertopi itu dan lowongan buka | ADA | M-14 |
| TA-11 | Templat dokumen karyawan (kontrak, offering, keterangan) diisi otomatis | Productivity/Document Templates; Company/Files | surat keluar (SK mutasi, surat tugas, keterangan kerja) + QR verifikasi; templat dokumen bebas dengan penanda nama/jabatan/status menjadi draf surat keluar bernomor ber-QR (M-11B) | ADA | M-11, M-17 |
| TA-12 | Pengumuman + tanda sudah dibaca (acknowledgement) | Company/Announcement; Dashboard/Announcement | pengumuman untuk semua atau per peran, tanda sudah dibaca, jumlah yang sudah membaca untuk pengelola, tautan di Feed (M-11) | ADA | M-11 |
| TA-13 | Form dan survei karyawan | Productivity/Forms and Surveys; API Form | survei skala/pilihan/teks, anonim tanpa akun dengan ringkasan setelah 3 jawaban, wawancara keluar (M-11B) | SEBAGIAN: formulir pengajuan bebas belum | M-11 |
| TA-14 | Aset perusahaan yang dipinjam karyawan | Company/Assets; API Asset | Serah terima butir barang; daftar aset, pinjamkan ke karyawan dan kembalikan dengan riwayat, staf melihat aset yang ia pinjam (M-06) | ADA | M-06 |
| TA-15 | File perusahaan, aktivitas pengguna, antrean proses, notifikasi | Company/Files; Company/User Activity; Company/Queue Activity; Company/Notification | Lempar (arsip berkas), audit_log, push, log aktivitas pengguna (masuk, keluar, 2FA, cabut sesi) per orang dan per usaha di /app/akun/keamanan | SEBAGIAN: antrean proses belum | M-21 |
| TA-16 | Insights: headcount, absensi, payroll, karyawan berisiko, kinerja, lembur, dasbor kustom, report builder | Insights/*; Company/Report Builder; Dashboard/*; Time/Time Reports | KPI, beban tim, sinyal beban, alur nyata, Sarapan Data, /app/wawasan (M-23): orang aktif, pergantian 12 bulan, absen hari ini dan bulan ini, lembur, gaji bulan terakhir, yang perlu ditanya kabarnya, penjualan dan tagihan terbuka; pembuat laporan orang/produk/invoice dengan pilih kolom, saring, CSV | SEBAGIAN: grafik tren dan dasbor bersusun bebas belum, laporan kinerja per orang belum | M-23 |
| TA-17 | Absensi mobile: selfie, GPS/geofence, liveness AI, kunci absensi | Time/Attendance; Mobile App/Time Management | QR TOTP 15 detik + cek wajah di perangkat; geofence radius per tempat dengan pesan jarak; kunci absensi per bulan (M-12) | ADA | M-12 |
| TA-18 | Live tracking karyawan lapangan (rute, kunjungan, penyimpangan) | Time/Live Tracking; API Live Attendance | kunjungan sales: lokasi diambil sekali saat mencatat, hanya bila sales mencentang izin, bertujuan bukti kunjungan (M-15) | SEBAGIAN: pelacakan rute terus-menerus sengaja tidak dibuat (UU 27/2022, data lokasi karyawan) | M-15 |
| TA-19 | Shift, scheduler, multiple shift, on-call, tukar shift | Time/Scheduler; Time/Multiple Shift; Time/On-call; Time/Calendar; Settings/Time | jadwal shift, tukar shift, usulan jadwal, batas PP 35/2021; shift siaga (on-call) (M-12) | SEBAGIAN: banyak shift sehari belum diuji khusus | M-12 |
| TA-20 | Lembur: pengajuan karyawan, aturan, perhitungan | Time/Overtime; API Overtime | catat_lembur pemilik/admin + upah lembur di slip; staf mengajukan lembur sendiri lewat Feed (M-12) | ADA | M-12 |
| TA-21 | Cuti: jatah, saldo, carry forward, cuti per jam, block leave | Time/Time Off; API Time Off | izin otopilot, jatah cuti, bukti | SEBAGIAN: cuti per jam, block leave, sisa cuti terbawa belum | M-12 |
| TA-22 | Kalender kerja dan libur nasional | Time/Calendar | libur nasional dan cuti bersama 2026 bertanggal dari SKB 3 menteri (setneg.go.id), tampil di Jadwal (M-12) | SEBAGIAN: belum mengurangi hari kerja di hitungan izin dan gaji | M-12 |
| TA-23 | Tablet absen (Talenta Portal), mesin sidik jari, absen tanpa sentuh | Mobile App/Talenta Portal; API Fingerprint | kios tablet token nmk_; log mesin sidik jari/wajah (CSV/Excel) lewat Lempar dibaca tanpa AI menjadi rekap absen (M-12) | SEBAGIAN: sambungan langsung ke mesin tetap MITRA | M-12 |
| TA-24 | Proyek, tugas, timesheet | Productivity/Projects and Tasks; API Task and Timesheet | papan kerja poin, estimasi kerja AI, beban, /app/proyek: RAB per proyek vs realisasi dari jurnal bertag, jam kerja per orang per proyek (staf mencatat sendiri) + perkiraan biaya tenaga (W-07D) | SEBAGIAN: tugas per proyek (gantt) belum | M-12, W-07D |
| TA-25 | Payroll: komponen, struktur gaji, run payroll, PPh 21 TER, BPJS, THR, prorata, mingguan, kunci dan publikasi slip, riwayat | Payroll/Payroll Processing; Payroll/Payroll Components; Payroll/Salary Structure; Settings/Payroll | slip bulanan, PPh 21 TER/Pasal 17, BPJS, lembur, Gerbang Gaji, tahan slip, tautan slip; THR Permenaker 6/2016 dihitung database (/app/gaji/thr, usulan ke Feed); batas potongan Pasal 65 PP 36/2021 ditegakkan di slip; THR harian lepas dari rata-rata upah slip (Pasal 3 ayat (3)) | SEBAGIAN: prorata, payroll mingguan/harian, komponen kustom, struktur gaji | M-10 |
| TA-26 | Simulasi pajak, compensation planning (kenaikan gaji) | Payroll/Tax Simulation; Payroll/Compensation Planning | Kompas Pajak (PPh final UMKM) | BELUM | M-10 |
| TA-27 | Compliance: eBupot 21/26 ke DJP, laporan BPJS, SPT 21 | Payroll/Compliance; Payroll/Reports | ekspor BPMP (templat Excel Coretax) di Ruang Akuntan | SEBAGIAN: berkas BPJS, bukti potong A1. Kirim langsung ke DJP: MITRA | M-09, M-10 |
| TA-28 | Payroll disbursement dan berkas e-banking | Payroll/Payroll Processing; API Payroll Payment Schedule | tautan slip + wa.me; berkas payroll CIMB Niaga OCTO Biz (CSV inhouse dan SKN dari spesifikasi resmi bank, diperiksa sebelum diunduh) dari rekening karyawan di halaman Orang | SEBAGIAN: format bank lain (BCA, Mandiri, BRI) karena panduan kolomnya tidak publik. Transfer otomatis: MITRA | M-10 |
| TA-29 | Alokasi biaya payroll ke cost center/cabang | Payroll/Payroll Allocation; API Cost Center | jurnal gaji tunggal | BELUM | M-10 |
| TA-30 | Reimbursement, cash advance, pinjaman karyawan | Finance/*; Mobile App/Reimbursement; Settings/Finance; API Loans, Reimbursement | kasbon (uang muka upah) dari kas usaha sendiri, jurnal piutang karyawan 1-150, cicilan dibatasi 50% upah (PP 36/2021 Pasal 63 dan 65); cicilan otomatis di slip, sisa berkurang saat gaji disetujui (jurnal 6-100/1-150), /app/gaji/kasbon; reimbursement /app/klaim dibayar lewat slip (penggantian, bukan upah) atau kas (M-18) | SEBAGIAN: pinjaman berbunga atau pihak ketiga tidak dibuat (Nadi tidak meminjamkan uang) | M-18, M-10 |
| TA-31 | Rekrutmen ATS: lowongan, kandidat, talent pool, asesmen, MBTI, CV parsing, AI scoring, kalender, laporan, job portal | Recruitment/*; For Employee/Recruitment | lowongan, /lamar, baca CV tanpa model, rubrik, wawancara suara + transkrip, uji kerja, IPIP, Bank Talenta, status pelamar, lingkaran rekrut, penjaga bias, jadwal wawancara + .ics + undangan wa.me, laporan rekrutmen (tahap, sumber ?src=, hari sampai terisi, biaya iklan per pelamar), data JobPosting di /lamar | SEBAGIAN: pasang ke job portal MITRA, MBTI tidak dibuat | M-14 |
| TA-32 | Kinerja: goals KPI/OKR, review (diri, atasan, rekan), kalibrasi, talents/9-box, kompetensi, suksesi, IDP | Performance Management/* | KPI dari papan kerja, kolam bonus, /app/kinerja: tujuan per orang + progres, siklus review diri/atasan/rekan dengan skor per kompetensi, kalibrasi skor akhir + potensi menjadi 9-box, IDP; nilai rahasia (pemilik/admin/atasan langsung) (M-13) | SEBAGIAN: suksesi belum, kompetensi per topi belum (kompetensi per siklus) | M-13 |
| TA-33 | LMS: materi, tes, progres, sertifikat | LMS/* | /app/kursus: kursus dari langkah Rekam ilmu atau ditulis sendiri, kuis pilihan ganda dinilai server (kunci tanpa hak baca klien), 5 percobaan sehari, progres per orang (diri, atasan, pengelola), sertifikat bernomor SERT /sertifikat/<kode> cetak PDF + verifikasi | ADA (video kursus, jalur belajar per topi, dan tenggat wajib belum) | M-13B |
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
| JU-05 | e-Meterai pada invoice | Penjualan/Stamp eMeterai | tanda wajib meterai pada dokumen bertanda tangan (M-17) | MITRA (Peruri lewat distributor resmi) | M-17 |
| JU-06 | Pembelian: permintaan, penawaran, pesanan, penerimaan, tagihan pemasok, pembayaran, approval | Pembelian/*; Pemenuhan/Pembelian | /app/beli: permintaan (PR), pesanan (PO), penerimaan barang masuk stok, tagihan pemasok dicocokkan ke PO (selisih), jatuh tempo, bayar sebagian, retur/nota debit, saldo per pemasok; nota Lempar menyebut PO yang cocok dan jadi hutang saat disetujui; PIB impor | SEBAGIAN: penawaran harga dari pemasok dan approval berjenjang PO belum | M-04 |
| JU-07 | Biaya dengan approval draft | Biaya/* | Lempar nota, Feed | ADA (dasar); pemetaan akun per kategori belum | M-04 |
| JU-08 | Kontak: pelanggan, supplier, karyawan, pihak lain, grup, kredit/debit memo | Kontak/* | graf usaha (pihak), saldo per pelanggan (/app/jual) dan per pemasok (/app/beli), nota kredit dan nota debit | SEBAGIAN: buku kontak terpusat (alamat, NPWP, grup) belum | M-03, M-04 |
| JU-09 | Produk dan jasa: kategori, satuan, varian, bundle, konversi, aturan harga, barcode, batch/seri | Produk/*; Daftar Lainnya/Atribut Varian Produk, Satuan Produk, Produk | /app/barang: produk barang/jasa/paket, satuan besar + faktor, barcode, kode; layar varian (induk + ciri) dan harga grosir bertingkat yang terisi sendiri di invoice, daftar produk dari Excel/foto lewat Lempar jadi usulan produk.impor (M-02B) | ADA | M-02, M-02B |
| JU-10 | Persediaan: penyesuaian, stok opname, nilai (rata-rata), hitung ulang, tipe penyimpanan | Produk/Penyesuaian Stok; Daftar Lainnya/Penghitungan Ulang Nilai Persediaan, Tipe Penyimpanan Persediaan | rata-rata tertimbang bergerak, opname per produk dengan jurnal selisih 5-200, kartu stok berjalan (M-02); hitung stok banyak barang dari foto/Excel lewat Lempar jadi opname gudang utama (M-02B) | SEBAGIAN: hitung ulang nilai persediaan dan tipe penyimpanan belum | M-02, M-02B |
| JU-11 | Gudang, multi gudang, transfer gudang, lokasi rak/bin | Produk/Gudang, Multi Gudang, Transfer Gudang | gudang banyak, gudang utama untuk invoice, pindah gudang dengan nilai rata-rata (M-02); lokasi rak/bin per stok dan laporan stok per gudang (M-02B) | ADA | M-02, M-02B |
| JU-12 | Produksi: BoM bertingkat, perintah kerja, biaya standar, assembly/disassembly, pemetaan akun | Produksi/* | /app/produksi: resep bertingkat (lingkaran ditolak), urai kebutuhan bahan, perintah kerja ambil bahan ke barang dalam proses lalu selesai pada biaya sebenarnya, produk bersama dan sampingan, biaya standar + selisih, rakit, bongkar, batal mengembalikan bahan | SEBAGIAN: pemetaan akun per usaha belum (akun tetap 1-320/5-310), tenaga dari timesheet belum | M-07 |
| JU-13 | Pemenuhan pesanan: ambil barang, segregasi stok, surat jalan, terima barang | Pemenuhan/* | tidak ada | BELUM | M-02, M-03 |
| JU-14 | Kas dan bank: akun, transfer, terima/kirim uang, pemetaan kas | Kas & Bank/* | /app/kas: rekening kas/bank/dompet (akun 1-10x/1-11x), saldo, pindah dana, uang masuk/keluar ke akun pilihan | ADA | M-05 |
| JU-15 | Rekonsiliasi bank: manual, aturan, otomatis, batal | Kas & Bank/Rekonsiliasi Bank, Aturan Rekonsiliasi, Rekonsiliasi Bank Otomatis, Mengembalikan Rekonsiliasi | /app/kas: mutasi CSV atau e-statement Lempar dicocokkan ke invoice, tagihan pemasok, jurnal yang sudah tercatat, atau aturan kata kunci pengguna; cocokkan semua usulan; batal = jurnal dibalik; korpus 3 format bank 21/22 per format, 0 salah | ADA | M-05 |
| JU-16 | Cashlink feeds (mutasi bank otomatis) | Kas & Bank/Cashlink Feeds | unggah CSV mutasi di /app/kas; e-statement PDF/CSV lewat Lempar masuk ke rekening Bank saat disetujui | MITRA (API bank SNAP / agregator); pengganti sudah jalan: CSV dan Lempar; alamat email lempar belum dibangun (butuh layanan email masuk, biayanya belum diriset) | M-05 |
| JU-17 | Aset tetap: daftar, saldo awal, penyusutan, aset tertunda, dijual/dilepas | Aset/* | /app/aset: daftar, kelompok Pasal 11 UU PPh, penyusutan garis lurus/saldo menurun bulanan otomatis dengan jurnal 6-500/1-590, menyusul bulan yang belum, jual/lepas dengan laba 4-910 atau rugi 6-990 (M-06) | SEBAGIAN: aset tertunda (dalam pengerjaan) dan penyusutan komersial terpisah dari fiskal belum | M-06 |
| JU-18 | Laporan 40+: neraca, laba rugi, arus kas, buku besar, neraca saldo, umur piutang/hutang, penjualan/pembelian per pihak/produk, persediaan, aset, pajak, kurs, bank | Laporan/* | /app/buku: neraca, laba rugi, arus kas tidak langsung, neraca saldo, buku besar, umur tagihan; CSV + cetak PDF (M-01) | SEBAGIAN: laporan per pelanggan/produk/pajak/kurs menyusul M-02, M-03, M-08, M-09 | M-01 |
| JU-19 | Multi mata uang, kurs, revaluasi, laba rugi kurs | Daftar Lainnya/Daftar Mata Uang; Laporan/Pertukaran Kurs | invoice ekspor USD + kurs per invoice; revaluasi piutang USD per tanggal dan pelunasan pada kurs hari bayar dengan laba/rugi selisih kurs 4-920/6-920; kurs pajak resmi KMK + kurs usaha (M-08) | SEBAGIAN: utang valas (pembelian impor) belum direvaluasi; valuta selain USD di invoice belum | M-08 |
| JU-20 | Anggaran dan laba rugi anggaran | halaman /produk/jurnal/rencana-anggaran; API Budget | anggaran per akun pendapatan/beban per bulan (sampai 24 bulan sekaligus), laporan anggaran vs realisasi dengan selisih dan persen, bisa per cabang/proyek, /app/buku/lanjut (M-08) | ADA | M-08 |
| JU-21 | Tag/dimensi (cabang, proyek), aturan tagging, laba rugi dimensional | Daftar Lainnya/Tag; Pengaturan/Aturan Tagging | dimensi cabang dan proyek di tingkat jurnal, tag manual, aturan kata yang menandai jurnal baru dan jurnal lama, laba rugi per cabang/proyek (M-08) | ADA | M-08 |
| JU-22 | Transaksi berulang (jadwal) | Daftar Lainnya/Daftar Jadwal Berulang | jurnal berulang bulanan/mingguan, dibukukan pg_cron tiap pagi atau tombol, idempoten per tanggal, galat bulan terkunci dicatat, bisa dihentikan (M-08); invoice berulang untuk sewa/SPP/langganan tiap 1/3/6/12 bulan, terbit pg_cron 06.30 WIB atau tombol, idempoten per periode, jeda/lanjut, berhenti di tanggal selesai (W-07A) | ADA | M-08, W-07A |
| JU-23 | Templat dokumen, invoice berbranding, pro forma, progress invoice, invoice gabungan | Pengaturan/Template; Penjualan/Penagihan Penjualan | invoice cetak bawaan | SEBAGIAN | M-03 |
| JU-24 | Pengaturan: perusahaan, penjualan, pembelian, produk, custom field, pemetaan akun, pengguna, approval, tagihan langganan | Pengaturan/* | /app/perusahaan | SEBAGIAN | M-01, M-21 |
| JU-25 | Daftar audit, daftar transaksi, lampiran, cutoff, limit transaksi | Daftar Lainnya/Daftar Audit, Daftar Transaksi, Daftar Lampiran, Periode Cutoff, Sekilas Menu Daftar Lainnya, Perhitungan Transaksi Berjalan; Memulai/Limitasi Pembuatan Transaksi | audit_log, berkas bukti di usulan, daftar aktivitas usaha di /app/akun/keamanan | SEBAGIAN: daftar audit perubahan data per tabel belum ditampilkan | M-21 |
| JU-26 | Impor/ekspor data, migrasi dari aplikasi lain | Beranda/Migrasi Data; Daftar Lainnya/Daftar Import dan Ekspor; Penjualan/Mengimpor Template | Lempar Excel/CSV | SEBAGIAN: impor COA, saldo awal, kontak, produk, ekspor semua data | M-24 |
| JU-27 | Konsolidasi beberapa perusahaan | Aplikasi/Konsolidasi; Integrasi/Jurnal Consolidation | konsolidasi 2 sampai 10 usaha milik pemilik yang sama (neraca + laba rugi), transaksi antarusaha (jual, pinjam, bayar) dicatat di dua usaha dan dieliminasi (M-08) | SEBAGIAN: kepemilikan sebagian (minoritas) dan valuta berbeda antarusaha belum | M-08 |
| JU-28 | Jurnal Mobile | Jurnal Apps/Jurnal Mobile | PWA | ADA | - |
| JU-29 | Asisten AI (Airene): analisis laporan, tanya data | Beranda/Mekari Airene | MCP (AI milik pengguna), Sarapan Data | SEBAGIAN: tanya data di dalam aplikasi | M-22 |
| JU-30 | Mekari Pay: terima pembayaran (VA, QRIS dinamis, kartu), bayar supplier, saldo | Mekari Pay/* | QRIS statis pemilik, transfer, tunai; mutasi masuknya dicocokkan di /app/kas | MITRA (PJP berizin BI); sambung payment gateway milik pemilik belum diriset | M-05 |
| JU-31 | Jurnal Touch (POS), Jurnal Channel (marketplace), App Store, integrasi software lain | Integrasi/* | MCP, pintu data W-08, kasir /app/kasir (M-19) | SEBAGIAN: POS ADA, marketplace MITRA | M-19, W-08, W-09 |
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
| QO-02 | Penugasan chat ke agen, eskalasi, jam operasional, templat, lampiran, log | Conversation Management/*; Customer Support & Ticketing/Inquiry Assignment | kotak masuk obrolan web /app/layanan: penugasan ke agen, jam layanan dan pesan di luar jam, balasan, templat balasan berisi {nama}, tutup, log pesan (M-16, M-16B) | SEBAGIAN: eskalasi otomatis dan lampiran belum | M-16, M-16B |
| QO-03 | Chatbot AI dan AI agent, ringkas/parafrase chat, produktivitas agen | AI Chatbot & Automation/* | jawaban otomatis tanpa model: mencocokkan kata pertanyaan dengan basis pengetahuan dan mengutip artikel apa adanya, selain itu diserahkan ke tim (M-16) | SEBAGIAN: ringkasan/parafrase obrolan dengan model belum (sengaja: jawaban pelanggan tidak dikarang) | M-16 |
| QO-04 | Tiket, SLA hitung mundur, umpan balik/CSAT, laporan layanan | Customer Support & Ticketing/* | tiket = obrolan dengan status, agen, tenggat SLA balasan pertama, CSAT 1-5 dari pelanggan, laporan layanan bulanan (M-16) | ADA | M-16 |
| QO-05 | Basis pengetahuan | Operation & Workflow Automation/Knowledge Base | basis pengetahuan pelanggan di /app/layanan, dipakai jawaban otomatis obrolan (M-16) | SEBAGIAN: halaman artikel publik yang bisa dicari belum | M-16 |
| QO-06 | CRM: kontak, perusahaan, deal pipeline, produk, field, goal, dokumen, catatan, tugas | Sales Management/*; Customer Data Platform/Contact (CRM), Company Module; Operation & Workflow Automation/Task Management, Product Catalog | pelanggan orang/perusahaan (kontak menempel ke perusahaan), deal 6 tahap dengan sales, nilai, perkiraan tutup, catatan dan tugas berjatuh tempo, deal menjadi penawaran M-03 dan menang saat jadi pesanan, /app/pelanggan (M-15) | SEBAGIAN: field kustom dan dokumen per deal belum | M-15 |
| QO-07 | Live location dan kunjungan sales lapangan | Sales Management/Live Location & Tracking | kunjungan berlokasi dengan izin per kunjungan, dihitung di laporan sales (M-15) | SEBAGIAN: peta lokasi langsung tidak dibuat (lokasi tidak dilacak terus) | M-15 |
| QO-08 | Laporan sales, report builder | Report Management/* | laporan sales bulanan: corong per tahap, menang, kalah, tingkat menang, per sales menang vs target, kunjungan (M-15) | SEBAGIAN: pembuat laporan /app/wawasan (M-23) baru untuk orang, produk, invoice; sumber deal dan kunjungan belum | M-15, M-23 |
| QO-09 | Customer Data Platform, kontak omnichannel, insight pelanggan, segmen | Customer Data Platform/* | segmen otomatis dari invoice 365 hari (belanja terbesar, setia, baru, lama tidak belanja) + segmen isian (M-15) | SEBAGIAN: kontak omnichannel (chat masuk) butuh integrasi WhatsApp Business (MITRA) | M-15 |
| QO-10 | Kampanye WhatsApp blast, kampanye email, evaluasi | Marketing & Campaign Management/* | tidak ada | MITRA (WhatsApp API berbayar per pesan, email butuh layanan kirim); pengganti: daftar penerima + tautan wa.me satu per satu, ekspor segmen | M-16 |
| QO-11 | Workflow automation | Operation & Workflow Automation/Workflow Automation | aturan otomatis, izin otopilot, rute, /app/alur (M-20): pemicu kejadian Nadi atau formulir, syarat, aksi kartu Feed / kerja / webhook keluar, batas per jam, riwayat jalan | ADA (cabang bersyarat bertingkat dan jeda waktu belum) | M-20 |
| QO-12 | Call center, cloud PBX, WhatsApp Call | Call & Voice/* | tidak ada | MITRA (operator telekomunikasi) | - |
| QO-13 | Loyalitas pelanggan (poin) | Loyalty Management/* | poin dari invoice lunas 365 hari per pelanggan (aturan Rp per poin), penukaran tercatat dan tidak melebihi sisa, /app/janji-temu (M-16B) | ADA | M-16B |
| QO-14 | Janji temu (appointment) | Qontak Appointment Management/* | janji temu publik /janji/<kunci>: layanan berdurasi, hari dan jam buka, slot kosong per jeda, tidak bisa bertumpuk (constraint database), pemilik menandai datang atau batal (M-16B) | SEBAGIAN: pengingat otomatis ke pelanggan butuh WhatsApp API (MITRA) | M-16B |
| QO-15 | WhatsApp Commerce (katalog dan keranjang di WA) | Qontak Commerce/* | katalog publik /katalog/<kunci> dengan tombol pesan yang membuka wa.me berisi teks pesanan (M-16B) | MITRA (WhatsApp API untuk keranjang di WA); pengganti katalog + wa.me ADA | M-16B |
| QO-16 | Conversion API (Meta) | Conversion API Management/* | tidak ada | MITRA (Meta) | - |
| QO-17 | Kinerja agen, QA scorecard | General & Platform/Agent Performance and Quality Assurance | laporan per agen: jumlah tiket dan CSAT rata-rata (M-16) | SEBAGIAN: QA scorecard belum | M-16 |
| QO-18 | Akun, izin pengguna, akun WhatsApp, Meta Business Portfolio, BSUID, pengaturan, Qontak One, notifikasi | General & Platform/*; Qontak One/* | peran tetap + peran kustom, 2FA, push | SEBAGIAN: WhatsApp/Meta MITRA | M-21 |
| QO-19 | Paket kasus, video, rilis, konsultan | Video; What's New; General & Platform/Mekari Qontak Consultant | /panduan | ADA / LUAR untuk konsultan | - |

## Sign (tanda tangan dan dokumen)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| SI-01 | Tanda tangan elektronik tersertifikasi | Document/Tanda Tangan Dokumen; Mobile App/Menandatangani Dokumen | tanda tangan elektronik tidak tersertifikasi (PP 71/2019 Pasal 60 ayat (4)) dengan jejak bukti, disebut jujur di setiap layar (M-17) | MITRA untuk yang tersertifikasi (PSrE berinduk Kominfo); tidak tersertifikasi ADA | M-17 |
| SI-02 | Unggah dan kirim dokumen, urutan penanda tangan, pengingat, kedaluwarsa, kelola dokumen | Document/Unggah dan Kirim Dokumen, Mengelola Dokumen, Sekilas Menu Dokumen | /app/tanda-tangan: dokumen teks, penanda tangan berurutan, tautan sekali pakai, kedaluwarsa, tolak, batal, status per penanda (M-17) | ADA | M-17 |
| SI-03 | Templat dan kirim massal, berbagi templat | Templates/* | templat dengan {nama} dan kirim massal sampai 50 penerima (M-17) | ADA | M-17 |
| SI-04 | Repositori kontrak, field lintas perusahaan, pengingat berakhir | Contracts/* | tanggal berakhir kontrak dan pengingat N hari sebelumnya, penanda tangan tertunda > 2 hari (M-17) | SEBAGIAN: field kustom lintas perusahaan belum | M-17 |
| SI-05 | Approval request, workflow, form template | Approvals/* | Feed usulan, formulir kustom /app/alur (M-20) yang menjalankan alur | SEBAGIAN: persetujuan bertingkat atas formulir kustom belum | M-17, M-20 |
| SI-06 | e-Meterai (beli, bubuhkan) | e-Meterai/* | tanda wajib meterai menurut UU 10/2020 Pasal 3 ayat (2) huruf a dan g (M-17) | MITRA (pembelian dan pembubuhan e-Meterai lewat distributor resmi Peruri); penanda wajib meterai ADA | M-17 |
| SI-07 | Signing proof (bukti tanda tangan) | Signing Proof/*; Mobile App/Signing Proof | bukti tanda tangan publik /tanda/cek/<kode>: penanda dan waktu, isi utuh (sidik SHA-256), rantai jejak hash utuh, cocokkan salinan di perangkat (M-17) | ADA | M-17 |
| SI-08 | Kontak, tag, insight, custom fields, preferensi, notifikasi | Contacts/*; Insight/*; Settings/*; Getting Started/* | tidak ada | BELUM | M-17 |
| SI-09 | Fitur AI dokumen (ringkas, cari klausul) | Document/Fitur AI | Lempar membaca 14 jenis berkas | SEBAGIAN | M-17 |
| SI-10 | Cap perusahaan digital (corporate stamp) | pusat bantuan Mekari umum (Corporate Stamp) | cap perusahaan sebagai gambar di dokumen, diberi label tidak tersertifikasi (M-17) | SEBAGIAN: segel elektronik tersertifikasi (PP 71/2019 Pasal 59 ayat (2)) butuh PSrE (MITRA) | M-17 |
| SI-11 | Aplikasi mobile, FAQ, video, rilis | Mobile App/*; FAQ; Video; What's New | PWA | ADA | - |

## Expense (pengeluaran, perjalanan, pembelian, kartu)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| EX-01 | Klaim karyawan dengan OCR struk, kategori, saldo per kategori | Expense Claims/*; Expense Mobile/Mobile Home | klaim karyawan /app/klaim: kategori, sisa batas per bulan, foto struk diunggah, teks e-struk diurai tanpa model (korpus 32 struk sintetis) mengisi jumlah, tanggal, kategori (M-18); foto struk dibaca OCR di HP lalu model bila ragu, mengisi jumlah, tanggal, pemasok (31/32 foto sulit, docs/quality/eval-struk-foto.md) (M-18B) | ADA | M-18, M-18B |
| EX-02 | Kebijakan pengeluaran (batas per kategori, per tujuan) | Expense Policies/* | batas per orang per kategori per bulan, struk wajib per kategori, tanggal paling lama 60 hari, klaim perjalanan hanya di tanggal perjalanan; ditegakkan database (M-18); uang harian per kota tujuan (M-18B) | SEBAGIAN: batas klaim berbeda per kota tujuan belum | M-18, M-18B |
| EX-03 | AI Checker kebijakan dan kewajaran klaim | Approval Process/AI Checker | pemeriksa aturan pasti di database (batas, struk, tanggal, perjalanan); tebakan kategori dari kata kunci struk (M-18) | SEBAGIAN: pemeriksa kewajaran berbasis model untuk kategori ragu belum | M-18 |
| EX-04 | Perjalanan dinas: pengajuan, uang muka, laporan, kebijakan tujuan | Business Trip/*; Expense Mobile/Mobile Trip | perjalanan dinas: pengajuan lewat atasan lalu pemilik, uang muka 1-160, klaim terkait perjalanan, penyelesaian selisih (kurang dibayar lewat slip, lebih menjadi kasbon) (M-18); tarif uang harian per kota tujuan, klaim uang harian dibuat otomatis saat perjalanan disetujui (M-18B) | ADA | M-18, M-18B |
| EX-05 | Pembelian: purchasing, vendor, vendor portal, pajak | Purchase Management/*; Expense Mobile/Mobile Purchase | Lempar nota pemasok, /app/beli (PR, PO, penerimaan, tagihan, retur) | SEBAGIAN: portal pemasok dan pajak pembelian (PPN masukan per tagihan) belum | M-04 |
| EX-06 | Workflow persetujuan klaim/trip/pembelian/vendor | Workflow Setup/*; Approval Process/Approvals | Feed; klaim dan perjalanan dinas lewat rantai atasan | SEBAGIAN: klaim dan perjalanan lewat atasan langsung lalu pemilik (M-11B, M-18); persetujuan pembelian dan vendor belum | M-18 |
| EX-07 | Kartu korporat virtual/fisik, kartu debit bisnis | Corporate Cards/* | tidak ada | MITRA (bank penerbit/PJP) | - |
| EX-08 | Pengiriman uang internasional, kalkulator kurs | halaman /produk/expense/international-remittance, kalkulator-mata-uang | kurs isian di invoice ekspor; kalkulator kurs dari kurs pajak resmi KMK (USD, SGD, EUR, JPY per 100, CNY) atau kurs usaha (M-08) | MITRA untuk remitansi | M-08 |
| EX-09 | Akun, multi company, custom fields, scheduler, pengguna | Account Management/*; User Management/*; Getting Started/* | multi usaha, pengguna dengan peran kustom, 2FA | SEBAGIAN: custom field dan penjadwal belum | M-21 |
| EX-10 | Integrasi Jurnal | Mekari Jurnal Integration/* | satu database | ADA (by design) | - |
| EX-11 | Video dan rilis | Video; What's New (Video); What's New (Guidebook) | /panduan | ADA | - |

## Produk lain (pusat bantuan Mekari umum dan halaman produk)

| ID | Kemampuan Mekari | Bagian | Nadi sekarang | Status | Tugas |
|---|---|---|---|---|---|
| LA-01 | Flex: akses gaji lebih awal (EWA), benefit fleksibel, asuransi, cicilan, Flex Savings, poin dan promo | Mekari Flex for Company/*; Mekari Flex for Individual Employee/*; Flex Savings/* | tidak ada | MITRA (lembaga keuangan berizin OJK); pengganti: kasbon dari kas usaha sendiri dengan potongan gaji yang disepakati | M-10 |
| LA-02 | Capital: pembiayaan invoice, pembelian, persediaan, revolving | halaman /produk/capital/* | tidak ada | MITRA (OJK); pengganti: paket data laporan siap kirim ke pemberi pinjaman pilihan pemilik | M-01 |
| LA-03 | POS: produk, pesanan, pengaturan, integrasi Jurnal | Mekari POS/* | /app/kasir: produk dan barcode (alat pindai atau kamera BarcodeDetector), keranjang, tunai/QRIS/transfer, jalan tanpa internet (antrean HP berkunci, idempoten), stok dan jurnal penjualan + HPP otomatis, buka/tutup shift dengan selisih kas, struk /struk/kode + WhatsApp, rekap harian per cara bayar dan kasir | ADA | M-19 |
| LA-04 | Officeless: Studio, Workflow, Insight, Connection, Settings; jasa aplikasi kustom | Mekari Officeless/* | aturan otomatis, MCP, pembuat alur + formulir kustom /app/alur (M-20) | SEBAGIAN: pembuat aplikasi bebas (Studio) belum; jasa = LUAR | M-20 |
| LA-05 | Mekari Account: satu akun, info pribadi, perusahaan, keamanan, marketplace, integrasi, Mekari Access (2FA, SSO) | Mekari Account/* | satu akun Supabase, ganti usaha, 2FA TOTP ditegakkan database, daftar sesi perangkat + keluar dari perangkat lain | SEBAGIAN: SSO SAML butuh paket berbayar Supabase (keputusan Tristan) | M-21 |
| LA-06 | Mekari Partners Platform (program mitra/reseller) | Mekari Partners Platform/* | direktori mitra | SEBAGIAN: program rujukan mitra akuntan | M-24 |
| LA-07 | Stream: OCR dan IDP | halaman /produk/stream/* | Lempar Saja + ekstraktor terkompilasi 0 token | ADA (lebih hemat) | - |
| LA-08 | Desty: omnichannel commerce marketplace | halaman /produk/desty/ | tidak ada | MITRA (API marketplace) | W-09 |
| LA-09 | Pay: gerbang pembayaran | halaman /produk/pay/ | QRIS statis | MITRA (PJP) | M-05 |
| LA-10 | Flow: otomasi antaraplikasi | halaman /produk/flow/ | MCP, pintu data masuk W-08, webhook keluar bertanda HMAC dari alur M-20 | ADA (konektor siap pakai per aplikasi belum, lewat n8n/Make/Zapier) | W-08, M-20 |
| LA-11 | Airene: asisten AI | halaman /produk/airene/ | MCP, Sarapan Data | SEBAGIAN | M-22 |
| LA-12 | Rilis produk, panduan, video (umum) | General/*; Video | /panduan | ADA | - |
| LA-13 | Mekari University, Community, Event, Payroll Service | halaman umum | tidak relevan | LUAR | - |

## Ringkasan status

Dihitung oleh `alat/cek_cakupan.py --hitung` dari kolom Status (kata pertama). Tabel di atas berisi 134 baris, dan seluruh 545 bagian pusat bantuan tercakup.

| Status | Jumlah |
|---|---|
| ADA | 43 |
| SEBAGIAN | 68 |
| BELUM | 4 |
| MITRA | 17 |
| LUAR | 2 |

Sebagian baris MITRA punya bagian yang bisa dibangun sendiri tanpa mitra. Contohnya web chat dan Telegram di QO-01, serta berkas impor Coretax di KP-01. Bagian itu masuk tugas di rencana.md.
