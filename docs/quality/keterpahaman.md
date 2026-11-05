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

## Sesudah rombakan

Diisi setelah U-01 sampai U-06. Targetnya: tidak ada tugas yang lebih banyak kliknya, tidak ada titik keputusan dengan lebih dari 12 pilihan, dan setiap fitur bisa ditemukan lewat pencarian dengan satu kata sehari-hari.
