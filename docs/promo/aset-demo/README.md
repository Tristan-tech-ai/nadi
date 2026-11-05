# Aset demo video (V-04)

Semua berkas di sini buatan sendiri, berisi data karangan, dan dibuat ulang persis dengan `python -I buat.py <folder>` (benih tetap).
Lisensinya milik proyek; tercatat di docs/ASSETS.md. Tidak ada orang yang dapat dikenali: CCTV memakai sosok abstrak dari atas, berupa lingkaran kepala dan elips bahu tanpa wajah.

| Berkas | Isi | Dipakai di storyboard (docs/promo/video-demo/STORYBOARD.md) |
|---|---|---|
| karyawan-berantakan.xlsx | 22 karyawan Toko Bu Sari. Judul bergabung dan catatan merah di atas tabel, nama kolom tidak seragam ("Gapok", "No HP / WA"), tanggal dalam 5 format, gaji dalam 5 format (angka, "Rp 4.200.000", "4,5 jt", "Rp5250rb"), HP dalam 5 format, 1 baris kosong, 2 orang tercatat ganda (beda huruf besar dan spasi), rumus TOTAL yang salah | Babak 1 (masalah), babak 3 (lempar ke chat AI lewat MCP) |
| harga-berantakan.xlsx | 12 barang dengan kode, satuan, dan rupiah tidak seragam, catatan di sel harga, 1 barang ganda dengan harga berbeda | Babak 3 |
| pelanggan-ganda.csv | 14 baris dari WhatsApp dan buku catatan untuk 9 pelanggan sebenarnya ("Ibu Sari" = "Sari Wulandari", "Tony Catering" = "Toni (katering)") | Babak 1, babak 4 (rincian usulan: dilewati karena sudah ada) |
| cctv-toko.mp4 + cctv-jawaban.json | Kamera atas 1280×720, 30 fps, 60 dtk. 12 pengunjung masuk lewat pintu, lewat lorong ke rak, berhenti, membayar di kasir, lalu keluar; 1 karyawan di kasir. Gerak memakai easing smootherstep (percepat lalu perlambat), bukan linier. Ada cap waktu CCTV. Jawaban kunjungan sebenarnya (masuk/keluar per orang) untuk mengecek hitungan Mata | Babak 1 (CCTV yang ditonton manual), babak 6 (Mata melacak dan menghitung, peta panas) |

Foto nota dan berkas lain yang dilempar di video memakai korpus sintetis yang sudah ada (fixtures/korpus/nota, struk-foto, slip_gaji).
