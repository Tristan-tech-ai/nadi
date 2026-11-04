-- M-09B (docs/research/coretax-efaktur.md): pemotongan PPh atas pembayaran ke pemasok (Unifikasi: PPh 23, PPh 4 ayat (2), dll.),
-- berkas impor XML BpuBulk e-Bupot Unifikasi, rekap PPN keluaran per masa terhadap jurnal, dan kalender setor/lapor.
-- Kode objek pajak dan tarif: lembar REF templat resmi DJP "BPPU Excel to XML v.3.xlsx" (pajak.go.id, diunduh 5 Nov 2026).
-- Jatuh tempo: PMK 81/2024 Pasal 94 ayat (2) (setor PPh tanggal 15 bulan berikutnya), Pasal 94 ayat (3) huruf e (setor PPN akhir
-- bulan berikutnya, sebelum SPT Masa PPN), Pasal 171 ayat (1) (lapor SPT Masa PPh paling lama 20 hari setelah Masa Pajak), Pasal 171
-- ayat (13) (lapor SPT Masa PPN akhir bulan berikutnya), Pasal 100 dan 173 (hari libur: Sabtu, Minggu, libur nasional, cuti bersama
-- nasional digeser ke hari kerja berikutnya). Tes: supabase/tests/potong_pph.test.sql.

