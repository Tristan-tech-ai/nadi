# Naskah landing Nadi (F0-11)

Ditulis 31 Okt 2026 sebelum desain. Patokan: DIRECTION.md §4 (pahlawan 60/40 rata kiri, demo hidup, satu tombol utama, bukti hanya yang nyata), VOICE.md, ANTI-SLOP.md.

## Untuk siapa (uji 5 detik)
Pemilik usaha kecil di Indonesia (warung makan, kedai kopi, toko) yang pembukuannya masih di nota, buku tulis, dan Excel. Setelah 5 detik orang harus bisa bilang: "Nadi membaca nota dan berkas usahaku, lalu aku tinggal setujui dari HP."

## Pahlawan
- **Judul:** Lempar nota, slip, atau Excel apa saja. Nadi yang merapikan.
- **Sub:** Foto nota belanja, slip gaji, atau rekap absen. Nadi membacanya dan menyiapkan usulan: catat belanja, tambah karyawan, masukkan absen. Tidak ada yang tercatat sebelum kamu setujui.
- **Tombol utama:** Mulai dari satu nota → /daftar
- **Tautan kecil:** Sudah punya akun? Masuk
- **Demo hidup (kanan, 40%):** nota UD Sumber Rejeki (berkas korpus uji nota-01, sintetis) tercetak baris demi baris, lalu menjadi kartu usulan "Catat belanja Rp376.500 di UD Sumber Rejeki" dengan keterangan "3 barang, nota NT-4671. Dibaca dari nota, yakin 92%". Pengunjung bisa menekan Setujui (cap DITERIMA) atau Tolak (cap DITOLAK), lalu Ulangi. Angka nota dan total adalah isi berkas uji yang benar-benar dibaca Nadi, bukan klaim.

## Masalah yang dikerjakan (baris buku kas, bukan tiga kartu)
Kolom kiri masalah sehari-hari, kolom kanan yang Nadi lakukan. Fitur yang belum jadi ditandai "sedang dibuat", tidak diakui sudah ada.

| Masalah | Nadi | Keadaan |
|---|---|---|
| Nota belanja menumpuk di laci, baru dicatat akhir bulan. | Foto notanya. Nadi menyalin barang, harga, dan total, lalu mencocokkan jumlah per baris dengan totalnya. | sudah bisa |
| Data karyawan tercecer di KTP, WhatsApp, dan Excel lama. | Lempar foto KTP atau Excel karyawan. Nadi menyiapkan daftar orang; NIK hanya disimpan 4 digit akhir. | sudah bisa |
| Karyawan lapangan tidak punya email. | Staf masuk dengan kode usaha, ID staf, dan PIN 6 angka. | sudah bisa |
| Mutasi rekening harus dicocokkan satu per satu. | Lempar CSV mutasi. Nadi mengubahnya jadi daftar transaksi untuk dicocokkan. | sudah bisa |
| Absen di buku, gaji dihitung manual tiap bulan. | Absen dari HP dan gaji yang dihitung dari bukti. | sedang dibuat |
| Satu orang memegang kasir, gudang, dan antar barang. | Topi: satu orang bisa memakai beberapa peran kerja, tugasnya ikut per peran. | sedang dibuat |

## Cara kerja (tiga langkah bernomor, garis waktu)
1. **Lempar.** Foto, PDF, CSV, atau Excel. Dari HP, atau bagikan langsung dari WhatsApp.
2. **Nadi membaca.** Isi berkas dirapikan dan angka dicocokkan. Keyakinan dan buktinya selalu ditampilkan.
3. **Kamu putuskan.** Setujui atau tolak dari Feed. Baru setelah itu data tercatat.

## Hemat (bukti nyata)
Judul: Berkas kedua dibaca tanpa AI.
Isi: Setelah membaca satu berkas, Nadi menulis aturan untuk tata letak itu. Slip gaji, invoice pemasok, mutasi bank, dan nota berikutnya dengan tata letak sama dibaca dengan aturan itu, tanpa memanggil AI. Pada uji kami dengan berkas contoh, 5 dari 5 tata letak terbaca ulang tanpa AI (docs/quality/eval-ekstraktor.md).

## Asisten AI milikmu
Judul: Pakai asisten AI yang sudah kamu langgani.
Isi: Asisten AI yang mendukung MCP bisa tersambung ke Nadi atas izinmu, membaca data usaha sesuai peranmu, dan mengajukan usulan. Semua perubahan tetap menunggu persetujuanmu, dan izinnya bisa dicabut kapan saja.

## Data
Judul: Datamu terpisah dan kamu yang memutuskan.
- Setiap usaha terpisah di database (pemeriksaan per baris), diuji otomatis.
- NIK disimpan sebagai sidik acak dan 4 digit akhir.
- Kunci AI tidak pernah ada di HP atau browser.

## Penutup
- Judul: Mulai dari satu nota.
- Tombol: Buat akun → /daftar (tombol utama kedua di bagian bawah halaman, bukan di layar yang sama dengan pahlawan)
- Kaki: © 2026 Nadi · Masuk · Masuk sebagai staf

## Yang sengaja tidak ada
Angka pengguna, logo pelanggan, testimoni, harga (belum ditetapkan), ilustrasi stok, gradien.
