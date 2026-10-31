# Tinjauan keamanan fase F0-F2 (Q-01)

Tanggal 31 Okt 2026. Cakupan: 31 migrasi (fungsi SECURITY DEFINER, RLS, storage), aplikasi Next (route publik, server action, proxy, header), Edge Function baca-berkas dan push, rahasia di repo dan riwayat git, header produksi.

Cara kerja:
- Dua peninjau baca-saja yang terpisah, satu untuk database dan satu untuk aplikasi, tanpa diberi tahu dugaan temuan.
- Setiap temuan TINGGI dibaca ulang langsung di kode sebelum diperbaiki.
- Perbaikan diuji dengan tes yang merah sebelum perbaikan.
- Pemeriksaan otomatis: `get_advisors` (keamanan dan performa) dan curl header produksi.

## Ringkasan
| Tingkat | Jumlah | Diperbaiki di Q-01 | Dipindah ke tugas |
|---|---|---|---|
| TINGGI | 3 | 3 | 0 |
| SEDANG | 13 | 5 | 8 (Q-11 sampai Q-14) |
| RENDAH/INFO | 14 | 0 | dicatat, sebagian masuk Q-14 |

## TINGGI (semua diperbaiki)
| ID | Temuan | Bukti di kode | Perbaikan | Tes |
|---|---|---|---|---|
| T1 | Pemilik/admin mana pun bisa mengambil alih akun siapa pun yang uuid-nya diketahui. Caranya: ubah `orang.user_id` ke uuid korban lewat REST, lalu `buat_akun_staf` mengganti sandi korban di cabang "akun sudah ada". | `akun_staf.sql` cabang else tanpa cek; hak UPDATE semua kolom `orang` + kebijakan `orang_ubah` hanya klaim | Trigger `orang_jaga_user` menolak klien mengisi atau mengubah `user_id`. `buat_akun_staf` hanya mengganti PIN bila akunnya akun staf sintetis untuk orang itu (email `{kode}-{id}@staf.nadi.local`, metadata staf). Migrasi `keamanan_q01`. | `keamanan_q01.test.sql`: update dan insert ditolak, sandi korban tetap, PIN staf asli tetap bisa diganti |
| T2 | Admin bisa menurunkan atau menonaktifkan pemilik. Admin yang baru dicabut masih bisa mengaktifkan dirinya lagi selama JWT lama berlaku (sampai 1 jam), lalu menetap. | `fondasi.sql` kebijakan `anggota_kelola`: USING hanya `app.pengelola()` (klaim), CHECK hanya menolak peran baru pemilik | Kebijakan baru: `app.anggota_aktif(pemilik/admin)` sungguhan, baris pemilik dan baris sendiri tidak tersentuh, `orang_id` harus milik usaha yang sama. Trigger `anggota_jaga_peran`: ubah peran hanya oleh pemilik. | tes: pemilik tetap pemilik, admin tidak bisa ubah peran, admin dicabut tidak bisa memulihkan, `orang_id` lintas usaha ditolak, pemilik tetap bisa |
| T3 | Unggah tanpa batas yang membebani storage (Free 1 GB) dan biaya AI. Satu tautan lowongan publik = 50 x 10 MB per hari plus 50 panggilan model; `lempar_berkas` tanpa batas per pengguna atau usaha. | `rekrut.sql` `lamar_daftar` kuota per lowongan saja; `lempar_saja.sql` tanpa kuota | Trigger `berkas_batas` (BEFORE INSERT, hari WITA): per usaha 200 berkas/200 MB, platform 2.000 berkas/600 MB, lamaran tanpa akun 300/hari. Angka di `public.konfigurasi` kunci `batas_berkas`. Panggilan AI ikut terbatas karena setiap pembacaan butuh baris berkas. | tes: lewat batas jumlah, MB, dan lamaran ditolak (54000); di bawah batas tetap boleh |

