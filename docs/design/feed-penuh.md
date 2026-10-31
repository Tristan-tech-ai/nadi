# Feed tidak menyembunyikan usulan (D-05)

Ditulis 1 Nov 2026. Masalah: Feed (/app) mengambil 20 usulan menunggu teratas menurut tenggat, dampak rupiah, lalu waktu dibuat. Usulan ke-21 dan seterusnya tidak terlihat sama sekali, dan usulan baru tanpa tenggat/dampak bisa tenggelam di bawah usulan lama yang berdampak besar. Pemilik tidak tahu ada yang tersembunyi.

## Keputusan
1. **Jumlah jujur di atas daftar.** Kartu ringkasan "Usulan menunggu" memakai hitungan sebenarnya (`count: exact`), bukan panjang daftar. Bila lebih dari yang tampil, di bawah daftar ada baris "Masih ada N usulan lagi" dengan tautan "Lihat semua".
2. **Halaman berikut dengan kursor, bukan nomor halaman.** `/app?lagi=<n>` menampilkan 20 berikutnya (offset sederhana cukup: usulan menunggu per usaha jarang ribuan; kueri Feed 0,05 ms pada 50 usaha, docs/quality/kapasitas.md).
3. **Saring per jenis.** Baris pil di atas daftar: Semua, Uang, Orang, Izin, Rekrut, Dokumen, masing-masing dengan jumlahnya (dari `aksi` awalan sebelum titik). Pil memakai radius 9999 px (ANTI-SLOP S24) dan status tidak hanya warna.
4. **Usulan baru tidak tenggelam.** Urutan tetap (tenggat, dampak, waktu), tetapi usulan berumur < 24 jam diberi penanda teks "Baru" dan saringan "Terbaru" mengurutkan menurut waktu dibuat.
5. Tanpa gulir tak berujung: tombol eksplisit lebih mudah di HP satu tangan dan tidak memuat data yang tidak diminta (egress).

## Kriteria terima (dari antrean)
Bila usulan menunggu lebih dari 20, Feed menyebut jumlah sisanya dan ada cara melihat semuanya; usulan baru tanpa tenggat/dampak tetap bisa ditemukan; e2e dengan 25 usulan.
