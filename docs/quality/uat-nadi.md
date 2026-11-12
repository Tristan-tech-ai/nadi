# UAT Nadi

Dijalankan 12 November 2026 terhadap produksi https://nadi-swart.vercel.app (commit 821bec6) dan, untuk fitur yang migrasinya diuji di database lokal, terhadap Supabase lokal + Next lokal. Semua data sintetis (akun uji A dan B, usaha uji, pelanggan uji).

**Ringkasan:** 59 dari 60 kriteria lulus, 1 diperbaiki dan menunggu uji ulang produksi; 79 dari 81 tes e2e berlaporan JSON lulus pada jalan terakhir (ditambah 2 jalan ulang yang hanya berlog teks).

Tes produksi yang perlu masuk akun dijalankan dengan akun uji sintetis. Mulai iterasi berikutnya, tes produksi yang memerlukan kata sandi dijalankan oleh CI atau oleh Tristan, bukan oleh loop; loop menguji produksi tanpa masuk dan menguji alur bermasuk di database lokal.

## Peran yang diuji

| Peran | Yang diuji |
|---|---|
| Pemilik | Semua area: masuk, Mulai, Lempar, Feed, uang, orang, gaji, jual, barang, Mata, dokumen, otomasi, MCP, fitur tambahan, kerja tim |
| Admin | Aturan kerja baca saja, kelola fitur tambahan, halaman pengelola |
| Akuntan | Ruang akuntan, laporan fitur tambahan |
| Staf | Masuk tanpa email, absen, izin, jadwal, tukar shift, kerja, kasir, klaim, fitur tambahan, kepala divisi |
| Pengunjung dan pelanggan | Mode coba, bantuan, halaman depan, halaman tagihan tanpa akun |

## Masuk dan akun

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Masuk dengan email dan sandi; usaha aktif tercatat di sesi | Masuk, siapkan usaha, periksa klaim usaha di sesi | `auth.spec.ts`, 2 dtk | produksi | Lulus |
| Pemilik | Pemilik usaha lain tidak melihat usaha ini | Masuk sebagai pemilik B, cari usaha A | `auth.spec.ts`, 3 dtk | produksi | Lulus |
| Pemilik | Sandi salah dan sandi pendek diberi pesan jelas | Isi sandi salah, lalu daftar dengan sandi pendek | `auth.spec.ts`, 5 dtk | produksi | Lulus |
| Pemilik | Lupa sandi dan masuk lewat email bekerja tanpa jalan buntu | Lupa sandi, kirim ulang 60 dtk, email belum terdaftar, daftar ulang | `masuk-email.spec.ts`, 3 dtk | produksi | Lulus |
| Pemilik | Verifikasi dua langkah ditegakkan database | Nyalakan 2FA, coba sesi sandi saja, masuk dengan kode, matikan | `akses.spec.ts`, 59 dtk | produksi | Lulus |
| Staf | Staf masuk tanpa email (kode usaha + ID + PIN) dan ditolak di halaman pengelola | Pemilik buat akun staf, staf masuk, buka halaman pengelola | `auth.spec.ts`, jalan ulang produksi 6,3 dtk (log-1b) | produksi | Lulus |

## Mulai dan onboarding

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Daftar Mulai di Nadi tercentang dari data, bisa ditutup dan dipanggil lagi | Tambah orang, barang, invoice di usaha kosong; tutup daftar; panggil dari bantuan | `mulai.spec.ts`, jalan ulang di rantai pindah-mulai 20,2 dtk (log-1c) | produksi | Lulus |
| Pemilik | Setiap daftar kosong menyebut gunanya dan memberi satu langkah pertama | Buka semua halaman pemilik di usaha kosong | `mulai.spec.ts`, satu temuan /app/mod diperbaiki, dibuktikan lokal oleh tambah-fitur.spec.ts; audit penuh di produksi dijalankan ulang oleh CI atau Tristan setelah deploy | produksi | Diperbaiki |
| Pemilik | Draf dari AI pemilik ditinjau, diubah, diterapkan dua klik, dan bisa dibatalkan | Buka draf 20 baris, ubah sel, hapus baris, terapkan, batalkan | `siapkan.spec.ts`, 20 dtk | produksi | Lulus |