## SEDANG
| ID | Temuan | Status |
|---|---|---|
| S1 | `berkas.jalur` tidak terikat `perusahaan_id`. baca-berkas mengunduh dengan kunci server, jadi berkas usaha lain bisa terbaca bila jalurnya diketahui. | **Diperbaiki**: CHECK `berkas_jalur_usaha` (data lama 0 pelanggaran) |
| S2 | `putuskan_usulan` mengubah berkas lewat `usulan.berkas_id` tanpa filter usaha. | **Diperbaiki**: trigger `usulan_jaga_berkas` |
| S4 | Klien bisa menulis baris `berkas` sendiri (jalur, teks OCR, status), lalu meminta baca-berkas memprosesnya. Ini membuka confused deputy, panggilan AI berulang, dan aturan ekstraktor yang diracuni. | **Diperbaiki**: hak INSERT/UPDATE/DELETE `berkas` dicabut dari authenticated (migrasi `keamanan_q01_berkas`); semua tulisan lewat fungsi server |
| A3 | Open redirect setelah masuk: `/masuk?next=/%09/evil.com` lolos `jalurAman`, lalu browser membuang tab sehingga hasilnya `//evil.com`. | **Diperbaiki**: karakter kendali dan backslash ditolak, hasil parse URL harus tetap di asal yang sama. Tes merah di kode lama (2 gagal), hijau 14/14 |
| H1 | Halaman bisa dimuat dalam iframe (clickjacking tombol Izinkan OAuth dan Setujui Feed). Header produksi sebelum: tanpa X-Frame-Options dan tanpa CSP. | **Diperbaiki**: `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`, `Permissions-Policy` (kamera hanya self). e2e `keamanan.spec` 6 jalur |
| A5 | CV dari `/lamar` (tanpa akun) bisa dibaca model sebagai nota atau Excel karyawan, lalu menjadi usulan uang atau impor orang di Feed. | Q-11 |
| S3 | Kebijakan tulis RLS lain (`orang`, `orang_rahasia`, `lowongan`, `usulan`, `perusahaan`) hanya memakai klaim JWT; anggota yang dicabut masih bisa menulis sampai JWT habis (sampai 1 jam). | Q-12 |
| S4b | Admin bisa melewati aturan khusus pemilik: membatalkan rute usulan uang besar, mengubah `usulan.untuk_peran` langsung, dan mengubah komponen slip yang sudah dilepas pemilik. | Q-12 |
| S5 | Pemilik mana pun bisa merusak demo publik dengan menyetel `pengaturan.demo` di usahanya sendiri. | Q-12 |
| S8 | Staf bisa membaca semua `kejadian` dan `orang` usahanya (mutasi bank, nomor HP, tanggal lahir). | Q-12 (putuskan cakupan baca staf) |
| S6/S7/A7 | Kode absen QR 6 angka dan PIN staf 6 angka tanpa penguncian percobaan; login staf lewat server action terlihat dari IP Vercel. | Q-13 |
| A6 | Edge Function push mengirim ke endpoint https apa pun (SSRF buta, status dikembalikan). | Q-14 |
| A8 | Hasil cek wajah dipercaya dari klien. Sudah dicatat jujur di docs/research/absen.md; sinyalnya akan diperlakukan sebagai sinyal lunak. | Q-13 |

## RENDAH / INFO (dicatat)
- CIMD: DNS di-resolve dua kali (rebinding), body dibaca penuh sebelum cek 5 KB, IPv6 NAT64/6to4 belum ditolak (Q-14).
- `asal()` percaya `x-forwarded-host`. Di Vercel kemungkinan dibatasi ke domain proyek (perlu verifikasi); ganti ke env `NADI_ASAL` (Q-14).
- `app.mcp_konteks` melewati cek resource bila `p_resource` null; pengguna bisa mengosongkan `dicabut_at` token MCP miliknya sendiri; mencabut token akses tidak mencabut refresh token (Q-14).
- Masa berlaku token MCP 30/90 hari; token kios tanpa kedaluwarsa; batas DCR 200/jam bersifat global (Q-14).
- Pesan galat database mentah sampai ke pengguna di beberapa action gaji dan `tools/call` MCP.
- `orang_rahasia` bisa dibuat untuk `orang_id` usaha lain (butuh uuid asing); perbaikan lewat FK komposit.
- `app.kode_acak` memakai `random()`, bukan CSPRNG (kode usaha 6 huruf, bukan rahasia).
- Bukti izin bisa berkas orang lain di usaha yang sama.
- Cookie sesi `@supabase/ssr` tidak httpOnly (bawaan pustaka); CSP belum membatasi skrip karena MediaPipe dari jsDelivr. XSS akan mencuri sesi, jadi skrip pihak ketiga dijaga seminimal mungkin.

## Yang diperiksa dan aman
- `buka_slip`, `kode_absen_kios`, `lowongan_publik`, `lamar_selesai`: token di-hash, kedaluwarsa dan pencabutan diperiksa, keluaran minimal.
- `oauth_tukar`/`oauth_segarkan`: PKCE hanya S256, kode sekali pakai, redirect persis, rotasi refresh, keanggotaan dicek ulang.
- Semua `mcp_*`: token di-hash, keanggotaan dan peran hidup, cakupan, 120 panggilan/menit, `mcp_buat_usulan` 200/hari.
- Semua SECURITY DEFINER memakai `search_path = ''`; `format()` hanya `%I` pada konstanta (tanpa injeksi SQL); fungsi `app.*` sensitif dicabut dari publik.
- Tidak ada hak anon pada tabel tenant; partisi anak dicabut; storage tanpa kebijakan update/delete.
- Tidak ada service-role key, kunci `sk-`, atau rahasia di `apps/web/src`, di repo, maupun di riwayat git (pola `sk-ant-`, JWT, `SERVICE_ROLE_KEY=`, kunci privat). `NEXT_PUBLIC_` hanya URL dan kunci publishable.
- `/slip` dan `/kios/tablet`: token di fragmen URL, halaman statis dengan data diambil di klien, jadi tidak ada data pribadi di cache CDN.
- `/api/mcp` tanpa CORS dan menolak Origin asing; `*` di `/api/oauth/*` aman karena tanpa cookie. Halaman izin OAuth butuh login (proxy + `wajibSesi`), CSRF dijaga cek Origin server action.
- `get_advisors` keamanan: tidak ada temuan baru dari migrasi Q-01; WARN SECURITY DEFINER yang tersisa adalah keputusan yang sudah tercatat di DECISIONS.md.
