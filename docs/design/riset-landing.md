# Riset landing SaaS sejenis (bagian pertama D-11)

Dilihat langsung di Chrome pada 3 Nov 2026 malam (lebar desktop; susunan judul diambil dari DOM halaman). Pengecilan jendela ke
390 px tidak berhasil di peramban ini (lebar tetap 1920), jadi foto HP diambil dengan Playwright saat landing baru dibangun.
Tidak ada isi atau gambar pesaing yang disalin ke Nadi; yang dicatat hanya susunan dan pola.

## Yang dilihat

| Situs | Pahlawan | Urutan bagian (h1/h2) | Tinggi halaman | Ajakan | Bukti |
|---|---|---|---|---|---|
| majoo.id | kiri judul "Aplikasi Manajemen Bisnis, Operasional Serba Otomatis" + 8 pil fitur berwarna, kanan foto kasir + tab jenis usaha | fitur (3 kartu foto), testimoni video + jumlah pengguna + logo, solusi per jenis usaha (tab), produk Prime, produk pendukung, layanan, kenapa majoo, liputan media, artikel SEO panjang | sangat panjang | Coba Gratis 14 Hari + Jadwalkan Demo + WhatsApp mengambang | angka pengguna, logo pelanggan, liputan |
| talenta.co | kiri "AI-centric HCM ..." + 3 butir centang, kanan foto orang di kursi + ikon 3D | logo "Dipercaya 55.000+ bisnis", penghargaan Gartner, fitur, platform enterprise, industri, integrasi, kenapa, studi kasus, FAQ | 7.813 px | WhatsApp sales + Coba gratis | rating G2/Capterra, logo, Gartner |
| gadjian.com | tengah judul + ilustrasi kartun di meja | penghargaan, logo pengguna, kenapa, solusi, testimoni, liputan, FAQ | 6.162 px | Coba Gadjian GRATIS | penghargaan, logo |
| kledo.com | tengah judul + tangkapan layar produk (dihalangi pop-up acara saat dibuka) | masalah, keuntungan, alasan, sederhanakan, **harga**, testimoni, liputan, FAQ | 9.789 px | Coba Gratis | testimoni, liputan |
| jurnal.id | kiri judul + 3 centang + WhatsApp sales, kanan ilustrasi 3D | logo 35.000+ bisnis, penghargaan, fitur, all-in-one, industri, integrasi, hasil klien, FAQ | 8.583 px | WhatsApp sales + Mulai gratis | rating, ISO 27001, BI, logo |
| gusto.com | tengah judul serif besar "Hire, pay, and grow like a pro." di atas latar merah, di bawahnya **UI produk asli** dengan kartu mengambang | angka 500.000+, gaji 5 menit, rekrut, kisah usaha kecil, ajakan, pricing, untuk akuntan, untuk pengembang | 9.466 px | Create free account + How Gusto works | angka, kisah |
| joinhomebase.com | tengah judul kapital tebal "SCHEDULE. MANAGE. PAY." + **UI jadwal asli** | angka 150.000+, uji gratis, manajemen tim, hasil per shift, testimoni, asisten AI, semua fitur, FAQ | 8.617 px | Get started for free | angka, testimoni |
| deputy.com | tengah judul di latar biru tua + label "AI-POWERED" + **tab fitur di atas UI asli** (AI Agent, Scheduling, Timekeeping, Compliance, HR, Payroll) | tantangan, kenapa pindah, industri, hasil, ajakan | 8.736 px | See how it works + Start for free | "thousands of businesses" |
| **Nadi sekarang** | kiri judul stabilo, kanan kartu nota hidup yang bisa disetujui | pekerjaan kecil (6 baris buku kas), 3 langkah, berkas kedua tanpa AI, MCP, data terpisah, ajakan | **2.840 px** | Mulai dari satu nota + Coba usaha contoh | hasil eval 5 dari 5 |

## Tampilan HP 390 px (Playwright, 3 Nov 2026, viewport 390 x 844, isMobile)
- 5 dari 8 layar pertama tertutup sebagian oleh pop-up promo, banner diskon, kotak persetujuan cookie, atau tombol WhatsApp
  mengambang (Kledo pop-up acara, Gusto dan Homebase kotak cookie, Deputy banner + kotak cookie, majoo/Talenta/Jurnal WhatsApp).
