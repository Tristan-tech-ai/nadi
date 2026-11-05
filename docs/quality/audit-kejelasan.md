# Audit kejelasan tombol (U-11, 6 Nov 2026)

Pertanyaan per tombol: sebelum menekan, apakah orang tahu apa yang terjadi dan di mana hasilnya terlihat? Sumbernya NN/g (visibility of system status, match between system and the real world) dan ANTI-SLOP S55-S57.

**Cara.** e2e/audit-kejelasan.spec.ts membuka setiap halaman di peta ruang:
- sebagai pemilik: 53 halaman, 399 tombol;
- sebagai staf: akun staf sementara yang dinonaktifkan lagi sesudahnya, 18 halaman, 54 tombol.

Spec itu mengumpulkan nama aksesibel setiap tombol beserta judul bagian terdekatnya. Tombol yang hanya berlabel satu kata kerja umum tanpa objek ditandai, begitu pula tombol tanpa nama. Semua label unik lalu dibaca manual.

## Temuan dan perbaikan

| No | Halaman | Temuan | Perbaikan |
|---|---|---|---|
| K-01 | Lempar, Feed | Kartu usulan tidak menyebut apa yang terjadi bila disetujui; berkas tak dikenal tidak jelas masuk ke mana | U-10: "Kalau disetujui: ..." dan "Lihat di ..." (a9b6967) |
| K-02 | Lempar, Feed | Tidak ada rincian apa yang ditambah, diubah, atau dilewati | U-13: Lihat rincian, Sekarang -> Jadi (f4aad8d) |
| K-03 | Orang | "Tambah" tanpa objek | "Tambah orang" |
| K-04 | Akuntansi lanjutan, Cabang dan proyek | "Tambah" tanpa objek | "Tambah ke daftar" |
| K-05 | Alur otomatis (pemilik dan staf) | "Kirim" di Isi formulir; menurut VOICE, Kirim hanya untuk yang benar-benar terkirim ke orang lain | "Kirim isian" |
| K-06 | Usahamu, daftar usaha | Belasan tombol "Buka" berurutan dengan nama aksesibel yang sama | Nama aksesibel "Buka <nama usaha>"; tampilan tetap "Buka" |
| K-07 | Usahamu, Aturan izin dan cuti | Tiga "Simpan" tanpa objek | Nama aksesibel "Simpan sakit/izin/cuti" |
| K-08 | Usahamu, Lokasi dan kunci absensi | "Simpan" untuk kunci bulan | "Simpan kunci bulan" |
| K-09 | Sidebar | Angka statis, ikon ganda, cara menyematkan tidak dikenal | U-09/U-12: lencana hanya untuk yang bisa ditindak, ikon unik, pin pola umum |

## Yang diterima apa adanya

- "Setujui" dan "Tolak" di kartu Feed: konteksnya kartu, dan sekarang ada kalimat akibatnya.
- "Cari" di Surat masuk: konvensi kotak cari.
- Tidak ada tombol tanpa nama (0 dari 453).
- Halaman staf hanya punya satu temuan (K-05).
