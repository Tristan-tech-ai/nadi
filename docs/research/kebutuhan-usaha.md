# Peta kebutuhan per jenis usaha (W-07)

Ditulis 6 Nov 2026. Tujuannya menentukan modul Nadi berikutnya dari pekerjaan harian usaha yang nyata, bukan dari daftar fitur pesaing.

## 1. Bukti yang dipakai, dan yang tidak

**Dipakai.**
- **BPS, Sensus Ekonomi 2016, hasil pendaftaran (listing) usaha/perusahaan, Berita Resmi Statistik No. 50/04/Th. XX, 27 April 2017.** Ini sensus usaha nonpertanian terakhir yang hasilnya terbit lengkap.
  - Halaman tabel se2016.bps.go.id memakai halaman verifikasi peramban dan tidak dibuka paksa.
  - Angka di bawah dikutip dari ringkasan resmi yang terindeks mesin pencari (dibaca 6 Nov 2026):
    - total 26,71 juta usaha nonpertanian, 26,26 juta (98,33%) di antaranya usaha mikro dan kecil;
    - perdagangan besar dan eceran (kategori G) 12,33 juta (46,17%);
    - penyediaan akomodasi dan makan minum (I) 4.466.222 (16,72%);
    - industri pengolahan (C) 4.416.289 (sekitar 16,5%; dua kutipan BPS berbeda 16,53% dan 16,66%).
  - Kategori lain (S jasa lainnya, H transportasi, P pendidikan, Q kesehatan, F konstruksi, L real estat) **belum terverifikasi**: angkanya tidak bisa dibaca dari sumber resmi hari ini.
- **Halaman solusi majoo (majoo.id/solusi, dibaca 6 Nov 2026).** Pesaing UMKM terbesar ini menjual solusi per jenis usaha:
  - makan minum (restoran, kafe, katering, produksi roti);
  - kecantikan (salon, barbershop, klinik kecantikan, spa);
  - penginapan (hotel, guesthouse, vila);
  - otomotif (bengkel, cuci mobil);
  - ritel (kelontong, minimarket, bahan bangunan, fesyen);
  - grosir dan distributor;
  - manufaktur;
  - kontraktor dan jasa proyek;
  - konsultan B2B.

  Bahwa sebuah vendor membuat paket untuk jenis usaha itu adalah bukti pasar membayar untuk pekerjaan tersebut.
- **Studi kasus majoo KANAKA Barbershop (2020).** Komisi karyawan per layanan atau produk, absen foto wajah, dan jam ramai untuk mengatur shift. Studi kasus vendor, jadi hanya dipakai sebagai bukti bahwa kebutuhan itu disebut pelanggan.
- **Inventaris Mekari di repo (docs/research/mekari/fitur.md, 134 kemampuan).**

**Tidak dipakai sebagai bukti.**
- Wawancara sintetis atau persona karangan.
- Angka adopsi atau kepuasan dari blog vendor.

**Catatan.** Klinik dan apotek diatur ketat. Rekam medis elektronik diatur Permenkes tentang Rekam Medis (Nomor 24 Tahun 2022, **belum diverifikasi ke teks resmi**), dan penjualan obat keras butuh apoteker. Nadi tidak membuat rekam medis.

## 2. Sepuluh jenis usaha dan satu hari kerjanya

Hari kerja disusun dari pekerjaan yang dijual pesaing untuk jenis itu, bukan dari wawancara. Pilihan jenis mengikuti tiga kategori terbesar BPS (G, I, C, total sekitar 79% usaha) ditambah jasa yang dijual sebagai paket oleh pesaing.

