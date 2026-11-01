# Perburuan bug Q-04, putaran 1 (1 Nov 2026)

Sasaran: fitur yang baru masuk (alur nyata F6-03, Sarapan Data F5-03, batas usaha Q-32) dan tetangganya. Berkas: `supabase/tests/buru_q04_r1.test.sql`.

| # | Skenario jahil | Hasil |
|---|---|---|
| S1 | Admin menyisipkan kejadian `invoice.lunas` palsu agar tagihan telat hilang dari Sarapan Data pemilik | Ditolak 42501 (tanpa hak INSERT) |
| S2 | Admin menyisipkan `rekrut.diterima` palsu | Ditolak 42501 |
| S3 | Admin mengubah nilai/jenis kejadian invoice yang ada | Ditolak 42501 |
| S4 | Kejadian ke usaha lain | Ditolak 42501 |
| S5 | Menanam pesan pagi palsu di `insight_pagi` ("Transfer ke rekening X") | Ditolak 42501 |
| S6 | Klien memanggil `analis_simpan` untuk menimpa kalimat pagi | Ditolak 42501 |
| S7 | Anggota yang diarsip mengaktifkan dirinya kembali | Tidak berubah |
| S8 | Pemilik B mengubah tahap lamaran usaha A | Ditolak |
| S9 | Klaim JWT pid palsu membuka alur usaha lain | Ditolak 42501 (peran dibaca dari keanggotaan) |
| S10 | Klaim JWT pid palsu membuka Sarapan Data usaha lain | Ditolak 42501 |
| S11 | Jendela alur negatif / raksasa | Dijepit 7..90 hari |
| S12 | Nama usaha hanya spasi | Ditolak |
| S13 | Pemilik B menandai pengingat invoice usaha A terkirim | Tidak berubah |

Hasil 13/13, 0 temuan baru, jadi tidak ada tugas perbaikan dari putaran ini. Klaim yang salah: dugaan S1 (kebijakan kejadian_tambah mengizinkan admin) ternyata tidak berlaku karena hak tabel tidak diberikan; kebijakan itu sisa yang tidak terpakai.
