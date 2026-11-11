# Model ancaman Nadi Mod (X-19)

Ditulis 11 Nov 2026. Cakupan: fitur tambahan berupa manifest (docs/design/MOD.md). Fitur ini bisa ditulis oleh pemilik, dibuat oleh AI pengguna lewat MCP, diimpor dari berkas, atau dipasang dari katalog resmi. Metode: STRIDE per komponen.

Setiap baris punya kendali dan bukti. Bukti berupa tes yang bisa gagal atau batas yang ditegakkan database. "Database" berarti kendali tetap berlaku walau aplikasi web dilewati, misalnya klien yang memanggil PostgREST langsung dengan token sendiri.

## Komponen dan batas kepercayaan

| Komponen | Siapa yang bisa memberi masukan | Dipercaya? |
|---|---|---|
| Manifest (draf) | Pemilik/admin, AI pengguna lewat MCP, berkas impor | Tidak. Diperiksa pengawas TypeScript, lalu diperiksa lagi di database |
| Penafsir tampilan `/app/mod/[slug]` | Isi manifest aktif dan catatan dari semua peran | Tidak. Dirender sebagai teks React |
| Catatan `mod_record` | Semua peran menurut akses koleksi, AI lewat `mcp_mod_data_tulis` | Tidak. Divalidasi `app.mod_cek_catatan` |
| Alur status dan otomasi | Manifest, dijalankan penafsir tetap | Aksi hanya dari daftar tetap (kartu, pengingat, kerja) |
| Jalur MCP | Token OAuth buram milik pemilik/admin/staf | Token diperiksa `app.mcp_konteks` |
| Berkas fitur (ekspor/impor) | Siapa pun yang memegang berkas | Tidak. Impor = draf biasa |

## Ancaman, kendali, bukti

