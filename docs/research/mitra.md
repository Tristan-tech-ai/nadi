# Direktori mitra psikolog, akuntan publik, konsultan pajak (F6-04)

Ditulis 4 Nov 2026. Kriteria: pengguna bisa mengirim permintaan; tidak ada transaksi uang.

## Izin praktik (teks resmi, dibaca 4 Nov 2026)
- **Psikolog:** UU 23/2022 tentang Pendidikan dan Layanan Psikologi (https://peraturan.bpk.go.id/Download/213209/UU%20Nomor%2023%20Tahun%202022.pdf, ditetapkan dan berlaku 3 Agu 2022).
  - Pasal 15: STR diterbitkan induk organisasi profesi himpunan Psikologi, berlaku seumur hidup.
  - Pasal 17: setiap Psikolog yang menjalankan Layanan Psikologi wajib memiliki SILP, diterbitkan Pemerintah Pusat; SILP program profesi pertama berlaku 2 tahun dan dapat diperpanjang.
  - Pasal 18: perpanjangan butuh STR berlaku dan rekomendasi himpunan, lalu berlaku 5 tahun.
  - Pasal 51 (peralihan, dari hasil pencarian, belum dibaca utuh): izin praktik lama berlaku paling lama 5 tahun sejak peraturan pelaksanaan.
  - Psikolog di fasilitas kesehatan mengikuti aturan kesehatan (UU 17/2023). Ini B, nomor pasalnya belum dibaca.
- **Akuntan publik:** UU 5/2011 (https://peraturan.go.id/files/uu5-2011bt.pdf) Pasal 5: izin menjadi Akuntan Publik diberikan oleh Menteri dan berlaku 5 tahun sejak ditetapkan, dapat diperpanjang.
- **Konsultan pajak:** PMK 175/PMK.01/2022 mengubah PMK 111/PMK.03/2014 (https://peraturan.go.id/files/bn1203-2022.pdf).
  - Pasal 1 angka 2: Izin Praktik ditetapkan Sekretaris Jenderal Kementerian Keuangan.
  - Pasal 4 ayat (1): untuk berpraktik wajib mempunyai Izin Praktik dari Sekjen Kemenkeu atau pejabat yang ditunjuk.
  - Pasal 5: Izin Praktik bertingkat A, B, C.

## Keputusan
- **Data contoh:** direktori global (`public.mitra`, dibaca pengguna masuk saja) berisi 4 mitra contoh sintetis. Namanya diawali "Contoh:", tanpa nomor izin, dan `terverifikasi = false`. CHECK melarang data contoh berstatus terverifikasi.
- **Label izin:** layar menyebut izin yang wajib dimiliki tiap jenis beserta pasalnya, menyarankan meminta nomornya, dan menampilkan "Izin belum diperiksa Nadi" sampai ada pemeriksaan (kolom `diverifikasi_at`).
- **Permintaan:** disimpan di `public.permintaan_mitra` (pemilik dan admin; idempoten; paling banyak 10 sehari; bisa dibatalkan). Tidak ada kolom uang, dan Nadi tidak mengirim pesan atau email ke mitra (penjaga).
- **Mitra sungguhan:** akun mitra dan pemeriksaan izin butuh pendaftaran mitra nyata. Ini di luar tugas ini dan dicatat untuk nanti.
