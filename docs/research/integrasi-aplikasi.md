# Sambungan ke aplikasi yang dipakai pemilik usaha (riset 4 Nov 2026)

Pertanyaan Tristan: apakah Nadi sudah tersambung langsung ke aplikasi kasir, e-commerce, dan lainnya; kalau belum, bisakah dibuat; kalau tidak bisa, adakah jalan lain seperti pipeline.

## 1. Keadaan sekarang

Nadi belum punya sambungan API langsung ke aplikasi luar mana pun. Jalur masuk data yang ada:
- **Lempar Saja.** Ekspor Excel/CSV dari aplikasi kasir, marketplace, atau bank dilempar ke Nadi. Ekstraktor terkompilasi mempelajari tata letaknya sekali, lalu berkas berikutnya dibaca tanpa AI.
- **Mutasi bank.** Berkas CSV mutasi bank untuk mencocokkan tagihan.
- **Bagikan dari aplikasi lain** ke Nadi (Web Share Target, termasuk dari WhatsApp).
- **Server MCP.** Asisten AI milik pengguna bisa membuat usulan.

## 2. Temuan per jenis aplikasi

| Aplikasi | Akses API | Status | Sumber |
|---|---|---|---|
| TikTok Shop / Tokopedia | Aplikasi dibuat di Partner Center, penjual mengizinkan tokonya (token per toko), permintaan ditandatangani, ada sandbox. Pesanan, produk, keuangan tersedia | B: dokumentasi resmi butuh login; menurut blog vendor April 2026, akses dibuka luas untuk pengembang pihak ketiga. Cakupan Tokopedia belum dipastikan | keyapi.ai, novadata.io, pypi tiktok-shop-api |
| Shopee | Shopee Open Platform: daftar sebagai mitra ISV, profil ditinjau Shopee, butuh produk HTTPS hidup dan akun uji; pesanan, logistik, retur lewat API v2 dengan token per toko | B: syarat per wilayah, panduan resmi belum terbaca | dokumentasi konektor Odoo, ginee.com |
| Moka, Majoo, Pawoon (kasir) | Tidak ditemukan dokumentasi pengembang publik. Moka punya API yang dipakai integrasi Odoo dan Mekari Jurnal; Majoo disebut punya API untuk sistem internal | B: kemungkinan butuh kerja sama kemitraan | apps.odoo.com pos_moka, jurnal.id, hitpayapp.com |
| Accurate Online (akuntansi) | Daftar sebagai pengembang AOL; API baca/tulis data (barang, faktur) dengan token Bearer + X-Session-ID; dokumentasi Swagger | T: dokumentasi resmi accurate.id | accurate.id/api-integration |
| Bank (BCA, BRI) via SNAP BI | API mutasi rekening ada dan sudah standar SNAP. Pemakainya pemegang izin PJP atau pihak non-PJP yang memakai API untuk konsumennya sendiri | T untuk keberadaan API (developer.bca.co.id, developers.bri.co.id); akses untuk aplikasi seperti Nadi belum dipastikan | developer.bca.co.id |

## 3. Jawaban

- **Bisa dibuat, dengan batas.**
  - Konektor ke API publik bisa kubangun: TikTok Shop, Shopee, Accurate, dan nanti Lazada atau Mekari Jurnal setelah dibaca.
  - Pendaftaran akun mitra atau pengembang di platform itu atas nama Nadi adalah urusan identitas dan perjanjian, jadi bagian Tristan.
  - Kasir lokal tanpa API publik butuh kerja sama. Sambil menunggu, jalurnya lewat berkas ekspor.
- **Jalan lain yang bisa langsung dibuat tanpa izin siapa pun:**
  1. **Alamat lempar per usaha.** Contoh: `lempar+<kode>@...`. Laporan harian yang dikirim otomatis oleh aplikasi kasir atau marketplace lewat email langsung masuk Lempar. Butuh layanan email masuk; biayanya dicek dulu.
  2. **Pintu masuk data (webhook) per usaha** dengan kunci yang bisa dicabut. Aplikasi lain, atau alat pipeline seperti n8n, Make, atau Zapier, mengirim JSON atau CSV ke Nadi. Semua yang masuk menjadi usulan, bukan langsung tercatat.
  3. **Folder pantau.** Pengguna menaruh ekspor di folder Google Drive, dan Nadi membacanya berkala. Butuh izin OAuth Google atas nama pengguna.
  4. **MCP.** AI milik pengguna yang punya akses ke aplikasi lain dapat memindahkan data ke Nadi sebagai usulan.
- **Urutan yang disarankan:**
  1. pintu masuk data + pipeline (jalan untuk semua aplikasi yang bisa mengirim webhook atau dihubungkan lewat n8n/Make/Zapier);
  2. konektor TikTok Shop dan Shopee (pesanan dan penjualan menjadi catatan penjualan, cocok dengan modul stok W-07);
  3. Accurate;
  4. kasir lokal lewat kemitraan.

## 4. Tugas

- **W-08 Pintu masuk data dan pipeline.**
  - Endpoint POST per usaha dengan token `nmi_` (hash, bisa dicabut, batas harian).
  - Menerima JSON atau CSV dengan skema penjualan, pesanan, dan mutasi.
  - Hasilnya usulan di Feed.
  - Contoh alur n8n dan Make di panduan.
  - Tes SQL isolasi, tes kunci dicabut ditolak, e2e kirim contoh jadi usulan.
- **W-09 Konektor marketplace** (setelah W-07 stok). OAuth toko TikTok Shop dan Shopee, tarik pesanan harian menjadi usulan penjualan. Butuh akun mitra (UNTUK-TRISTAN).

Status B harus diverifikasi ke dokumentasi resmi sebelum kode ditulis (aturan GROUND TRUTH).
