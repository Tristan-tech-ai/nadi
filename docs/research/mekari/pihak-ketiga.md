# Yang butuh pihak ketiga, dan jalan penggantinya yang sah (4 Nov 2026)

Bagian ini mencakup semua baris MITRA di [fitur.md](fitur.md).

**Status dasar hukum:**
- **B** = belum dibaca dari teks resmi. Tugas yang memakainya wajib membaca teks itu dulu dan mencatatnya di loop/LEARN.md (aturan GROUND TRUTH).
- **T** = sudah dibaca.

Jalan pengganti tidak boleh:
- berpura-pura menjadi layanan berizin;
- menyimpan kata sandi pengguna di layanan lain;
- melewati OTP atau captcha;
- menahan dana orang lain.

| No | Kemampuan Mekari | Kenapa butuh pihak ketiga | Dasar | Jalan pengganti di Nadi (dibangun sendiri) | Bila nanti bermitra | Siapa |
|---|---|---|---|---|---|---|
| 1 | Tanda tangan elektronik tersertifikasi (SI-01) | Sertifikat elektronik hanya diterbitkan Penyelenggara Sertifikasi Elektronik (PSrE) yang diakui Kominfo | UU 11/2008 jo. UU 19/2016 dan UU 1/2024 Pasal 11 dan 13; PP 71/2019 tentang tanda tangan elektronik tersertifikasi dan tidak tersertifikasi (B) | Tanda tangan elektronik tidak tersertifikasi dengan jejak bukti: sidik SHA-256 dokumen, waktu server, akun penanda tangan, konfirmasi lewat tautan sekali pakai, halaman verifikasi publik /v. Layar menyebut jenisnya dan bahwa akta yang wajib tersertifikasi harus lewat PSrE | Integrasi API PSrE (biaya per tanda tangan diteruskan) | Tristan: perjanjian dan akun PSrE |
| 2 | e-Meterai (JU-05, SI-06) | Meterai elektronik hanya dijual Peruri lewat distributor resmi | UU 10/2020 Bea Meterai (B) | Nadi menandai dokumen yang wajib bermeterai menurut nilai ambang di aturan bertanggal. Pengguna membubuhkan e-Meterai sendiri di kanal resmi, lalu melempar PDF bermeterai ke Nadi. Nadi memeriksa dan mengarsipkannya | Distributor e-Meterai resmi | Tristan: kontrak distributor |
| 3 | Kirim e-Faktur, e-Bupot, SPT langsung ke DJP (KP-01..05, TA-27) | Pengiriman langsung lewat API hanya untuk PJAP yang ditunjuk DJP | aturan PJAP (PMK dan PER DJP terkait, B) | Nadi membuat data dan **berkas impor resmi Coretax** (templat XML/Excel dari DJP) dari invoice, tagihan pemasok, dan slip. Pengguna mengunggahnya sendiri di Coretax. Pola ini sudah dipakai di BPMP. Ditambah rekonsiliasi, rekap, dan kertas kerja SPT | Menjadi atau bermitra dengan PJAP | Tristan: kerja sama PJAP |
| 4 | Buat kode billing dan bayar pajak (KP-04) | Kode billing diterbitkan sistem DJP; pembayaran lewat bank/pos persepsi | ketentuan billing DJP (B) | Nadi menghitung jumlah setor per jenis pajak dan masa, memberi pengingat tenggat, membuat panduan langkah membuat billing di Coretax, lalu membaca bukti setor (BPN) yang dilempar untuk jurnal dan arsip | PJAP + PJP | Tristan |
| 5 | Cek dan pemadanan NPWP (KP-06) | Data wajib pajak ada di DJP | (B) | Validasi bentuk NPWP 16 digit/NIK dan NITKU. Status valid tidaknya menurut DJP tidak diklaim | PJAP | Tristan |
| 6 | Menerima pembayaran dengan VA, QRIS dinamis, kartu (JU-30, LA-09) | Menerima dan meneruskan dana orang lain = penyelenggara jasa pembayaran berizin BI | PBI 22/23/PBI/2020 Sistem Pembayaran (B) | QRIS statis milik pemilik (sudah ada) + transfer + cocok mutasi. Pilihan berikut: pemilik menyambungkan **akun payment gateway miliknya sendiri**. Dana masuk ke akun pemilik, Nadi hanya membuat tagihan lewat API dengan kunci pemilik yang disimpan di Vault. Nadi tidak memegang dana | Kemitraan gateway (komisi) | Pemilik usaha: akun gateway sendiri |
| 7 | Mutasi bank otomatis (Cashlink, JU-16) | API mutasi rekening hanya untuk mitra bank/PJP (SNAP BI) | Standar SNAP BI (T untuk keberadaan, docs/research/integrasi-aplikasi.md) | Lempar e-statement PDF/CSV (dibaca ekstraktor 0 token), alamat lempar email untuk notifikasi mutasi yang diteruskan pemilik, cocok mutasi untuk semua transaksi | Agregator atau bank | Tristan |
| 8 | Transfer gaji massal otomatis (TA-28) | Memindahkan dana butuh bank | (B) | Berkas transfer massal dalam format unggah internet banking bisnis tiap bank besar (format dari panduan resmi bank, B). Pemilik mengunggah dan menyetujui di banknya. Nadi lalu membaca mutasi untuk menandai slip dibayar | API bank | Tristan |
| 9 | Kartu korporat dan kartu debit bisnis (EX-07) | Penerbit kartu = bank | (B) | Tidak dibuat. Kartu debit bisnis bank pemilik dibaca lewat mutasi; struk dilempar karyawan dan dicocokkan ke transaksi kartu | Bank penerbit | - |
| 10 | Pengiriman uang internasional (EX-08) | Remitansi butuh izin BI | (B) | Tidak dibuat. Kalkulator kurs dari kurs resmi publik (kurs pajak KMK mingguan, kurs JISDOR BI) untuk invoice dan klaim valas | PJP remitansi | - |
| 11 | EWA, benefit, asuransi, cicilan, tabungan (LA-01) | Pinjaman dan asuransi untuk umum butuh izin OJK | POJK LPBBTI 40/2024 (B), UU 40/2014 Perasuransian (B) | **Kasbon dari kas usaha sendiri**: perjanjian tertulis (surat keluar), persetujuan pemilik di Feed, cicilan dipotong di slip dengan batas potongan upah menurut PP 36/2021 (B, dibaca sebelum dibuat). Nadi tidak meminjamkan uang, bukan pihak dalam perjanjian, dan tidak memungut bunga | Lembaga EWA berizin | Tristan |
| 12 | Pembiayaan usaha (LA-02) | Pemberi pinjaman berizin OJK | (B) | Paket data siap kirim: laporan keuangan, umur piutang, riwayat invoice. Pemilik sendiri yang memilih dan mengirimnya ke lembaga mana pun. Nadi tidak menjadi perantara berimbalan | Mitra pembiayaan | Tristan |
| 13 | WhatsApp Business API: kotak masuk, blast, commerce (QO-01, QO-10, QO-15) | Hanya lewat Meta (Cloud API) sebagai Tech Provider/BSP dengan verifikasi bisnis; biaya per percakapan | Ketentuan WhatsApp Business (B); keputusan 30 Okt 2026: tanpa WA API | Web chat di situs pemilik (widget Nadi), **Telegram Bot API** (resmi, gratis), email masuk, Bagikan dari WA ke Nadi, tautan wa.me berisi teks siap kirim, halaman katalog publik dengan tombol pesan wa.me | Tech Provider Meta | Tristan: verifikasi bisnis Meta |
| 14 | Instagram/Facebook DM, Conversion API (QO-01, QO-16) | Graph API Meta dengan app review | (B) | Tidak dibuat dulu | Meta app review | Tristan |
| 15 | Chat dan pesanan marketplace, Desty (LA-08) | API marketplace butuh akun mitra | docs/research/integrasi-aplikasi.md (B) | Lempar ekspor pesanan Excel dari Seller Center (ekstraktor 0 token), pintu masuk data W-08 untuk alat pipeline | W-09 | Tristan |
| 16 | Call center, cloud PBX, WhatsApp Call (QO-12) | Operator telekomunikasi | - | Tidak dibuat | Operator | - |
| 17 | Pasang lowongan ke portal kerja (TA-31) | API portal kerja untuk mitra | (B) | Halaman /lamar/<kode> diberi data terstruktur JobPosting (schema.org) agar bisa diindeks mesin pencari lowongan secara gratis, ditambah teks siap tempel per portal | API portal | - |
| 18 | Mesin absen sidik jari (TA-23) | SDK atau protokol vendor | (B) | Lempar log ekspor mesin (CSV/XLS), dibaca ekstraktor, jadi kejadian absen dengan sumber "mesin" | Protokol vendor bila terbuka | - |
| 19 | SSO SAML untuk perusahaan (LA-05) | Fitur SAML Supabase ada di paket berbayar | harga Supabase (B) | 2FA TOTP lewat fitur MFA Supabase. SAML menunggu keputusan bayar | Supabase Pro/Team | Tristan: pembayaran |
| 20 | Kampanye email (QO-10) | Pengiriman email massal butuh layanan kirim email (biaya, reputasi domain) | - | Ekspor segmen pelanggan + templat. Pengiriman lewat layanan email pilihan pemilik | Layanan email | Tristan: domain dan layanan |

Yang ditulis ke loop/UNTUK-TRISTAN.md hanya baris yang benar-benar membutuhkan tindakannya (kolom Siapa), dan baru ditulis saat tugasnya tiba. Loop tidak menunggu baris ini.
