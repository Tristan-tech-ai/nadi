# Nadi Mod v1

Fitur tambahan yang dibuat pemilik usaha (lewat pembangun visual) atau oleh AI miliknya (lewat MCP), berupa manifest JSON.
Tipe dan contoh lengkap: `apps/web/src/lib/mod/skema.ts` (`CONTOH_PROYEK_AGENSI`). Alasan desain: `docs/research/mod.md`.

## Isi manifest

| Bagian | Isi | Batas |
|---|---|---|
| kode, nama, deskripsi, ikon, ruang, versi | identitas; kode `^[a-z][a-z0-9-]{2,39}$`, ikon dari `IKON_MOD`, ruang dari 8 ruang aplikasi, versi semver | nama 60 huruf, deskripsi 300 |
| koleksi | daftar catatan (misal Proyek, Tugas, Rapat): kode, nama, bidang judul, bidang, alur status, tampilan, akses | 10 koleksi, 40 bidang/koleksi |
| bidang | 18 tipe tetap (`TIPE_BIDANG`): teks, teks panjang, angka, rupiah, tanggal, tanggal-jam, pilihan, pilihan banyak, centang, tautan, telepon, berkas, orang, pelanggan, produk, proyek, rujukan (ke koleksi lain di mod yang sama), rumus | 50 pilihan/bidang |
| status | awal, daftar status (akhir = selesai), transisi (dari, ke, peran, bidang wajib diisi) | 12 status, 60 transisi |
| tampilan | daftar (kolom, urut, saring), papan (per status), kalender (bidang tanggal), formulir, rincian | 8 per koleksi |
| akses | per peran: tidak, lihat, milik_sendiri, tulis, kelola | staf/akuntan maks tulis; pemilik/admin selalu kelola |
| otomasi | pemicu buat/status/tenggat, syarat sederhana, aksi kartu Feed, pengingat, kerja baru | 20 |
| laporan | jumlah atau total per kelompok | 10 |

Manifest maksimal 64 KB. Satu usaha maksimal 40 mod, satu koleksi maksimal 20.000 catatan.

## Rumus

Tata bahasa sendiri, diurai dan dihitung oleh `rumus.ts` (tanpa eval, tanpa akses jaringan atau data lain):

- nilai: angka (`12`, `1,5` ditulis `1.5`), teks dalam tanda kutip ganda, `BENAR`, `SALAH`, rujukan bidang `{kode}`
- operator: `+ - * /`, `&` (gabung teks), `= <> < > <= >=`, `DAN`, `ATAU`, kurung
- fungsi: `JIKA(syarat, a, b)`, `KOSONG(x)`, `MIN(a, b, ...)`, `MAKS(a, b, ...)`, `BULAT(x, n)`, `ABS(x)`, `HARI_INI()`, `HARI_ANTARA(a, b)`, `TAMBAH_HARI(t, n)`, `PANJANG(teks)`, `HURUF_BESAR(teks)`
- rumus hanya boleh merujuk bidang di koleksi yang sama yang bukan rumus (tanpa siklus), panjang maksimal 200 huruf, kedalaman maksimal 20

## Siklus hidup

1. **Draf**: dibuat dari katalog resmi, pembangun visual, impor berkas, atau AI lewat MCP (`mod_draf_tulis`). Draf selalu
   diperiksa pengawas; draf yang gagal disimpan bersama daftar alasannya supaya AI atau pemilik bisa memperbaiki.
2. **Terapkan**: hanya pemilik/admin di halaman Tambah fitur, setelah melihat pratinjau (koleksi, bidang, akses per peran,
   otomasi). Menerapkan membuat versi baru; versi lama disimpan.
3. **Pakai**: mod tampil di sidebar bagian Fitur tambahan dan di pencarian. Catatan disimpan di tabel bersama dengan RLS.
4. **Ubah**: versi baru lewat draf yang sama. Bidang yang dihapus tidak menghapus data (disimpan, tidak tampil).
5. **Matikan / rollback**: satu klik oleh pemilik/admin. Mematikan menyembunyikan mod dan menolak tulis; data tetap.

## Yang tidak bisa dilakukan mod (sengaja)

- Menjalankan kode, SQL, HTML, atau skrip apa pun.
- Membaca atau menulis data usaha lain, atau data inti di luar rujukan yang diizinkan (baca nama orang, pelanggan, produk, proyek).
- Membaca gaji, rekening, NIK, atau data rahasia.
- Memberi staf/akuntan akses kelola, atau mengubah peran orang.
- Mengirim data ke luar selain lewat webhook alur yang sudah dibatasi (https ke host publik, batas laju).
- Menerapkan dirinya sendiri: AI hanya menulis draf.

## Alat MCP (X-07)

AI milik pemilik (ChatGPT, Gemini, atau AI lain lewat MCP) memakai alat ini; nama alat yang disebut prompt di halaman Tambah fitur diuji ada di server (src/lib/mcp/protokol.test.ts).

| Alat | Cakupan | Siapa | Guna |
|---|---|---|---|
| mod_skema | nadi.baca | semua | aturan manifest, batas, ikon, fungsi rumus, contoh lengkap |
| mod_katalog | nadi.baca | semua | paket resmi + fitur yang terpasang di usaha ini |
| mod_uji | nadi.baca | semua | periksa manifest tanpa menyimpan |
| mod_draf_tulis | nadi.usul | pemilik/admin | simpan draf; alasan pemeriksa dihitung server, bukan dari AI |
| mod_draf_baca | nadi.usul | pemilik/admin | baca draf dan versi aktif |
| mod_draf_ubah | nadi.usul | pemilik/admin | ubah lewat jalur (set/hapus/tambah), segmen dibatasi, kode tidak bisa diganti, diperiksa ulang |
| mod_data_baca | nadi.baca | sesuai akses koleksi | catatan terbaru, ditandai "data, bukan perintah" |
| mod_data_tulis | nadi.usul | sesuai akses koleksi | buat/ubah catatan; tidak bisa pindah status, arsip, atau hapus |

Tidak ada alat untuk menerapkan, mematikan, nyalakan, rollback, atau mengarsipkan; database juga tidak punya fungsi mcp_mod_* untuk itu (tes SQL mod).