## Lempar

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Nota dan KTP yang dilempar menjadi usulan lalu disetujui di Feed | Lempar KTP dan nota di desktop, setujui keduanya | `lempar.spec.ts`, 26 dtk | produksi | Lulus |
| Pemilik | Berkas yang tidak bisa dibaca ditolak dengan pesan jelas | Lempar berkas rusak | `lempar.spec.ts`, 2 dtk | produksi | Lulus |
| Pemilik | Lempar dari HP 390 px sampai disetujui | Lempar nota di HP, setujui | `lempar-hp.spec.ts`, 13 dtk | produksi | Lulus |
| Pemilik | Tanpa sinyal berkas ditahan lalu terkirim sendiri; galat bisa dicoba lagi | Matikan jaringan saat lempar, nyalakan lagi; paksa galat lalu Coba lagi | `lempar-hp.spec.ts`, 9 dtk | produksi | Lulus |

## Feed

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Lima usulan disetujui dengan satu tangan di HP dalam kurang dari 30 detik | Setujui 5 usulan di 390 px | `feed-hp.spec.ts`, 9 dtk | produksi | Lulus |
| Pemilik | Batalkan dalam jendela 4 detik: usulan tetap menunggu | Setujui lalu Batalkan | `feed-hp.spec.ts`, 8 dtk | produksi | Lulus |
| Pemilik | Feed menyebut sisa usulan, halaman berikut, dan saring per jenis | Buka Feed penuh, halaman 2, saring | `feed-penuh.spec.ts`, 39 dtk | produksi | Lulus |

## Uang

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Invoice dengan QRIS terbit, pelanggan membuka tagihan tanpa akun, ditandai lunas atau batal | Buat invoice, buka tautan tagihan, tandai lunas, batal | `invoice.spec.ts`, 34 dtk | produksi | Lulus |
| Pelanggan | Halaman tagihan terbuka tanpa akun dan berubah menjadi lunas | Buka tautan tagihan dari invoice | `invoice.spec.ts`, 34 dtk | produksi | Lulus |
| Pemilik | Mutasi bank dicocokkan dengan invoice beserta alasannya | Unggah CSV mutasi, cocokkan, tandai lunas | `cocok-mutasi.spec.ts`, 20 dtk | produksi | Lulus |
| Pemilik | Rekonsiliasi kas: mutasi, invoice, tagihan pemasok, aturan, batal satu | Unggah mutasi dan cocokkan | `kas.spec.ts`, 13 dtk | produksi | Lulus |
| Pemilik | Neraca seimbang, arus kas cocok, ekspor CSV | Buka laporan keuangan | `buku.spec.ts`, 21 dtk | produksi | Lulus |
| Pemilik | Kompas pajak: profil, batas gabungan, posisi, simulator dengan dasar hukum | Buka kompas pajak | `pajak.spec.ts`, 9 dtk | produksi | Lulus |

## Orang

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Jabatan, atasan, promosi, SP berurutan, pengumuman dibaca staf | Kelola HR administrasi | `hr.spec.ts`, 112 dtk | produksi | Lulus |
| Staf | Absen lewat QR berputar; wajah tidak hidup dan QR rusak ditolak | Buka layar kios, absen dari HP | `absen.spec.ts`, 20 dtk | produksi | Lulus |
| Staf | Izin diajukan; otopilot menyetujui sesuai aturan, sisanya diputuskan pemilik | Ajukan izin | `izin.spec.ts`, 70 dtk | produksi | Lulus |
| Staf | Jadwal shift dan lembur menunggu persetujuan, batas 4 jam | Buat jadwal, ajukan lembur | `jadwal.spec.ts`, 25 dtk | produksi | Lulus |
| Staf | Tukar shift dengan peringatan lembur, disetujui pemilik di Feed | Tawarkan dan ambil shift | `tukar-shift.spec.ts`, 20 dtk | produksi | Lulus |
| Staf | Kerja berpoin dikerjakan staf sampai selesai, durasi nyata tampil | Pemilik tambah kerja, staf mulai dan selesai | `kerja.spec.ts`, 38 dtk | produksi | Lulus |

## Gaji

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Gaji disiapkan dengan PPh 21 TER, disetujui, slip terbuka tanpa akun | Isi gaji, siapkan, setujui, bagikan slip | `gaji.spec.ts`, 19 dtk | produksi | Lulus |
| Admin | Admin hanya membaca aturan kerja; staf tidak melihatnya | Ganti pola kerja sebagai pemilik, buka sebagai admin dan staf | `gaji.spec.ts`, 26 dtk | produksi | Lulus |
| Staf | Klaim dengan foto struk dibaca AI sampai formulir terisi | Foto struk buram, ajukan klaim | `gaji.spec.ts`, 11 dtk | produksi | Lulus |
| Pemilik | Kasbon dicicil di slip dan berkas transfer bank dibuat | Ajukan kasbon, setujui, siapkan transfer | `gaji.spec.ts`, 22 dtk | produksi | Lulus |