create table public.kode_objek_pajak (
  kode text primary key check (kode ~ '^[0-9]{2}-[0-9]{3}-[0-9]{2}$'),
  nama text not null,
  tarif numeric(6,2) not null check (tarif between 0 and 100),
  sumber text not null default 'DJP, BPPU Excel to XML v.3 lembar REF (pajak.go.id/en/node/112031), dibaca 5 Nov 2026'
);
alter table public.kode_objek_pajak enable row level security;
create policy kode_objek_pajak_baca on public.kode_objek_pajak for select to authenticated using (true);
grant select on public.kode_objek_pajak to authenticated;
insert into public.kode_objek_pajak (kode, nama, tarif) values
  ('24-101-01', 'Dividen', 15),
  ('24-104-05', 'Jasa Aktuaris', 2),
  ('28-409-25', 'Pekerjaan Konstruksi Terintegrasi yang Dilakukan oleh Penyedia Jasa yang Memiliki Sertifikat Badan Usaha', 2.65),
  ('28-409-26', 'Pekerjaan Konstruksi Terintegrasi yang Dilakukan oleh Penyedia Jasa yang Tidak Memiliki Sertifikat Badan Usaha', 4),
  ('28-409-27', 'Jasa Konsultansi Konstruksi yang Dilakukan oleh Penyedia Jasa yang Memiliki Sertifikat Badan Usaha atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan', 3.5),
  ('28-409-28', 'Jasa Konsultansi Konstruksi yang Dilakukan oleh Penyedia Jasa yang Tidak Memiliki Sertifikat Badan Usaha atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan', 6),
  ('24-104-06', 'Jasa Akuntansi, Pembukuan, dan Atestasi Laporan Keuangan', 2),
  ('28-417-01', 'Bunga Simpanan yang Dibayarkan oleh Koperasi kepada Anggota Wajib Pajak Orang Pribadi (bunga sampai dengan Rp240.000,00)', 0),
  ('28-417-02', 'Bunga Simpanan yang Dibayarkan oleh Koperasi kepada Anggota Wajib Pajak Orang Pribadi (bunga di atas Rp240.000,00)', 10),
  ('28-419-01', 'Dividen yang Diterima/Diperoleh Wajib Pajak Orang Pribadi Dalam Negeri', 10),
  ('28-423-01', 'Pemotongan atau pemungutan PPh atas penjualan barang atau penyerahan jasa yang dilakukan oleh Wajib Pajak dengan peredaran bruto tertentu sesuai dengan Peraturan Pemerintah Nomor 23 Tahun 2018 atau Peraturan Pemerintah Nomor 55 Tahun 2022.', 0.5),
  ('28-423-02', 'Pemotongan atau pemungutan PPh atas transaksi pembelian yang dilakukan oleh Wajib Pajak dengan peredaran bruto tertentu sesuai dengan Peraturan Pemerintah Nomor 55 Tahun 2022.', 0.5),
  ('28-410-02', 'Imbalan yang Dibayarkan/Terutang kepada Perusahaan Pelayaran Dalam Negeri', 1.2),
  ('28-411-02', 'Imbalan Charter Kapal Laut dan/atau Pesawat Udara yang Dibayarkan/ Terutang kepada Perusahaan Pelayaran dan/atau Penerbangan Luar Negeri  melalui BUT di Indonesia', 2.64),
  ('29-101-01', 'Imbalan Charter Pesawat Udara yang Dibayarkan/Terutang kepada Perusahaan Penerbangan Dalam Negeri oleh Pemotong Pajak', 1.8),
  ('28-421-01', 'Uplift Hulu Migas', 20),
  ('24-104-07', 'Jasa Hukum', 2),
  ('28-421-02', 'Participating Interest Eksplorasi Hulu Migas', 5),
  ('28-421-03', 'Participating Interest Eksploitasi Hulu Migas', 7),
  ('22-900-01', 'Pembayaran atas Pembelian Barang dan/atau Bahan untuk Kegiatan Usahanya oleh BUMN/Badan Usaha Tertentu', 1.5),
  ('22-100-07', 'Penjualan Hasil Produksi Kepada Distributor di Dalam Negeri oleh Badan Usaha/Industri Tertentu (Industri Semen)', 0.25),
  ('22-100-08', 'Penjualan Hasil Produksi Kepada Distributor di Dalam Negeri oleh Badan Usaha/Industri Tertentu (Industri Baja)', 0.3),
  ('24-104-08', 'Jasa Arsitektur', 2),
  ('22-100-09', 'Penjualan Hasil Produksi Kepada Distributor di Dalam Negeri oleh Badan Usaha/Industri Tertentu (Industri Otomotif)', 0.45),
  ('22-100-10', 'Penjualan Hasil Produksi Kepada Distributor di Dalam Negeri oleh Badan Usaha/Industri Tertentu (Industri Farmasi)', 0.3),
  ('22-100-11', 'Penjualan Hasil Produksi Kepada Distributor di Dalam Negeri oleh Badan Usaha/Industri Tertentu (industri Kertas)', 0.1),
  ('22-100-12', 'Penjualan Kendaraan Bermotor di Dalam Negeri oleh ATPM, APM dan Importir Umum Kendaraan Bermotor', 0.45),
  ('22-100-13', 'Pembelian oleh Badan Usaha Berupa Komoditas Tambang Batubara, Mineral Logam dan Mineral Bukan Logam dari Badan atau Orang Pribadi Pemegang IUP', 1.5),
  ('22-100-14', 'Penjualan Emas Batangan di Dalam Negeri oleh Badan Usaha', 0.45),
  ('22-100-15', 'Pembelian Bahan Hasil Kehutanan yang Belum Melalui Proses Industri Manufaktur, untuk Keperluan Industrinya/Ekspornya oleh Badan Usaha Industri/Eksportir', 0.25),
  ('22-100-16', 'Pembelian Bahan Hasil Perkebunan yang Belum Melalui Proses Industri Manufaktur, untuk Keperluan Industrinya/Ekspornya Oleh Badan Usaha Industri/Eksportir', 0.25),
  ('22-100-17', 'Pembelian Bahan Hasil Pertanian yang Belum Melalui Proses Industri Manufaktur, untuk Keperluan Industrinya/Ekspornya Oleh Badan Usaha Industri/Eksportir', 0.25),
  ('22-100-18', 'Pembelian Bahan Hasil Peternakan yang Belum Melalui Proses Industri Manufaktur, untuk Keperluan Industrinya/Ekspornya Oleh Badan Usaha Industri/Eksportir', 0.25),
  ('24-104-09', 'Jasa Perencanaan Kota dan Arsitektur Landscape', 2),
  ('22-100-19', 'Pembelian Bahan Hasil Perikanan yang Belum Melalui Proses Industri Manufaktur, untuk Keperluan Industrinya/Ekspornya Oleh Badan Usaha Industri/Eksportir', 0.25),
  ('22-401-01', 'Penjualan BBM oleh Pertamina atau Anak Perusahaan Pertamina Kepada SPBU (Final)', 0.25),
  ('22-100-20', 'Penjualan BBM oleh Pertamina atau Anak Perusahaan Pertamina Kepada Selain SPBU/Agen/Penyalur (Tidak Final)', 0.3),
  ('22-401-02', 'Penjualan BBM oleh Badan Usaha Selain Pertamina atau Anak Perusahaan Pertamina Kepada SPBU/Agen/Penyalur  (Final)', 0.3),
  ('22-100-21', 'Penjualan BBM oleh Badan Usaha Selain Pertamina atau Anak Perusahaan Pertamina Kepada Selain SPBU/Agen/Penyalur (Tidak Final)', 0.3),
  ('22-100-22', 'Penjualan Pelumas oleh Importir/Produsen', 0.3),
  ('22-100-23', 'Penjualan  Pulsa dan Kartu Perdana oleh Penyelenggara Distribusi Tingkat Kedua yang Merupakan Pemungut PPh Pasal 22', 0.5),
  ('22-100-24', 'Penjualan BBG oleh Produsen/Importir Kepada Selain SPBU/Agen/Penyalur (Tidak Final)', 0.3),
  ('22-401-03', 'Penjualan BBG oleh produsen/importir Kepada SPBU/Agen/Penyalur (Final)', 0.3),
  ('22-401-04', 'Penjualan BBM oleh Pertamina atau Anak Perusahaan Pertamina kepada Agen/Penyalur selain SPBU (Final)', 0.3),
  ('24-104-10', 'Jasa Perancang (Design)', 2),
  ('22-403-01', 'Penjualan Barang yang Tergolong Sangat Mewah Selain Rumah Beserta Tanahnya, Apartemen, Kondominium dan Sejenisnya', 5),
  ('22-403-02', 'Penjualan Barang yang Tergolong Sangat Mewah Untuk Rumah Beserta Tanahnya, Apartemen, Kondominium dan Sejenisnya', 1),
  ('22-404-01', 'Ekspor Komoditas Tambang Batubara, Mineral Logam, dan Mineral Bukan Logam yang Dilakukan Oleh Eksportir, Kecuali WP yang Terikat dalam PKP2B dan KK', 1.5),
  ('22-405-01', 'Penghasilan Sehubungan dengan Aset Kripto yang dipungut oleh Penyelenggara Perdagangan Melalui Sistem Elektronik yang Merupakan Pedagang Fisik Aset Kripto', 0.1),
  ('22-405-02', 'Penghasilan Sehubungan dengan Aset Kripto yang dipungut oleh Penyelenggara Perdagangan Melalui Sistem Elektronik yang Bukan Merupakan Pedagang Fisik Aset Kripto', 0.2),
  ('22-101-01', 'Penghasilan Sehubungan dengan Transaksi Penjualan Barang, Penyerahan Jasa, dan/atau Persewaan serta Penghasilan Lain Sehubungan dengan Penggunaan Harta yang Dilakukan Melalui Pihak Lain dalam Sistem Informasi Pengadaan Pemerintah (Tidak Final)', 0.5),
  ('22-101-02', 'Penghasilan Sehubungan dengan Transaksi Penjualan Barang, Penyerahan Jasa, dan/atau Persewaan serta Penghasilan Lain Sehubungan dengan Penggunaan Harta yang Dilakukan Melalui Pihak Lain dalam Sistem Informasi Pengadaan Pemerintah (Final)', 0.5),
  ('22-102-01', 'Penghasilan yang Diterima atau Diperoleh Pedagang Dalam Negeri Penjualan Barang, Penyerahan Jasa, dan/atau Persewaan serta Penghasilan Lain Sehubungan dengan Penggunaan Harta yang Dilakukan Melalui Perdagangan Melalui Sistem Elektronik (Tidak Final)', 0.5),
  ('22-102-02', 'Penghasilan yang Diterima atau Diperoleh Pedagang Dalam Negeri Atas Penjualan Barang, Penyerahan Jasa, dan/atau Persewaan serta Penghasilan Lain Sehubungan dengan Penggunaan Harta yang Dilakukan Melalui Perdagangan Melalui Sistem Elektronik (Final)', 0.5),
  ('22-100-25', 'Penjualan Emas Batangan di Dalam Negeri oleh Pengusaha Emas Perhiasan dan/atau Emas Batangan', 0.25),
  ('24-104-11', 'Jasa Pengeboran (Drilling) di Bidang Penambangan Minyak dan Gas Bumi (Migas) Kecuali yang Dilakukan oleh Badan Usaha Tetap (BUT)', 2),
  ('22-100-26', 'Penjualan Emas Perhiasan di Dalam Negeri oleh Pengusaha Emas Perhiasan dan/atau Emas Batangan', 0.25),
  ('22-100-27', 'Penjualan Perhiasan Selain dari Emas dan/atau Batu Permata dan/atau Batu Lainnya yang Sejenis oleh Pengusaha Emas Perhiasan dan/atau Emas Batangan', 0.25),
  ('28-499-02', 'Penghasilan yang Diterima atau Diperoleh Sehubungan dengan Kerja Sama dengan Lembaga Pengelola Investasi (LPI)', 7.5),
  ('28-402-01', 'Pengalihan Hak atas Tanah dan/atau Bangunan', 2.5),
  ('28-402-02', 'Pengalihan Rumah Sederhana dan Rumah Susun Sederhana yang Dilakukan oleh WP yang Usaha Pokoknya Mengalihkan Hak atas Tanah dan/atau Bangunan', 1),
  ('28-402-03', 'Pengalihan Hak atas Tanah dan/atau Bangunan kepada Pemerintah, BUMN yang Mendapat Penugasan Khusus dari Pemerintah, atau BUMD yang Mendapat Penugasan Khusus dari Kepala Daerah, sesuai UU mengenai Pengadaan Tanah bagi Pembangunan untuk Kepentingan Umum', 0),
  ('28-410-01', 'Imbalan yang Diterima/Diperoleh Sehubungan dengan Pengangkutan Orang dan/atau Barang Termasuk Penyewaan Kapal Laut Oleh Perusahaan Pelayaran Dalam Negeri', 1.2),
  ('28-411-01', 'Imbalan yang Dibayarkan/Terutang kepada Perusahaan Pelayaran dan/atau Penerbangan Luar Negeri Sehubungan dengan Pengangkutan Orang dan/atau Barang (Selain Berdasarkan Perjanjian Charter)', 2.64),
  ('28-413-01', 'Penghasilan Wajib Pajak Luar Negeri yang Mempunyai Kantor Perwakilan Dagang di Indonesia', 0.44),
  ('28-499-01', 'Penghasilan Wajib Pajak yang Melakukan Kegiatan Usaha Jasa Maklon (Contract Manufacturing) Internasional di Bidang Produksi Mainan Anak-Anak', 2.1),
  ('24-104-12', 'Jasa Penunjang di Bidang Usaha Panas Bumi dan Penambangan Minyak dan Gas Bumi (Migas)', 2),
  ('22-910-01', 'Pemungutan oleh Bendaharawan', 1.5),
  ('28-423-03', 'Pemotongan atau Pemungutan PPh atas transaksi penjualan barang atau penyerahan jasa yang dilakukan oleh Wajib Pajak orang pribadi yang memiliki peredaran bruto tertentu sesuai dengan PP 55 Tahun 2022 dengan peredaran usaha s.d Rp500.000.000,00.', 0.5),
  ('28-423-12', 'Pemotongan atau Pemungutan PPh atas transaksi penjualan barang atau penyerahan jasa yang dilakukan oleh Wajib Pajak yang memenuhi persyaratan tertentu untuk dikenai PPh yang bersifat final dengan tarif 0% di IKN (PPh UMKM di IKN).', 0),
  ('28-423-13', 'Pemotongan atau pemungutan PPh atas transaksi pembelian yang dilakukan oleh Wajib Pajak yang memanfaatkan fasilitas PPh final dengan tarif 0% di IKN (PPh UMKM di IKN).', 0),
  ('28-404-12', 'Penghasilan dari Instrumen Moneter dan/atau Instrumen Keuangan Tertentu di Indonesia (Mata Uang VALAS Bersumber dari DHE SDA Tenor Lebih Dari 6 Bulan)', 0),
  ('28-404-13', 'Penghasilan dari Instrumen Moneter dan/atau Instrumen Keuangan Tertentu di Indonesia (Mata Uang VALAS Bersumber dari DHE SDA Tenor 6 Bulan)', 2.5),
  ('28-404-14', 'Penghasilan dari Instrumen Moneter dan/atau Instrumen Keuangan Tertentu di Indonesia (Mata Uang VALAS Bersumber dari DHE SDA Tenor Lebih Dari 3 Bulan sampai dengan Kurang Dari 6 Bulan)', 7.5),
  ('28-404-15', 'Penghasilan dari Instrumen Moneter dan/atau Instrumen Keuangan Tertentu di Indonesia (Mata Uang VALAS Bersumber dari DHE SDA Tenor 1 Bulan sampai dengan Kurang Dari 3 Bulan)', 10),
  ('28-404-16', 'Penghasilan dari Instrumen Moneter dan/atau Instrumen Keuangan Tertentu di Indonesia (Mata Uang IDR Bersumber dari DHE SDA Tenor 6 Bulan atau Lebih Dari 6 Bulan)', 0),
  ('28-404-17', 'Penghasilan dari Instrumen Moneter dan/atau Instrumen Keuangan Tertentu di Indonesia (Mata Uang VALAS Bersumber dari DHE SDA Tenor 3 Bulan sampai dengan Kurang Dari 6 Bulan)', 2.5),
  ('24-104-13', 'Jasa Penambangan dan Jasa Penunjang Selain di Bidang Usaha Panas Bumi dan Penambangan Minyak dan Gas Bumi (Migas)', 2),
  ('22-406-01', 'PPh pasal 22 yang terutang atas penghasilan Kontraktor Utama sehubungan pelaksanaan proyek pemerintah yang dibiayai Hibah atau Pinjaman Luar Negeri', 0),
  ('24-106-01', 'PPh pasal 23 yang terutang atas penghasilan Kontraktor Utama sehubungan pelaksanaan proyek pemerintah yang dibiayai Hibah atau Pinjaman Luar Negeri', 0),
  ('28-403-04', 'Persewaan Tanah dan/atau Bangunan sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 10),
  ('28-409-43', 'Pekerjaan Konstruksi yang Dilakukan oleh Penyedia Jasa yang Memiliki Sertifikat Badan Usaha Kualifikasi Kecil atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 1.75),
  ('28-409-44', 'Pekerjaan Konstruksi yang Dilakukan oleh Penyedia Jasa yang Tidak Memiliki Sertifikat Badan Usaha Atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 4),
  ('28-409-45', 'Pekerjaan Konstruksi yang Dilakukan oleh Penyedia Jasa yang Memiliki Sertifikat Selain Sertifikat Badan Usaha Kualifikasi Kecil atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 2.65),
  ('28-409-46', 'Pekerjaan Konstruksi Terintegrasi yang Dilakukan oleh Penyedia Jasa yang Memiliki Sertifikat Badan Usaha sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 2.65),
  ('28-409-47', 'Pekerjaan Konstruksi Terintegrasi yang Dilakukan oleh Penyedia Jasa yang Tidak Memiliki Sertifikat Badan Usaha sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 4),
  ('28-409-48', 'Jasa Konsultansi Konstruksi yang Dilakukan oleh Penyedia Jasa yang Memiliki Sertifikat Badan Usaha atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 3.5),
  ('28-409-49', 'Jasa Konsultansi Konstruksi yang Dilakukan oleh Penyedia Jasa yang Tidak Memiliki Sertifikat Badan Usaha atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 6),
  ('24-104-14', 'Jasa Penunjang di Bidang Penerbangan dan Bandar Udara', 2),
  ('28-409-50', 'Jasa Konstruksi Berupa Jasa Perencanaan Konstruksi (Dengan Kualifikasi Usaha) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 4),
  ('28-409-51', 'Jasa Konstruksi Berupa Jasa Perencanaan Konstruksi (Tanpa Kualifikasi Usaha) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 6),
  ('28-409-52', 'Jasa Konstruksi Berupa Jasa Pelaksanaan Konstruksi (Kualifikasi Usaha Kecil) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 2),
  ('28-409-53', 'Jasa Konstruksi Berupa Jasa Pelaksanaan Konstruksi (Kualifikasi Usaha Menengah dan Besar) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 3),
  ('28-409-54', 'Jasa Konstruksi Berupa Jasa Pelaksanaan Konstruksi (Tanpa Kualifikasi Usaha) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 4),
  ('28-409-55', 'Jasa Konstruksi Berupa Jasa Pengawasan Konstruksi (Dengan Kualifikasi Usaha) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 4),
  ('28-409-56', 'Jasa Konstruksi Berupa Jasa Pengawasan Konstruksi (Tanpa Kualifikasi Usaha) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 6),
  ('28-402-04', 'Pengalihan Hak atas Tanah dan/atau Bangunan sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 2.5),
  ('28-410-06', 'Imbalan yang Dibayarkan/Terutang kepada Perusahaan Pelayaran Dalam Negeri sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 1.2),
  ('28-411-05', 'Imbalan Charter Kapal Laut dan/atau Pesawat Udara yang Dibayarkan/ Terutang kepada Perusahaan Pelayaran dan/atau Penerbangan Luar Negeri melalui BUT di Indonesia sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 2.64),
  ('24-102-01', 'Bunga Selain yang Dikenakan PPh Pasal 4 ayat (2)', 15),
  ('24-104-15', 'Jasa Penebangan Hutan', 2),
  ('29-101-02', 'Imbalan Charter Pesawat Udara yang Dibayarkan/Terutang kepada Perusahaan Penerbangan Dalam Negeri oleh Pemotong Pajak sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 1.8),
  ('28-410-05', 'Imbalan yang Diterima/Diperoleh Sehubungan dengan Pengangkutan Orang dan/atau Barang Termasuk Penyewaan Kapal Laut Oleh Perusahaan Pelayaran Dalam Negeri sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 1.2),
  ('28-411-04', 'Imbalan yang Dibayarkan/Terutang kepada Perusahaan Pelayaran dan/atau Penerbangan Luar Negeri Sehubungan dengan Pengangkutan Orang dan/atau Barang (Selain Berdasarkan Perjanjian Charter) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 2.64),
  ('22-401-05', 'Penjualan BBM oleh Badan Usaha Selain Pertamina atau Anak Perusahaan Pertamina Kepada SPBU/Agen/Penyalur  (Final) sehubungan Pelaksanaan Proyek Pemerintah yang Dibiayai dengan Hibah atau Dana Pinjaman Luar Negeri', 0.3),
  ('28-423-14', 'Pemotongan atau pemungutan PPh atas penjualan barang atau penyerahan jasa yang dilakukan oleh Wajib Pajak dengan peredaran bruto tertentu yang memperoleh penghasilan sehubungan pelaksanaan proyek pemerintah yang dibiayai Hibah atau Pinjaman Luar Negeri', 0.5),
  ('28-423-15', 'Pemotongan atau Pemungutan PPh atas transaksi penjualan barang atau penyerahan jasa yang dilakukan oleh Wajib Pajak yang memenuhi persyaratan tertentu untuk dikenai PPh yang bersifat final dengan tarif 0% di IKN yang memperoleh penghasilan sehubungan pelaksanaan proyek pemerintah yang dibiayai Hibah atau Pinjaman Luar Negeri', 0),
  ('24-103-02', 'Royalti yang diterima atau diperoleh Wajib Pajak orang pribadi dalam negeri yang menerapkan penghitungan Pajak Penghasilan menggunakan Norma Penghitungan Penghasilan Neto', 6),
  ('28-404-18', 'Penghasilan dari instrumen moneter dan/atau instrumen keuangan tertentu di Indonesia (mata uang IDR bersumber dari DHE SDA tenor 1 bulan sampai dengan kurang dari 3 bulan)', 5),
  ('22-405-04', 'Penghasilan Sehubungan dengan Aset Kripto yang dipungut oleh Penyelenggara Perdagangan Melalui Sistem Elektronik Dalam Negeri yang Merupakan Pedagang Aset Keuangan Digital', 0.21),
  ('22-405-05', 'Penghasilan Sehubungan dengan Aset Kripto yang dipungut oleh Penyelenggara Perdagangan Melalui Sistem Elektronik Luar Negeri yang Merupakan Pemungut Pajak Penghasilan', 1),
  ('24-104-16', 'Jasa Pengolahan Limbah', 2),
  ('22-100-28', 'Pembelian emas batangan oleh Lembaga Jasa Keuangan penyelenggara Kegiatan Usaha Bulion', 0.25),
  ('24-104-17', 'Jasa Penyedia Tenaga Kerja dan/atau Tenaga Ahli (Outsourcing Services)', 2),
  ('24-104-18', 'Jasa Perantara dan/atau Keagenan', 2),
  ('24-104-19', 'Jasa Bidang Perdagangan Surat-Surat Berharga, Kecuali yang Dilakukan Bursa Efek, Kustodian Sentral Efek Indonesia (KSEI) dan Kliring Penjaminan Efek Indonesia (KPEI)', 2),
  ('24-104-20', 'Jasa Kustodian/Penyimpanan/Penitipan, Kecuali yang Dilakukan Oleh KSEI', 2),
  ('24-104-21', 'Jasa Pengisian Suara (Dubbing) dan/atau Sulih Suara', 2),
  ('24-104-22', 'Jasa Mixing Film', 2),
  ('24-104-23', 'Jasa Pembuatan Sarana Promosi Film, Iklan, Poster, Foto, Slide, Klise, Banner, Pamphlet, Baliho dan Folder', 2),
  ('24-104-24', 'Jasa Sehubungan Dengan Software Atau Hardware Atau Sistem Komputer, Termasuk Perawatan, Pemeliharaan dan Perbaikan.', 2),
  ('24-103-01', 'Royalti', 15),
  ('24-104-25', 'Jasa Pembuatan dan/atau Pengelolaan Website', 2),
  ('24-104-26', 'Jasa Internet Termasuk Sambungannya', 2),
  ('24-104-27', 'Jasa Penyimpanan, Pengolahan dan/atau Penyaluran Data, Informasi, dan/atau Program', 2),
  ('24-104-28', 'Jasa Instalasi/Pemasangan Mesin, Peralatan, Listrik, Telepon, Air, Gas, Ac dan/atau Tv Kabel, Selain Yang Dilakukan Oleh Wajib Pajak Yang Ruang Lingkupnya Di Bidang Konstruksi dan Mempunyai Izin dan/atau Sertifikasi Sebagai Pengusaha Konstruksi', 2),
  ('24-104-29', 'Jasa Perawatan/Perbaikan/Pemeliharaan Mesin, Peralatan, Listrik, Telepon, Air, Gas, Ac dan/atau Tv Kabel, Selain Yang Dilakukan Oleh Wajib Pajak Yang Ruang Lingkupnya di Bidang Konstruksi dan Mempunyai Izin dan/atau Sertifikasi Sebagai Pengusaha Konstruksi', 2),
  ('24-104-30', 'Jasa Perawatan Kendaraan dan/atau Alat Transportasi Darat, Laut dan Udara', 2),
  ('24-104-31', 'Jasa Maklon', 2),
  ('24-104-32', 'Jasa Penyelidikan dan Keamanan', 2),
  ('24-104-33', 'Jasa Penyelenggara Kegiatan Atau Event Organizer', 2),
  ('24-104-34', 'Jasa Penyediaan Tempat dan/atau Waktu Dalam Media Massa, Media Luar Ruang Atau Media Lain Untuk Penyampaian Informasi, dan/atau Jasa Periklanan', 2),
  ('24-100-01', 'Hadiah, Penghargaan, Bonus dan Lainnya Selain yang Telah Dipotong PPh Pasal 21 Ayat (1) Huruf E UU PPh', 15),
  ('24-104-35', 'Jasa Pembasmian Hama', 2),
  ('24-104-36', 'Jasa Kebersihan Atau Cleaning Service', 2),
  ('24-104-37', 'Jasa Sedot Septic Tank', 2),
  ('24-104-38', 'Jasa Pemeliharaan Kolam', 2),
  ('24-104-39', 'Jasa Katering Atau Tata Boga', 2),
  ('24-104-40', 'Jasa Freight Forwarding', 2),
  ('24-104-41', 'Jasa Logistik', 2),
  ('24-104-42', 'Jasa Pengurusan Dokumen', 2),
  ('24-104-43', 'Jasa Pengepakan', 2),
  ('24-104-44', 'Jasa Loading dan Unloading', 2),
  ('24-100-02', 'Sewa dan Penghasilan Lain Sehubungan Dengan Penggunaan Harta Kecuali Sewa Tanah dan/atau Bangunan yang Telah Dikenai PPh Pasal 4 Ayat (2) UU PPh.', 2),
  ('24-104-45', 'Jasa Laboratorium dan/atau Pengujian Kecuali yang Dilakukan oleh Lembaga atau Institusi Pendidikan Dalam Rangka Penelitian Akademis', 2),
  ('24-104-46', 'Jasa Pengelolaan Parkir', 2),
  ('24-104-47', 'Jasa Penyondiran Tanah', 2),
  ('24-104-48', 'Jasa Penyiapan dan/atau Pengolahan Lahan', 2),
  ('24-104-49', 'Jasa Pembibitan dan/atau Penanaman Bibit', 2),
  ('24-104-50', 'Jasa Pemeliharaan Tanaman', 2),
  ('24-104-51', 'Jasa Pemanenan', 2),
  ('24-104-52', 'Jasa Pengolahan Hasil Pertanian, Perkebunan, Perikanan, Peternakan dan/atau Perhutanan', 2),
  ('24-104-53', 'Jasa Dekorasi', 2),
  ('24-104-54', 'Jasa Pencetakan/Penerbitan', 2),
  ('24-104-01', 'Jasa Teknik', 2),
  ('24-104-55', 'Jasa Penerjemahan', 2),
  ('24-104-56', 'Jasa Pengangkutan/Ekspedisi Kecuali Yang Telah Diatur Dalam Pasal 15 Undang-Undang Pajak Penghasilan', 2),
  ('24-104-57', 'Jasa Pelayanan Pelabuhan', 2),
  ('24-104-58', 'Jasa Pengangkutan Melalui Jalur Pipa', 2),
  ('24-104-59', 'Jasa Pengelolaan Penitipan Anak', 2),
  ('24-104-60', 'Jasa Pelatihan dan/atau Kursus', 2),
  ('24-104-61', 'Jasa Pengiriman dan Pengisian Uang Ke Atm', 2),
  ('24-104-62', 'Jasa Sertifikasi', 2),
  ('24-104-63', 'Jasa Survey', 2),
  ('24-104-64', 'Jasa Tester', 2),
  ('24-104-02', 'Jasa Manajemen', 2),
  ('24-104-65', 'Jasa Selain Jasa-Jasa Tersebut di Atas yang Pembayarannya Dibebankan pada APBN (Anggaran Pendapatan dan Belanja Negara) Atau APBD (Anggaran Pendapatan dan Belanja Daerah).', 2),
  ('24-104-66', 'Jasa Penyelenggaraan Layanan Transaksi Pembayaran Terkait dengan Distribusi Token Oleh Penyelenggara Distribusi', 2),
  ('24-104-67', 'Jasa Pemasaran dengan Media Voucer Oleh Penyelenggara Voucer', 2),
  ('24-104-68', 'Jasa Penyelenggaraan Layanan Transaksi Pembayaran Terkait dengan Distribusi Voucer Oleh Penyelenggara Voucer dan Penyelenggara  Distribusi', 2),
  ('24-104-69', 'Jasa Penyelenggaraan Program Loyalitas dan Penghargaan Pelanggan (Consumer Loyalty/Reward Program)  Oleh Penyelenggara Voucer', 2),
  ('24-105-01', 'Bunga Pinjaman yang Diterima  Wajib Pajak Dalam Negeri dan Bentuk Usaha Tetap Melalui Layanan Pinjam Meminjam Uang Berbasis Teknologi Informasi', 15),
  ('28-404-01', 'Bunga Tabungan dan Bunga Deposito yang Ditempatkan di Dalam Negeri yang Dananya Bersumber Selain dari Devisa Hasil Ekspor (DHE)', 20),
  ('28-404-02', 'Bunga Deposito yang Ditempatkan di Dalam Negeri (mata uang IDR bersumber dari DHE tenor 1 bulan)', 7.5),
  ('28-404-03', 'Bunga Deposito yang Ditempatkan di Dalam Negeri (mata uang IDR bersumber dari DHE tenor 3 bulan)', 5),
  ('28-404-04', 'Bunga Deposito yang Ditempatkan di Dalam Negeri (mata uang IDR bersumber dari DHE tenor 6 bulan atau lebih)', 0),
  ('24-104-03', 'Jasa Konsultan', 2),
  ('28-404-05', 'Bunga Deposito yang Ditempatkan di Dalam Negeri (mata uang USD bersumber dari DHE tenor 1 bulan)', 10),
  ('28-404-06', 'Bunga Deposito yang Ditempatkan di Dalam Negeri (mata uang USD bersumber dari DHE tenor 3 bulan)', 7.5),
  ('28-404-07', 'Bunga Deposito yang Ditempatkan di Dalam Negeri (mata uang USD bersumber dari DHE tenor 6 bulan)', 2.5),
  ('28-404-08', 'Bunga Deposito yang Ditempatkan di Dalam Negeri (mata uang USD bersumber dari DHE tenor lebih 6 bulan)', 0),
  ('28-404-09', 'Bunga Deposito/Tabungan yang Ditempatkan di Luar Negeri Melalui Bank yang Didirikan atau Bertempat Kedudukan di Indonesia atau Cabang Bank Luar Negeri di Indonesia', 20),
  ('28-404-10', 'Diskonto Sertifikat Bank Indonesia', 20),
  ('28-404-11', 'Jasa Giro', 20),
  ('28-401-01', 'Bunga Obligasi, Surat Utang Negara, atau Obligasi Daerah yang Diterima Wajib Pajak Dalam Negeri dan Bentuk Usaha Tetap.', 15),
  ('28-401-06', 'Bunga Obligasi yang Diterima Wajib Pajak Dalam Negeri dan Bentuk Usaha Tetap', 10),
  ('28-401-03', 'Bunga Obligasi yang Diterima Wajib Pajak Dalam Negeri dan Bentuk Usaha Tetap yang diadministrasikan oleh BI', 10),
  ('24-104-04', 'Jasa Penilai (Appraisal)', 2),
  ('28-401-04', 'Diskonto Surat Perbendaharaan Negara yang Diterima Wajib Pajak Dalam Negeri dan Bentuk Usaha Tetap', 20),
  ('28-401-05', 'Diskonto Surat Perbendaharaan Negara yang Diterima Wajib Pajak Penduduk/Berkedudukan di Luar Negeri', 20),
  ('28-407-01', 'Transaksi Penjualan Saham di Bursa Efek (Saham Pendiri)', 0.5),
  ('28-406-01', 'Transaksi Penjualan Saham di Bursa Efek (Bukan Saham Pendiri)', 0.1),
  ('28-408-01', 'Transaksi Penjualan Saham Milik Perusahaan Modal Ventura Tidak di Bursa Efek', 0.1),
  ('28-403-02', 'Persewaan Tanah dan/atau Bangunan', 10),
  ('28-405-01', 'Hadiah Undian', 25),
  ('28-409-22', 'Pekerjaan Konstruksi yang Dilakukan oleh Penyedia Jasa yang Memiliki Sertifikat Badan Usaha Kualifikasi Kecil atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan', 1.75),
  ('28-409-23', 'Pekerjaan Konstruksi yang Dilakukan oleh Penyedia Jasa yang Tidak Memiliki Sertifikat Badan Usaha Atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan', 4),
  ('28-409-24', 'Pekerjaan Konstruksi yang Dilakukan oleh Penyedia Jasa yang Memiliki Sertifikat Selain Sertifikat Badan Usaha Kualifikasi Kecil atau Sertifikat Kompetensi Kerja untuk Usaha Orang Perseorangan', 2.65);

create table public.potong_pph (
  id uuid primary key default app.uuid7(),
  perusahaan_id uuid not null references public.perusahaan(id) on delete cascade,
  tagihan_id uuid not null,
  pemasok text not null,
  npwp_penerima text not null check (npwp_penerima ~ '^[0-9]{16}$'),
  nitku_penerima text not null check (nitku_penerima ~ '^[0-9]{22}$'),
  kode_objek text not null references public.kode_objek_pajak(kode),
  dpp bigint not null check (dpp > 0),
  tarif numeric(6,2) not null,
  pph bigint not null check (pph >= 0),
  dokumen text not null check (dokumen in ('CommercialInvoice', 'TaxInvoice', 'Contract', 'PaymentProof', 'Other')),
  nomor_dokumen text not null check (length(btrim(nomor_dokumen)) between 1 and 60),
  tanggal_dokumen date not null,
  tanggal_potong date not null,
  masa date not null check (extract(day from masa) = 1),
  jurnal_id uuid,
  kunci_klien uuid not null,
  dibuat_oleh uuid,
  dibuat_at timestamptz not null default now(),
  unique (perusahaan_id, kunci_klien),
  foreign key (perusahaan_id, tagihan_id) references public.tagihan_beli (perusahaan_id, id)
);
create index on public.potong_pph (perusahaan_id, masa);
alter table public.potong_pph enable row level security;
create policy potong_pph_baca on public.potong_pph for select to authenticated
  using (perusahaan_id = (select app.pid()) and (select app.peran_aktif()) in ('pemilik', 'admin', 'akuntan'));
grant select on public.potong_pph to authenticated;
create trigger audit_potong_pph after insert or update or delete on public.potong_pph for each row execute function app.catat_audit();

-- Potong PPh atas tagihan pemasok: hutang ke pemasok berkurang sebesar PPh (dikurangi), PPh menjadi utang pajak 2-210 yang
-- disetor pemilik sendiri lewat Coretax. Sisa tagihan dibayar lewat bayar_tagihan_beli seperti biasa.
create or replace function public.potong_pph_tagihan(p_tagihan uuid, p_kode text, p_dpp bigint, p_npwp text, p_nitku text, p_dokumen text,
  p_nomor text, p_tgl_dokumen date, p_tgl_potong date, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_beli(); t public.tagihan_beli; k public.kode_objek_pajak; r public.potong_pph; v_pph bigint; v_tgl date;
  v_npwp text := regexp_replace(coalesce(p_npwp, ''), '[^0-9]', '', 'g'); v_nitku text := regexp_replace(coalesce(p_nitku, ''), '[^0-9]', '', 'g'); v_jurnal jsonb;
begin
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into r from public.potong_pph where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', r.id, 'pph', r.pph, 'sudah', true); end if;
  select * into t from public.tagihan_beli where id = p_tagihan and perusahaan_id = v_pid for update;
  if not found then raise exception 'Tagihan tidak ditemukan' using errcode = 'P0002'; end if;
  if t.status <> 'terbuka' then raise exception 'Potongan hanya untuk tagihan yang belum lunas' using errcode = '22023'; end if;
  select * into k from public.kode_objek_pajak where kode = btrim(coalesce(p_kode, ''));
  if not found then raise exception 'Kode objek pajak tidak ada di referensi DJP' using errcode = '22023'; end if;
  if v_npwp !~ '^[0-9]{16}$' then raise exception 'NPWP/NIK pemasok harus 16 angka' using errcode = '22023'; end if;
  if v_nitku = '' then v_nitku := v_npwp || '000000'; end if;
  if v_nitku !~ '^[0-9]{22}$' or left(v_nitku, 16) <> v_npwp then raise exception 'NITKU pemasok 22 angka diawali NPWP-nya' using errcode = '22023'; end if;
  if p_dpp is null or p_dpp <= 0 or p_dpp > t.total then raise exception 'DPP 1 sampai nilai tagihan (Rp%)', t.total using errcode = '22023'; end if;
  v_pph := round(p_dpp * k.tarif / 100)::bigint;
  if v_pph > t.total - t.terbayar - t.dikurangi then raise exception 'PPh melebihi sisa tagihan' using errcode = '22023'; end if;
  v_tgl := coalesce(p_tgl_potong, app.hari_ini(v_pid));
  if v_tgl > app.hari_ini(v_pid) then raise exception 'Tanggal potong tidak boleh di masa depan' using errcode = '22023'; end if;
  if p_tgl_dokumen is null or p_tgl_dokumen > v_tgl then raise exception 'Tanggal dokumen wajib dan tidak setelah tanggal potong' using errcode = '22023'; end if;
  perform app.akun_pastikan(v_pid, '2-210', 'Utang PPh dipotong (Unifikasi)', 'kewajiban', 'kredit');
  if v_pph > 0 then
    v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_tgl, 'keterangan', left('Potong PPh ' || k.kode || ' ' || t.pemasok, 200),
      'sumber', 'pajak', 'sumber_id', t.id::text, 'kunci_idempoten', 'potong-pph:' || p_kunci),
      jsonb_build_array(jsonb_build_object('akun', '2-100', 'debit', v_pph), jsonb_build_object('akun', '2-210', 'kredit', v_pph)), auth.uid());
  end if;
  insert into public.potong_pph (perusahaan_id, tagihan_id, pemasok, npwp_penerima, nitku_penerima, kode_objek, dpp, tarif, pph, dokumen, nomor_dokumen,
    tanggal_dokumen, tanggal_potong, masa, jurnal_id, kunci_klien, dibuat_oleh)
  values (v_pid, t.id, t.pemasok, v_npwp, v_nitku, k.kode, p_dpp, k.tarif, v_pph, coalesce(p_dokumen, 'CommercialInvoice'), btrim(coalesce(p_nomor, '')), p_tgl_dokumen, v_tgl,
    date_trunc('month', v_tgl)::date, (v_jurnal ->> 'id')::uuid, p_kunci, auth.uid()) returning * into r;
  update public.tagihan_beli set dikurangi = dikurangi + v_pph,
    status = case when terbayar + dikurangi + v_pph >= total then 'lunas' else status end where id = t.id;
  return jsonb_build_object('id', r.id, 'pph', v_pph, 'tarif', k.tarif, 'sudah', false);
exception when check_violation then
  raise exception 'Data potongan belum benar: jenis dokumen dan nomor dokumen wajib diisi.' using errcode = '22023';
end $$;

-- Bukti potong satu masa untuk berkas BpuBulk.
create or replace function public.data_bupot(p_bulan date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengurus_pajak();
begin
  return jsonb_build_object(
    'identitas', (select jsonb_build_object('npwp', i.npwp, 'nitku', i.nitku) from public.identitas_pajak i where i.perusahaan_id = v_pid),
    'potong', coalesce((select jsonb_agg(jsonb_build_object('pemasok', p.pemasok, 'npwp', p.npwp_penerima, 'nitku', p.nitku_penerima, 'kode', p.kode_objek,
        'dpp', p.dpp, 'tarif', p.tarif, 'pph', p.pph, 'dokumen', p.dokumen, 'nomor', p.nomor_dokumen, 'tanggal_dokumen', p.tanggal_dokumen,
        'tanggal_potong', p.tanggal_potong, 'masa', p.masa) order by p.tanggal_potong, p.id)
      from public.potong_pph p where p.perusahaan_id = v_pid and p.masa = date_trunc('month', p_bulan)::date), '[]'::jsonb));
end $$;

-- Hari kerja pertama pada atau setelah tanggal (Sabtu, Minggu, libur nasional, cuti bersama digeser; PMK 81/2024 Pasal 100, 173).
create or replace function app.hari_kerja_pajak(p_tgl date) returns date
language plpgsql stable security definer set search_path = '' as $$
declare d date := p_tgl;
begin
  while extract(isodow from d) in (6, 7) or exists (select 1 from public.libur_nasional l where l.tanggal = d) loop
    d := d + 1;
  end loop;
  return d;
end $$;
revoke all on function app.hari_kerja_pajak(date) from public, anon, authenticated;

-- Kalender pajak satu masa: jatuh tempo menurut PMK 81/2024 dan jumlah PPh potong yang harus disetor; PPN dihitung di aplikasi
-- dari faktur keluaran. Penjelasan (dasar) selalu menyebut pasal.
create or replace function public.kalender_pajak(p_bulan date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengurus_pajak(); v_masa date := date_trunc('month', p_bulan)::date; v_berikut date := (v_masa + interval '1 month')::date;
  v_akhir date := (v_masa + interval '2 month' - interval '1 day')::date;
begin
  return jsonb_build_object('masa', v_masa, 'pph_potong', coalesce((select sum(pph) from public.potong_pph where perusahaan_id = v_pid and masa = v_masa), 0),
    'jatuh_tempo', jsonb_build_array(
      jsonb_build_object('jenis', 'setor_pph', 'tanggal', app.hari_kerja_pajak(v_berikut + 14), 'asli', v_berikut + 14, 'dasar', 'PMK 81/2024 Pasal 94 ayat (2) dan Pasal 100'),
      jsonb_build_object('jenis', 'lapor_pph', 'tanggal', app.hari_kerja_pajak(v_berikut + 19), 'asli', v_berikut + 19, 'dasar', 'PMK 81/2024 Pasal 171 ayat (1) dan Pasal 173'),
      jsonb_build_object('jenis', 'setor_ppn', 'tanggal', app.hari_kerja_pajak(v_akhir), 'asli', v_akhir, 'dasar', 'PMK 81/2024 Pasal 94 ayat (3) huruf e dan Pasal 100'),
      jsonb_build_object('jenis', 'lapor_ppn', 'tanggal', app.hari_kerja_pajak(v_akhir), 'asli', v_akhir, 'dasar', 'PMK 81/2024 Pasal 171 ayat (13) dan Pasal 173')));
end $$;

-- Rekap PPN keluaran: total invoice bulan itu dan kredit 4-100 di jurnal terbitnya, untuk dicocokkan dengan DPP + PPN faktur.
create or replace function public.rekap_jurnal_penjualan(p_bulan date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_pid uuid := app.wajib_pengurus_pajak(); v_awal date := date_trunc('month', p_bulan)::date;
begin
  return (select jsonb_build_object('invoice', count(*), 'total_invoice', coalesce(sum(v.total), 0),
      'kredit_penjualan', coalesce((select sum(b.kredit) from public.jurnal_baris b join public.akun a on a.id = b.akun_id
        where b.perusahaan_id = v_pid and a.kode = '4-100' and b.jurnal_id in (select v2.jurnal_terbit from public.invoice v2 where v2.perusahaan_id = v_pid
          and v2.status <> 'batal' and v2.tanggal >= v_awal and v2.tanggal < (v_awal + interval '1 month')::date)), 0))
    from public.invoice v where v.perusahaan_id = v_pid and v.status <> 'batal' and v.tanggal >= v_awal and v.tanggal < (v_awal + interval '1 month')::date);
end $$;

revoke all on function public.potong_pph_tagihan(uuid, text, bigint, text, text, text, text, date, date, uuid), public.data_bupot(date),
  public.kalender_pajak(date), public.rekap_jurnal_penjualan(date) from public, anon;
grant execute on function public.potong_pph_tagihan(uuid, text, bigint, text, text, text, text, date, date, uuid), public.data_bupot(date),
  public.kalender_pajak(date), public.rekap_jurnal_penjualan(date) to authenticated;