| # | Jenis usaha (KBLI) | Hari kerja (pagi, siang, tutup) | Modul Nadi yang terpakai | Yang kosong |
|---|---|---|---|---|
| 1 | Warung/toko kelontong (G 47) | Pagi: terima barang pemasok, cocokkan nota. Siang: jual tunai/QRIS, catat utang pelanggan. Tutup: hitung laci, cek barang habis | Kasir luring + QRIS, Lempar nota, stok + batas pesan ulang, kas | Utang pelanggan kecil per nama di kasir (bon) |
| 2 | Grosir/distributor (G 46) | Pagi: pesanan dari sales/WA. Siang: surat jalan, kirim. Sore: tagih piutang jatuh tempo | Penjualan PNW>SO>SJ>invoice, harga grosir bertingkat, pembelian PO, piutang | (cukup) |
| 3 | Restoran/kafe (I 56) | Pagi: siapkan bahan. Siang: layani meja, antrean. Malam: tutup shift, rekap | Kasir, Mata meja/antrean, jadwal shift, produksi resep | Pesanan per meja di kasir |
| 4 | Katering/roti (C 10) | Pagi: produksi sesuai pesanan. Siang: antar. Sore: belanja bahan esok | Produksi BoM + biaya aktual, pesanan penjualan, pembelian | (cukup) |
| 5 | Konveksi/penjahit (C 14) | Terima pesanan + ukuran, potong/jahit per tahap, serah pesanan | Produksi, invoice uang muka | **Order titipan dengan tahap dan janji selesai** |
| 6 | Bengkel motor/mobil (G 45) | Terima kendaraan (nopol, keluhan), kerjakan, pakai suku cadang, tagih, komisi mekanik | Stok suku cadang, invoice | **Order servis per kendaraan** + **komisi per jasa** |
| 7 | Salon/barbershop/spa (S 96) | Janji temu, layani, jual produk, bagi komisi terapis | Janji temu tanpa bentrok, kasir, poin | **Komisi per layanan ke slip gaji** |
| 8 | Laundry (S 96) | Terima cucian (kg/potong), status cuci-setrika, ambil + bayar | Kasir | **Order titipan: tiket, status, siap diambil** |
| 9 | Kos/guesthouse (I 55, L 68) | Tagih sewa bulanan, catat penghuni, perbaikan kamar | Invoice + QRIS, aset | **Tagihan berulang otomatis per penghuni** |
| 10 | Kursus/bimbel (P 85) | Jadwal kelas, presensi siswa, tagih SPP bulanan | Jadwal, invoice | **Tagihan berulang (SPP)**; presensi siswa cukup lewat jadwal |
| + | Kontraktor/agensi (F 41-43, M 70-74) | RAB per proyek, belanja per proyek, termin tagihan, jam kerja tim | Tag proyek di jurnal, penawaran, invoice termin persen | **Anggaran per proyek vs realisasi + jam kerja per proyek** |

## 3. Urutan modul baru

Urutan diambil dari banyaknya jenis usaha yang terbantu, lalu besarnya kategori BPS, lalu biaya bangun. Setiap modul tetap mengikuti pola Nadi: masuk lewat layar atau Lempar, menjadi usulan bila menyangkut uang, dan disetujui pemilik.

| Urut | Modul | Jenis terbantu | Alasan | Tugas |
|---|---|---|---|---|
| 1 | Tagihan berulang (sewa, SPP, langganan) | kos, kursus, rental, jasa langganan | Pendapatan rutin yang paling sering lupa ditagih. Invoice + QRIS + pengingat sudah ada, jadi biaya kecil | W-07A |
| 2 | Order titipan/servis (tiket, status, janji selesai, ambil) | bengkel, laundry, penjahit, servis elektronik | Satu pola untuk empat jenis usaha. Pelanggan menanyakan status lewat WA setiap hari | W-07B |
| 3 | Komisi per layanan/penjualan ke slip gaji | salon, bengkel, sales grosir | Disebut pelanggan pesaing. Slip gaji Nadi sudah ada, komisi masuk sebagai komponen | W-07C |
| 4 | Anggaran proyek vs realisasi + jam kerja per proyek | kontraktor, agensi, konsultan | Tag proyek sudah ada di jurnal; kurang RAB dan timesheet | W-07D |

Yang ditunda, dengan alasan:
- Bon pelanggan di kasir: piutang per pelanggan sudah ada lewat invoice.
- Pesanan per meja: Mata meja + kasir cukup untuk warung makan kecil.
- Rekam medis: diatur, di luar Nadi.