## Jual

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Siklus penjualan: penawaran, pesanan, uang muka, surat jalan, invoice, retur | Jalankan satu siklus penjualan | `jual.spec.ts`, 14 dtk | produksi | Lulus |
| Staf | Kasir tetap jual tanpa internet, antrean terkirim saat daring, stok cocok | Jual di kasir luring lalu daring | `kasir.spec.ts`, 17 dtk | produksi | Lulus |
| Pemilik | CRM: pelanggan, deal, tugas, deal menjadi penawaran dan menang | Kelola deal sampai menang | `crm.spec.ts`, 23 dtk | produksi | Lulus |

## Barang

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Produk, stok masuk, invoice mengurangi stok, batal mengembalikan | Buat produk, terima stok, terbitkan dan batalkan invoice | `barang.spec.ts`, 20 dtk | produksi | Lulus |
| Pemilik | Harga grosir, varian, lokasi rak, laporan per gudang | Kelola stok lanjutan | `stok-lanjut.spec.ts`, 7 dtk | produksi | Lulus |

## Mata

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Status meja dari video benar minimal 85%, hanya perubahan yang tersimpan | Putar video korpus di Mata | `mata.spec.ts`, 52 dtk | produksi | Lulus |
| Pemilik | Hitung kunjungan dari video dan peta panas di Peta Usaha | Putar video, buka Peta Usaha | `mata-v2.spec.ts`, 12 dtk | produksi | Lulus |

## Dokumen

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Surat masuk diagendakan lewat Feed, pihak ditaut | Lempar surat, setujui | `surat.spec.ts`, 25 dtk | produksi | Lulus |
| Pemilik | Surat keluar bernomor, PDF A4, verifikasi asli, palsu, dan batal | Buat dan terbitkan surat, periksa QR | `surat-keluar.spec.ts`, 19 dtk | produksi | Lulus |
| Pemilik | Tanda tangan berurutan; salinan yang diubah ditolak verifikasi | Minta dua tanda tangan, ubah salinan | `tanda-tangan.spec.ts`, 18 dtk | produksi | Lulus |

## Otomasi

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Formulir kerusakan parah menjadi kartu Feed, yang ringan tidak | Kirim dua formulir | `otomasi.spec.ts`, 14 dtk | produksi | Lulus |

## MCP

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | AI milik pemilik menyambung lewat OAuth, membaca, dan mengajukan usulan ke Feed | Sambungkan klien MCP, panggil alat | `mcp.spec.ts`, 12 dtk | produksi | Lulus |
| Pemilik | Prompt sambungan memuat alamat server, alat yang ada, dan batasan | Salin prompt lengkap | `prompt-sambung.spec.ts`, 7 dtk | produksi | Lulus |

## Fitur tambahan

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Paket resmi dipasang, dilepas, dipasang lagi tanpa kehilangan data; buat sendiri | Buka Tambah fitur, pasang paket, lepas, pasang lagi | `tambah-fitur.spec.ts`, 13 dtk | lokal | Lulus |
| Pemilik | 21 paket resmi terpasang dengan isi contoh; saran paket per jenis usaha | Pasang semua paket resmi | `katalog-resmi.spec.ts`, 35 dtk | lokal | Lulus |
| Staf | Fitur dijalankan penafsir Nadi: catat, saring, papan, transisi wajib isi, kalender | Buka fitur tambahan, catat dan pindahkan status | `mod.spec.ts`, 20 dtk | lokal | Lulus |
| Pemilik | Fitur disusun lewat formulir tanpa JSON lalu dipakai | Susun 3 isian, terapkan, catat | `pembangun-mod.spec.ts`, 6 dtk | lokal | Lulus |
| Pemilik | Versi fitur bisa dikembalikan, diekspor, diimpor di usaha lain | Kembalikan ke versi 1, unduh, impor | `mod-versi.spec.ts`, 6 dtk | lokal | Lulus |
| Akuntan | Laporan fitur tambahan menampilkan nama, bukan ID; CSV aman dari rumus | Buka Wawasan, unduh CSV | `laporan-mod.spec.ts`, 4 dtk | lokal | Lulus |

