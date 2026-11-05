# Keterpahaman: 5 tugas umum (U-08)

Diukur e2e/keterpahaman.spec.ts di produksi, HP 390x844 dan desktop 1440x900, akun pemilik dan satu staf. Metrik:
- klik navigasi dari halaman pertama setelah masuk sampai layar tugas terbuka;
- tautan yang harus dipindai di setiap titik keputusan (tautan /app yang terlihat di layar).

Mengisi formulirnya sendiri tidak dihitung karena tidak berubah oleh rombakan. Skrip mengikuti jalur yang sudah diketahui, jadi angka klik ini adalah kasus terbaik. Orang yang belum tahu letaknya akan menghabiskan lebih banyak.

## Sebelum rombakan (6 Nov 2026, produksi 0918ceb)

| Tugas | Klik | Tautan dipindai per langkah | Jalur |
|---|---|---|---|
| Setujui satu usulan | 0 | 20 | Feed |
| Buat invoice | 2 | 20, 39 | Feed > Usaha > Invoice |
| Tambah karyawan | 1 | 20 | Feed > Orang |
| Lihat laba bulan ini | 3 | 20, 39, 17 | Feed > Usaha > Laporan keuangan > Laba rugi |
| Staf mengajukan izin | 1 | 5 | Kerja > Izin |

Angka HP dan desktop sama, karena kerangkanya memang satu untuk semua layar.

Bacaan:
- Klik sedikit, tetapi invoice dan laporan keuangan hanya bisa ditemukan lewat "Usaha", padahal label itu terdengar seperti pengaturan. Di sana pengguna harus memindai 39 tautan.
- Tidak ada label yang menunjuk ke invoice dari Feed. Jalur ini hanya tampak mudah bagi orang yang sudah tahu letaknya, dan itulah yang dialami Tristan.

## Sesudah rombakan (6 Nov 2026, U-01..U-06 + U-08, usaha akun B "Uji Kinerja E2E")

Target semula: tidak ada tugas yang lebih banyak kliknya, tidak ada titik keputusan dengan lebih dari 12 pilihan, dan setiap fitur bisa ditemukan lewat pencarian dengan satu kata sehari-hari.

| Tugas | Klik HP (390) | Klik desktop (1440) | Sebelum | Tautan dipindai HP | Tautan dipindai desktop | Jalur sesudah |
|---|---|---|---|---|---|---|
| Setujui satu usulan | 0 | 0 | 0 | 23 | 32 | Hari ini |
| Buat invoice | 1 | 1 | 2 | 23 | 32 | HP: bilah bawah Uang; desktop: Disematkan > Invoice |
| Tambah karyawan | 1 | 1 | 1 | 23 | 32 | HP: bilah bawah Orang; desktop: Disematkan > Orang |
| Lihat laba bulan ini | 3 | 2 | 3 | 23, 46, 14 | 32, 30 | HP: Menu > Laporan keuangan > Laba rugi; desktop: Disematkan > Laporan keuangan > Laba rugi |
| Staf mengajukan izin | 1 | 1 | 1 | 6 | 11 | Izin di bilah bawah atau Disematkan |

Hasil terhadap target:
- **Klik: terpenuhi.** Tidak ada tugas yang lebih banyak kliknya. Invoice turun dari 2 ke 1 klik, laba di desktop dari 3 ke 2. Waktu mengukur ternyata Tambah karyawan di desktop sempat jadi 2 klik (buka ruang Orang lalu Orang), lebih buruk dari sebelumnya. Orang lalu ditambahkan ke Disematkan bawaan pemilik, jadi kembali 1 klik.
- **Pilihan per titik keputusan: tidak terpenuhi.** Hari ini memuat 32 tautan di desktop dan 23 di HP, lebih banyak dari 20 sebelumnya. Sumbernya sidebar (Disematkan 6, ruang yang terbuka 4, kaki 4, judul ruang lain) dan daftar Mulai di Nadi (6 langkah selama belum selesai). Lembar Menu di HP berisi 46 tautan. Bedanya dengan sebelum: tautan itu kini berkelompok dan berlabel ruang, bukan 39 tautan rata di Usaha. Meski begitu, angka mentahnya tetap naik dan harus ditulis apa adanya.
- **Pencarian: terpenuhi** untuk 57 dari 60 kata sehari-hari (U-02, src/lib/cari-fitur.test.ts). Contohnya "laba" dan "karyawan" langsung membuka halamannya lewat Ctrl K atau tombol Cari, tanpa memindai menu.

Tindak lanjut: daftar Mulai di Nadi hilang sendiri setelah langkahnya selesai, jadi Hari ini usaha yang sudah berjalan memuat 6 tautan lebih sedikit. Lembar Menu HP sengaja menampilkan semua fitur dengan gunanya. Kalau uji pengguna nyata menunjukkan orang tersesat di sana, lembar itu dibuka dengan ruang terlipat seperti sidebar.