- Layar pertama HP hampir seluruhnya judul besar + tombol; UI produk asli hanya terlihat sebagian di Homebase. Di Nadi, kartu nota
  demo baru muncul setelah judul, paragraf, dan dua tombol (di bawah lipatan pertama).
- Pelajaran: di HP, satu hal yang dilihat pertama harus produknya sendiri; tanpa lapisan yang menutup isi.

## Pola yang berulang (dan generik)
1. Judul "Aplikasi/Software X ... otomatis/terintegrasi/AI" + 3 butir centang + dua tombol (WhatsApp sales dan coba gratis).
2. Foto stok orang tersenyum atau ilustrasi 3D di kanan (majoo, Talenta, Jurnal, Gadjian).
3. Bukti sosial di lipatan kedua: "Dipercaya N.000+ bisnis", logo pelanggan, rating G2, penghargaan.
4. Deretan tiga kartu fitur sama besar, bagian "kenapa memilih kami", bagian industri bertab.
5. Harga dan FAQ di bawah; tombol WhatsApp mengambang; pop-up promo dan banner diskon di atas.
Yang paling **tidak** generik justru yang memperlihatkan **produk asli bekerja** di pahlawan (Gusto, Homebase, Deputy) dan yang
memakai tipografi berkarakter (Gusto serif, Homebase kapital padat).

## Kekurangan landing Nadi sekarang (temuan jujur)
1. **Isinya basi dan salah**: baris "Absen di buku, gaji dihitung manual" dan "Satu orang memegang kasir, gudang, dan antar barang"
   masih bertulis "Sedang dibuat", padahal absen QR + cek wajah, gaji PPh 21/BPJS, dan topi sudah jalan di produksi. Landing tidak
   menyebut sama sekali invoice QRIS, izin otopilot, jadwal shift, lembur, rekrut + wawancara suara, Mata, Peta Usaha, Sarapan Data,
   Kompas Pajak, Ruang Akuntan, surat, buku besar, cocok mutasi, padahal semuanya sudah ada.
2. Tidak ada navigasi (hanya "Masuk"): tidak ada tautan ke demo, panduan, harga, keamanan.
3. Tidak ada harga, FAQ, fitur per peran (pemilik, admin, staf, akuntan), atau kaki halaman yang lengkap (privasi, syarat, kontak).
4. Tinggi 2.840 px: sepertiga pesaing. Pendek bukan masalah, tetapi di sini pendek karena isinya belum ditulis.
5. Ciri khas kertas sudah ada (stabilo, nota mono, buku kas), tetapi dipakai tipis; halaman terasa seperti templat gelap minimalis.

## Arah untuk landing baru (dipakai di D-10, D-11, D-15)
- **Pertahankan** yang membedakan: demo hidup di pahlawan (Nadi satu-satunya yang membiarkan pengunjung menekan Setujui tanpa daftar),
  jujur soal status fitur, tanpa angka pengguna karangan, tanpa foto stok.
- **Ambil pola yang berguna**, bukan gaya: UI asli bekerja di atas lipatan (seperti Gusto/Homebase), tab fitur per peran di atas UI
  asli (seperti Deputy, tetapi tabnya peran: Pemilik, Admin, Staf, Akuntan), harga terang dengan tiga paket, FAQ, kaki halaman lengkap.
- **Bukti pengganti logo pelanggan** (karena belum ada pelanggan): angka uji yang bisa diperiksa (5 dari 5 tata letak tanpa AI,
  akurasi Mata 91,7%, 89 migrasi dengan tes isolasi), tautan /demo dan /panduan, video satu hari di warung.
- **Tidak ditiru**: pil fitur warna-warni, ikon 3D, foto orang tersenyum, "Dipercaya N.000+", WhatsApp mengambang, pop-up promo,
  kartu tiga sama besar.
- Isi fitur diambil dari daftar fitur yang benar-benar ada di produksi (tes e2e), bukan dari ingatan; status "Sedang dibuat" hanya
  untuk yang memang belum.