## Kerja tim dan proyek

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Kerja dengan porsi, PIC, checklist, dan progres | Atur tim kerja, centang checklist | `kerja-tim.spec.ts`, 5 dtk | lokal | Lulus |
| Staf | Hasil kerja dikirim, revisi wajib beralasan, diterima di Feed | Kirim hasil, minta revisi, terima | `kerja-review.spec.ts`, 9 dtk | lokal | Lulus |
| Pemilik | Proyek dari template, proyek berulang membuka periode | Buat template dan proyek berulang | `proyek-operasional.spec.ts`, 5 dtk | lokal | Lulus |
| Staf | Kepala divisi meninjau hasil kerja anggotanya | Buat divisi dan kepala, kirim hasil anggota | `divisi.spec.ts`, 10 dtk | lokal | Lulus |

## Peran akuntan

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Akuntan | Ruang akuntan: buka klien, NPWP, unduh BPMP sesuai template DJP | Tambah akuntan, buka klien, unduh | `akuntan.spec.ts`, 10 dtk | produksi | Lulus |

## Mode coba

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pengunjung | /demo membuka aplikasi sungguhan, semua layar terbuka, perubahan tidak tersimpan | Buka /demo | `mode-coba.spec.ts`, 17 dtk | produksi | Lulus |

## Bantuan dan halaman depan

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pengunjung | Pusat bantuan, kamus, alat gratis memakai rumus yang sama dengan aplikasi | Buka bantuan, kamus, kalkulator | `bantuan-alat.spec.ts`, 10 dtk | produksi | Lulus |
| Pengunjung | Halaman depan: rekaman layar asli, jenis usaha sama dengan paket aplikasi | Buka landing dan halaman jenis usaha | `halaman-publik.spec.ts`, 2 dtk | produksi | Lulus |

## Skenario DONE-01

| Peran | Kriteria penerimaan | Langkah uji | Bukti | Tempat | Status |
|---|---|---|---|---|---|
| Pemilik | Satu hari di warung: Feed pagi, invoice dibayar pelanggan, Mata, Peta Usaha langsung, alur nyata, Gaji | Jalankan skenario ujung ke ujung (video) | `hari-di-warung.spec.ts`, 56 dtk | produksi | Lulus |

## Temuan dan perbaikan selama UAT

1. Halaman Semua fitur tambahan (/app/mod) saat kosong tidak memberi langkah pertama (audit keadaan kosong gagal di produksi). Diperbaiki: kotak kosong menyebut guna fitur tambahan, tautan Tambah fitur untuk pemilik dan admin, kalimat untuk staf; dijaga e2e tambah-fitur.spec.ts dan audit mulai.spec.ts.
2. mulai.spec.ts memindah usaha aktif akun uji A tetapi tidak ikut rantai tes yang memindah usaha, jadi saat jalan paralel akun staf dari auth.spec.ts dan dua draf AI dari siapkan.spec.ts tercipta di usaha "Uji Mulai E2E". Diperbaiki: proyek pindah-mulai berantai setelah pindah-kolam; data uji dipulihkan tanpa menghapus (keanggotaan staf dinonaktifkan seperti alur berhenti, dua draf dikembalikan ke Warung Uji A).
3. mulai.spec.ts memakai pencari nama orang yang kini juga cocok dengan pilihan kepala dan anggota divisi (bagian Divisi di halaman Orang, X-13), sehingga Playwright menolak karena tiga elemen cocok. Diperbaiki: pencarian dibatasi ke daftar orang.
4. auth.spec.ts (pemilik membuat akun staf) habis batas 30 detik saat halaman Orang di produksi lambat menambah orang (masalah yang sama dengan tugas Q-42). Lulus saat diulang; tombol kini dicari dengan nama lengkap "Tambah orang".
5. mcp.spec.ts mengharapkan 6 alat MCP, padahal server kini punya 17 (alat draf U-04 dan 8 alat fitur tambahan X-07). Daftar yang diharapkan diperbarui; tetap dipastikan tidak ada alat terapkan, matikan, atau rollback.
6. gaji.spec.ts (lembur 4 jam) sekali gagal karena mencatat lembur di produksi butuh lebih dari 10 detik; diulang dan 7 dari 7 tes gaji lulus. Dicatat sebagai bahan Q-42 (kecepatan halaman orang dan gaji di usaha uji besar).
7. Selama jendela paralel yang sama, pajak.spec.ts juga berjalan di usaha "Uji Mulai E2E" dan menyimpan profil pajak di sana; tesnya tetap sah (usaha uji kosong), tetapi tangkapan layarnya tidak dipakai di dokumen ini.
8. Tangkapan halaman penuh menggambar kepala halaman yang lengket di posisi gulir terakhir sehingga kepala tampak dua kali; untuk dokumen ini dipakai bingkai terakhir yang utuh. Aplikasinya sendiri benar.
9. Tes cek wajah absen hanya berjalan pada build lokal dengan penanda uji (NEXT_PUBLIC_NADI_UJI_WAJAH=1), karena penanda itu sengaja tidak ikut build produksi (dijaga gate.sh). Build lokal dengan penanda menjalankan 4 dari 4 tes absen lulus.
10. Dua jalan Playwright bersamaan memakai folder test-results yang sama sehingga berkas jejak satu jalan terhapus (divisi.spec.ts gagal palsu). Diulang dengan folder keluaran terpisah dan lulus; setiap jalan paralel kini memakai --output sendiri.