| # | STRIDE | Ancaman | Kendali | Bukti |
|---|---|---|---|---|
| A1 | Elevation | AI lewat MCP menerapkan, mematikan, atau mengembalikan fitur sendiri | Tidak ada fungsi MCP untuk itu. `mod_terapkan`, `mod_atur` hanya untuk sesi pemilik/admin aktif | mod.test.sql "tidak ada fungsi MCP untuk menerapkan", "staf tidak bisa menerapkan"; uji serangan MCP (docs/quality/uji-mod-mcp.md, 21 percobaan) |
| A2 | Elevation | Manifest memberi staf atau akuntan hak kelola (arsip, pindah status apa pun) | `app.mod_akses` membatasi staf/akuntan paling tinggi tulis, nilai asing menjadi tidak; pemilik/admin selalu kelola | mod.test.sql "akses staf kelola diturunkan ke tulis", "akses nilai asing menjadi tidak", "peran asing tidak punya akses"; mod_batas.test.sql "nilai akses asing ditandai database" |
| A3 | Tampering | Label atau teks manifest berisi skrip (XSS) atau perintah SQL | Pengawas menolak karakter `< > { } [ ] \` $` dan pola skrip/SQL; database `app.mod_teks_aman` menandai ulang; penafsir merender teks React, tidak pernah HTML | pengawas.test.ts (52 serangan); mod_batas.test.sql "label berisi skrip ditandai database walau pengawas aplikasi dilewati", "draf berlabel skrip tidak bisa diterapkan"; tafsir.test.ts "teks pengguna dikembalikan apa adanya" |
| A4 | Tampering | Kode bidang menimpa kolom sistem (`perusahaan_id`, `id`, `status`) atau prototipe objek | Daftar kode terlarang di pengawas dan `app.mod_cek_inti`; catatan disimpan di kolom `data` jsonb, bukan kolom tabel | pengawas.test.ts; mod_batas.test.sql "kode bidang sistem (perusahaan_id) ditandai database"; ubah.test.ts (`__proto__` ditolak di operasi ubah draf) |
| A5 | Tampering | Rumus menjalankan kode, mengambil jaringan, atau macet (regex/rekursi) | Tata bahasa rumus sendiri tanpa eval, daftar fungsi tetap, maks 200 huruf, kedalaman 20, tidak boleh merujuk rumus lain | pengawas.test.ts "rumus eval", "rumus fetch", "rumus terlalu dalam", "rumus lebih dari 200 huruf", "rumus merujuk rumus" |
| A6 | Tampering | Isi catatan tidak sesuai manifest (kunci asing, tipe salah, tautan `javascript:`) | `app.mod_cek_catatan` di setiap tulis: kunci dikenal, tipe, pilihan, batas angka, tautan hanya https | mod.test.sql "9 isi tidak sah ditolak"; tafsir.test.ts "menolak tautan bukan https" |
| A7 | Information disclosure | Catatan atau fitur usaha lain terbaca atau dirujuk | RLS `perusahaan_id = app.pid()` dan keanggotaan aktif; rujukan orang/pelanggan/produk/proyek/catatan dicek usaha yang sama | mod.test.sql "usaha lain tidak melihat mod/catatan", "orang usaha lain tidak bisa dirujuk", "catatan usaha lain tidak bisa dirujuk"; jwt_cabut_q21.test.sql (anggota dicabut tidak membaca walau JWT lama) |
| A8 | Information disclosure | Staf membaca draf atau koleksi yang tidak boleh ia lihat | Kolom `draf` tanpa grant; RLS `mod_record` memakai `app.mod_koleksi_terbaca` | mod.test.sql "staf tidak membaca kolom draf", "staf tidak bisa membaca daftar draf", "staf membaca catatan koleksi yang boleh dilihat" |
| A9 | Information disclosure | Berkas ekspor membocorkan data usaha | Berkas hanya memuat manifest; route khusus pemilik/admin membaca lewat RLS | berkas.test.ts "berkas tidak memuat data usaha"; e2e/mod-versi.spec.ts (tanpa UUID, 404 untuk kode asing) |
| A10 | Tampering | Berkas impor berbahaya atau rusak | Impor memakai pengawas yang sama, menjadi draf bersumber impor, dan baru aktif setelah diterapkan; format atau versi asing ditolak | berkas.test.ts "format asing, versi asing ... ditolak"; e2e/mod-versi.spec.ts "berkas rusak ditolak" |
| A11 | Elevation | Staf mengubah catatan orang lain pada akses milik sendiri, atau memindah status yang bukan haknya | `mod_catatan_inti` memeriksa pembuat/ditugaskan; `mod_catatan_status` hanya transisi di manifest untuk peran itu, wajib_isi ditegakkan | mod.test.sql "milik_sendiri: staf tidak mengubah catatan orang lain", "transisi yang tidak ada ditolak", "wajib_isi hasil ditegakkan", "staf tidak bisa menerima hasilnya sendiri" |
| A12 | Spoofing | Token MCP palsu, kedaluwarsa, atau untuk resource lain | `app.mcp_konteks` memeriksa hash token, resource, cakupan, keanggotaan aktif, 120 panggilan per menit | mod.test.sql "token palsu ditolak"; docs/quality/uji-mod-mcp.md |
| A13 | Repudiation | Tidak tahu siapa mengubah fitur atau catatan, lewat aplikasi atau MCP | `mod_log` mencatat setiap draf, terapkan, matikan, nyalakan, rollback, buat, ubah, status, arsip, beserta jalurnya | mod.test.sql "log mencatat jalur mcp" |
| A14 | DoS | Satu usaha membanjiri dengan banyak fitur | Maks 40 mod per usaha | mod.test.sql "maksimal 40 mod per usaha"; katalog.test.ts (semua paket resmi tetap muat dalam batas) |
| A15 | DoS | Banjir draf dari AI | Maks 60 draf per usaha per jam (P0429) | mod_batas.test.sql "draf ke-60 dalam satu jam masih diterima", "draf ke-61 ditolak"; diuji merah sekali dengan ambang digeser |
| A16 | DoS | Banjir catatan atau perubahan | Maks 2.000 perubahan per usaha per jam, 20.000 catatan per koleksi | mod.test.sql "banjir catatan ditahan 2.000 per jam"; mod_batas.test.sql "catatan ke-20.000 masih diterima", "catatan ke-20.001 ditolak" |
| A17 | DoS | Manifest atau catatan raksasa | Manifest maks 64 KB (fungsi dan constraint kolom), catatan maks 32 KB | mod_batas.test.sql "manifest lebih dari 64 KB ditolak", "catatan lebih dari 32 KB ditolak", "catatan 30 KB masih diterima" |
| A18 | Elevation / SSRF | Otomasi mod memanggil URL dalam jaringan | Otomasi mod hanya kartu, pengingat, atau kerja; tidak ada webhook di mod | pengawas.test.ts (aksi selain kartu/pengingat/kerja ditolak) |
| A19 | Tampering | Mod yang dimatikan diam-diam menghapus atau mengubah data | Matikan hanya menyembunyikan; catatan tetap dan kembali saat dinyalakan; rollback tidak mengubah catatan | mod.test.sql "data tetap ada saat mod mati", "mod mati menolak tulis", "rollback ke versi 1 menyalakan lagi"; e2e/mod-versi.spec.ts |

## Yang belum dan alasannya

- **Kuota penyimpanan berkas** (tipe bidang `berkas`). Formulir mod belum bisa mengunggah berkas; nilai berkas hanya diterima bila jalurnya di folder usaha sendiri. Kuota mengikuti Storage usaha.
- **Batas laju per pengguna** di dalam satu usaha. Batas di atas berlaku per usaha. Anggota yang menyalahgunakan dapat dicabut pemilik, dan pencabutan langsung berlaku (A7).
