# Riset Mekari (4 Nov 2026)

Permintaan Tristan 4 Nov 2026:
1. Kumpulkan semua hal tentang Mekari: fitur, detail tiap halaman dan tiap tombol.
2. Bandingkan dengan Nadi.
3. Tambahkan semua yang kurang ke Nadi, dalam satu langganan yang lebih hemat, cepat, dan otomatis.
4. Catat yang butuh pihak ketiga, dan akali bila sah.

## Isi folder

| Berkas | Isi |
|---|---|
| [produk.md](produk.md) | Peta semua produk Mekari (6 utama, 13 pendukung/keuangan/layanan), modul tiap produk, API dan webhook |
| [harga.md](harga.md) | Harga resmi per produk dan biaya tumpukan penuh untuk contoh usaha 20 karyawan |
| [fitur.md](fitur.md) | 134 kemampuan Mekari dengan status di Nadi (ADA/SEBAGIAN/BELUM/MITRA/LUAR) dan tugas penutupnya |
| [pihak-ketiga.md](pihak-ketiga.md) | 20 hal yang butuh mitra berizin, dasar hukumnya, dan jalan pengganti yang sah |
| [rencana.md](rencana.md) | 27 tugas implementasi (M-01..M-27) berurutan dengan kriteria terima, termasuk nilai tambah baru |
| [inventaris/](inventaris/) | Inventaris mesin per produk: pohon menu, jalur klik, elemen layar |
| [alat/](alat/) | Skrip penarik, penyusun inventaris, dan gerbang cakupan |

### Isi inventaris/

Setiap produk punya pohon menu: kategori, bagian, dan setiap artikel bantuan dengan tautan dan tanggal ubah. Per artikel ada:
- **jalur klik**: label tebal berurutan di langkah, misalnya `Payroll > Payroll processing > Payroll history`;
- **elemen layar**: diambil dari tabel "nama tombol/bagian" yang dipakai Mekari untuk menjelaskan tiap halaman.

Ditambah `api.md` yang berisi 1.315 endpoint dan entitas dari dokumentasi API publik.

## Sumber dan angka

Semua sumber diakses 4 Nov 2026.

| Sumber | Isi | Jumlah |
|---|---|---|
| https://mekari.com/sitemap.xml | halaman produk, harga, solusi, integrasi | 147 halaman dibaca dari 198 |
| Pusat bantuan Talenta (help-center.talenta.co) | 23 kategori, 131 bagian | 697 artikel, 3.466 elemen layar |
| Pusat bantuan Jurnal (help-center.jurnal.id) | 24 kategori, 176 bagian | 488 artikel, 1.249 elemen |
| Pusat bantuan Qontak (help-center.qontak.com) | 18 kategori, 64 bagian | 422 artikel, 1.165 elemen |
| Pusat bantuan Klikpajak (help-center.klikpajak.id) | 14 kategori, 55 bagian | 222 artikel |
| Pusat bantuan Mekari umum (help-center.mekari.com) | Flex, Officeless, POS, Account, Partners | 132 artikel |
| Pusat bantuan Sign (mekarisign.zendesk.com) | 15 kategori, 43 bagian | 96 artikel |
| Pusat bantuan Expense (help-center.expense.mekari.com) | 15 kategori, 31 bagian | 102 artikel |
| developers.mekari.com + Postman, Swagger, OpenAPI | Talenta, Klikpajak, Qontak CRM, Jurnal, POS, Sign, Expense | 1.315 endpoint |
| Halaman harga talenta.co, jurnal.id, qontak.com, klikpajak.id, mekarisign.com, mekari.com/harga | paket dan harga | 8 halaman |

Total artikel bantuan Indonesia: 2.159. Seluruh 545 bagian pusat bantuan masuk ke salah satu baris fitur.md. Ini diperiksa `alat/cek_cakupan.py`, yang menjadi langkah `mekari` di loop/gate.sh.

## Cara dan batas

**Cara mengambil data.**
- Pusat bantuan diambil lewat API Help Center publik. robots.txt situs itu mengizinkan jalur API artikel; jalur yang dilarang adalah pencarian, tiket, dan akun.
- Jeda antarpermintaan 0,4 sampai 0,5 detik.
- Tanpa login dan tanpa membuat akun.

**Yang tidak disalin.** Teks artikel dan halaman Mekari tidak disalin ke repo. Yang disimpan:
- judul, tautan, jalur menu, nama tombol;
- fungsi tombol yang diringkas;
- daftar endpoint;
- ringkasan dalam kata-kata sendiri.

Salinan mentah hanya ada di folder sementara saat analisis. Untuk mengambil ulang:
```
python -I alat/tarik_bantuan.py <folder>
python -I alat/tarik_halaman.py <daftar_jalur.txt> <folder>
python -I alat/inventaris.py <folder> inventaris
python -I alat/inventaris_api.py <folder_api> inventaris/api.md
```

**Batas cakupan.** "Setiap halaman dan tombol" di sini berarti yang terdokumentasi publik.
- Layar yang tidak dijelaskan pusat bantuan tidak terlihat, karena aplikasi Mekari tidak dibuka (butuh akun). Contohnya halaman admin internal dan fitur yang baru dirilis tanpa artikel.
- 2.159 artikel dan 6.894 elemen layar adalah gambaran terdekat yang bisa diperoleh tanpa akun.
- Tidak ada akun yang dibuat (penjaga).