## Keluaran e2e (jalan terakhir per berkas)

| Berkas | Lulus | Gagal | Dilewati |
|---|---|---|---|
| `absen.spec.ts` | 4 | 0 | 0 |
| `akses.spec.ts` | 1 | 0 | 0 |
| `akuntan.spec.ts` | 1 | 0 | 0 |
| `auth.spec.ts` | 4 | 1 | 2 |
| `bantuan-alat.spec.ts` | 8 | 0 | 0 |
| `barang.spec.ts` | 1 | 0 | 0 |
| `buku.spec.ts` | 1 | 0 | 0 |
| `cocok-mutasi.spec.ts` | 1 | 0 | 0 |
| `crm.spec.ts` | 1 | 0 | 0 |
| `divisi.spec.ts` | 1 | 0 | 0 |
| `feed-hp.spec.ts` | 2 | 0 | 2 |
| `feed-penuh.spec.ts` | 2 | 0 | 0 |
| `gaji.spec.ts` | 7 | 0 | 0 |
| `halaman-publik.spec.ts` | 3 | 0 | 0 |
| `hari-di-warung.spec.ts` | 1 | 0 | 0 |
| `hr.spec.ts` | 1 | 0 | 0 |
| `invoice.spec.ts` | 1 | 0 | 0 |
| `izin.spec.ts` | 1 | 0 | 0 |
| `jadwal.spec.ts` | 1 | 0 | 0 |
| `jual.spec.ts` | 1 | 0 | 0 |
| `kas.spec.ts` | 1 | 0 | 0 |
| `kasir.spec.ts` | 1 | 0 | 0 |
| `katalog-resmi.spec.ts` | 1 | 0 | 0 |
| `kerja-review.spec.ts` | 1 | 0 | 0 |
| `kerja-tim.spec.ts` | 1 | 0 | 0 |
| `kerja.spec.ts` | 1 | 0 | 1 |
| `laporan-mod.spec.ts` | 1 | 0 | 0 |
| `lempar-hp.spec.ts` | 3 | 0 | 3 |
| `lempar.spec.ts` | 2 | 0 | 0 |
| `masuk-email.spec.ts` | 5 | 0 | 0 |
| `mata-v2.spec.ts` | 1 | 0 | 0 |
| `mata.spec.ts` | 1 | 0 | 0 |
| `mcp.spec.ts` | 2 | 0 | 0 |
| `mod-versi.spec.ts` | 1 | 0 | 0 |
| `mod.spec.ts` | 1 | 0 | 0 |
| `mode-coba.spec.ts` | 1 | 0 | 0 |
| `mulai.spec.ts` | 0 | 1 | 1 |
| `otomasi.spec.ts` | 1 | 0 | 0 |
| `pajak.spec.ts` | 1 | 0 | 0 |
| `pembangun-mod.spec.ts` | 1 | 0 | 0 |
| `prompt-sambung.spec.ts` | 1 | 0 | 0 |
| `proyek-operasional.spec.ts` | 1 | 0 | 0 |
| `siapkan.spec.ts` | 1 | 0 | 0 |
| `stok-lanjut.spec.ts` | 1 | 0 | 0 |
| `surat-keluar.spec.ts` | 1 | 0 | 0 |
| `surat.spec.ts` | 1 | 0 | 0 |
| `tambah-fitur.spec.ts` | 1 | 0 | 0 |
| `tanda-tangan.spec.ts` | 1 | 0 | 0 |
| `tukar-shift.spec.ts` | 1 | 0 | 1 |

Angka gagal untuk `auth.spec.ts` dan `mulai.spec.ts` berasal dari jalan pertama yang paralel; jalan ulangnya lulus kecuali audit keadaan kosong yang temuannya diperbaiki (lihat Temuan).

Tes yang dilewati adalah tes untuk proyek lain (misalnya HP atau rantai pindah usaha) atau yang butuh perangkat khusus (kamera dengan wajah, lokasi), bukan kegagalan.

## Perubahan setelah UAT (sejak 821bec6, sampai 12 Nov 2026 18.20 WITA)

UAT di atas dijalankan terhadap produksi pada commit 821bec6. Setelah itu ada 15 commit yang menyentuh `apps/web` atau `supabase`. Setiap baris di bawah menyebut bukti yang benar-benar dijalankan; uji produksi yang butuh masuk akun tidak dijalankan loop (aturan keamanan), jadi kolom Produksi hanya berisi pemeriksaan tanpa masuk atau CI.

| Commit | Perubahan | Bukti lokal | Produksi |
|---|---|---|---|
| b3085bc | Dokumen UAT; keadaan kosong Fitur tambahan dengan langkah pertama; rantai tes pindah-mulai | `tambah-fitur.spec.ts` lulus | temuan /app/mod menunggu uji ulang bermasuk |
| c40145a | Alat gratis bahasa Inggris (/en/alat) | `src/lib/alat/teks.test.ts` 5/5 | `bantuan-alat.spec.ts` 9/9 ke produksi tanpa masuk |
| d1a44b7 | Kalkulator alat gratis memakai isian sebelum hidrasi (Q-43) | e2e Q-43 merah dulu lalu hijau | lulus di produksi |
| ffe4b11 | Halaman Orang hanya merender orang aktif (Q-42) | e2e divisi lokal | ukuran waktu produksi menunggu uji bermasuk |
| ab40b00 | Tes navigasi halaman depan menunggu animasi berhingga sebelum axe (sebelumnya gagal 2 dari 3 di produksi karena waktu) | perubahan tes saja, aplikasi tidak berubah | tidak dijalankan ulang terpisah |
| 907e995 | Koordinator kerja dengan peran kustom `kerja.kelola` (X-13B) | `kelola_kerja_saya.test.sql` 12/12, `koordinator-kerja.spec.ts` | tes SQL 12/12 di produksi (transaksi dibatalkan) |
| 8245545 | Isian jeda di layar Alur (M-20B) | `alur_jeda.test.sql` 23/23, `alur-jeda.spec.ts` | tes SQL 23/23 di produksi |
| 867333b | Tanya data: rentang tanggal bebas dan pertanyaan gabungan (M-22B) | `gabungan.test.ts`, `tanya-gabungan.spec.ts` | Edge Function pelajari-tanya versi 2 (D-FN-TANYA): tanpa token 401, token palsu 403 |
| e66b663 | Mata: label jenis zona, zona Pintu langsung dikenali, hasil hitung selalu tampil (Q-45 sampai Q-47) | `label.test.ts` 3/3, `mata-zona-lokal.spec.ts` | CI hijau, daftar zona tampil benar di rekaman produksi |
| 63521c7 | Isian fitur tambahan yang daftarnya kosong menautkan ke halamannya (Q-48) | `mod-pilihan-kosong.spec.ts` | CI hijau |
| 025d59d | Porsi tim tidak berubah menjadi 0 saat diketik ulang (Q-50) | `kerja-porsi.spec.ts` merah dulu lalu hijau | CI hijau, produksi 200 |
| 5a4fcfb, 0836cc0 | Film halaman depan dan klip fitur diganti video demo v4b (L-VID) | `halaman-publik` e2e | `/video/nadi-demo.mp4` 200, 18.332.304 byte |
| c384d16 | Pesan belajar format jujur: AI dipakai sampai pola cocok dua kali lagi (Q-51) | `belajar.test.ts` merah dulu 2/3 lalu 3/3 | CI hijau |
| 5087b03 | Catatan UU 27/2026 di setiap hitungan ketenagakerjaan (Q-52) | `uu-ketenagakerjaan.test.ts` 3/3, `uu-baru.spec.ts` | catatan tampil di /alat/pesangon, /alat/gaji, /en/alat/pesangon, /kamus/pesangon; tidak di /alat/thr |

Uji asap produksi otomatis (GitHub Actions `asap.yml`, run 43191207176, 12 Nov 2026): 19 lulus, 1 dilewati (tes merah sengaja), 0 gagal.
