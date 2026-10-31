# Log tick

Satu baris per tick: waktu | tugas | hasil | bukti. Terbaru di bawah.

| Waktu | Tugas | Hasil | Bukti |
|---|---|---|---|
| 30 Okt 2026 | persiapan | lingkungan loop dibuat | commit pertama |
| 30 Okt 2026 20:25 | R-01, F0-01 | versi tumpukan terverifikasi; kerangka monorepo, gerbang dan CI hijau | ef0613d, CI success |
| 30 Okt 2026 23:50 | F0-03 + anti-macet | migrasi graf_usaha dan mode hemat ter-apply, tes isolasi 38/38, hook Elicitation, pengawas detak, pre-push | bd8271f |
| 31 Okt 2026 00:25 | F0-02 | Vercel nadi hidup di sin1, e2e produksi 4/4; deploy otomatis menunggu GitHub App | 190336e, dpl_8Jt69GMfm5xAoEaMm4m2TZMU6Zmo |
| 31 Okt 2026 00:50 | D-01 | arah desain, anti-slop + pemeriksa mesin (gerbang slop), suara dan bahasa | 60248d3 |
| 31 Okt 2026 01:20 | D-02 | sistem desain: token teruji kontras, font, ikon, logo, komponen, /dev/komponen; e2e 8/8 | 5401c48 |
| 31 Okt 2026 02:10 | F0-04 | masuk, daftar, buat/pindah perusahaan dengan klaim JWT; e2e auth 5/5; staf kode+ID dipisah F0-04B | 65eb04a |
| 31 Okt 2026 02:45 | F0-10 | korpus sintetis 42 berkas + jawaban + tes keutuhan; checkpoint konteks | 4791ad7 |
| 31 Okt 2026 03:15 | F0-04B | staf masuk dengan kode usaha + ID + PIN; tes SQL 13/13; e2e staf lulus | 49a52bd |
| 31 Okt 2026 03:50 | F0-05 | nav per peran, Feed, manifest + share target, SW luring, ikon; e2e 24/24 + installability CDP | 0b09263 |
| 31 Okt 2026 04:10 | F0-08 | paket industri fnb+toko, pasang_paket; tes SQL 7/7; aturan resmi dipisah F0-08B | 893ddf0 |
| 31 Okt 2026 04:30 | F0-08B | aturan bertanggal: 4 resmi BPJS TK, 4 bertanda belum terverifikasi | d6a9d4d |
| 31 Okt 2026 02:20 | F0-05B | Web Push: VAPID di Vault via Edge Function push, langganan ber-RLS, e2e Chrome terima push FCM, SQL 15/15; tambah F0-05C | 401c0cc |
| 31 Okt 2026 03:00 | F0-06A | fondasi Lempar Saja: bucket ber-RLS, lempar_berkas anti-duplikat, konfigurasi model, pemakaian_ai; SQL 14/14, e2e unggah lulus; F0-06 dipecah A/B/C | 8312beb |
| 31 Okt 2026 03:05 | F0-06B | baca-berkas: eval korpus 10/10, 20 rb token, cache instruksi terbukti, tidak diproses ulang; anyOf ditolak API lalu diganti | 33e0f1a |
| 31 Okt 2026 03:25 | F0-06C, F0-06 | layar Lempar + share target + Setujui/Tolak (putuskan_usulan, SQL 13/13), e2e lempar 2/2, desktop 20/20, axe bersih; Lempar Saja v1 selesai | ed800ba |
| 31 Okt 2026 03:50 | F0-05C | push otomatis usulan baru: cron+pg_net+token Vault, SQL 11/11, e2e 2/2 (pemberitahuan 32,6 dtk) | a1bb53a |
| 31 Okt 2026 04:00 | R-02 | riset Jev: akses TypeSafe + AI Gateway, harga, batas, format; bukti 403/401 tanpa kredensial; fallback; tambah F0-13 deploy, R-02B spike | f31ec68 |
| 31 Okt 2026 04:20 | F0-07A, F0-13 | ekstraktor terkompilasi: pelari aturan + teks PDF tanpa model, vitest 9/9 (18 berkas korpus); F0-13 deploy diblokir sampai GitHub App | 40c5f6f |
| 31 Okt 2026 04:45 | F0-07B | model menulis aturan teruji, berkas kembaran 0 token: eval 4/4, 371/371 bidang; v4 2/4 lalu v5 perbaikan tipe + umpan balik | b8da06f |
| 31 Okt 2026 05:05 | F0-07C, F0-07 | ringkasan_ai + kartu AI 30 hari (SQL merah lalu 6/6, e2e 9/9, axe bersih); ekstraktor terkompilasi selesai | fb9d2a1 |
| 31 Okt 2026 05:20 | R-03 | riset ML di browser terukur: OCR 0,2 dtk per foto, RF-DETR WebGPU 80 ms, Whisper 1,2 dtk/5 dtk; tambah F0-07D | 73163f9 |
| 31 Okt 2026 05:35 | F0-07D1 | OCR foto di perangkat + simpan_ocr (SQL 6/6, e2e 2/2, OCR tersimpan keyakinan 87) | lihat git log |
| 31 Okt 2026 05:45 | F0-07D2 (kode) | baca-berkas memakai teks OCR foto untuk aturan; deploy + bukti di tick berikut | lihat git log |
| 31 Okt 2026 06:25 | F0-07D2, F0-07D | baca-berkas v7: foto nota 0 token lewat OCR (tabel_gabung, uji longgar teks), hafalan nilai dibuang; eval ekstraktor 5/5, bidang 99,2% | 3ec9308 |
| 31 Okt 2026 06:55 | F0-09 (DB) | riset MCP 2026-07-28 + rancangan dua era; migrasi mcp_oauth (OAuth kode+PKCE+penyegar, token terikat usaha/cakupan/resource, 4 alat), tes SQL 31/31 | 8fbca89 |
| 31 Okt 2026 07:40 | F0-09 | server MCP dua era + OAuth 2.1 (CIMD, DCR, PKCE, iss, refresh) + halaman izin; vitest 16, e2e 2/2, axe 0 serius; perbaikan migrasi CIMD lokal | e809280 |
| 31 Okt 2026 08:25 | F0-09B | cabut asisten AI di Usahamu, ringkasan_ai + resources + prompts MCP, kejadian bersumber usulan; SQL 8/8 + regresi 13/13, 6/6; vitest 19; e2e 2/2 | d8a7364 |
| 31 Okt 2026 09:00 | F0-11 | landing dengan demo nota hidup, status fitur jujur; Lighthouse mobile 100/100/100/100, LCP 0,76 dtk; axe bersih 390/1440 terang/gelap | 1e42af3 |
| 31 Okt 2026 09:45 | F0-12 | usaha demo baca-saja /demo + /demo/toko (RPC anon, prerender per jam, cron geser waktu), SQL 12/12, e2e < 3 dtk, Lighthouse 100/100 | 2b73e7a |
| 31 Okt 2026 10:30 | F1-01 | jabatan impor -> topi berporsi (sinonim, topi baru, impor ulang aman), bug tanggal UTC tertangkap tes; SQL 13/13, e2e 30 karyawan bertopi + lintas topi, /app/orang menampilkan topi | e541c26 |
| 31 Okt 2026 11:05 | F1-02 (DB) | riset RFC 6238 + MediaPipe; TOTP 15 dtk di Postgres, kode kios, absen_catat (cek wajah wajib, anti pakai ulang, 1 langkah toleransi); SQL 21/21 | d925264 |
| 31 Okt 2026 11:50 | F1-02 | kios QR berganti 15 dtk + absen staf dengan cek wajah MediaPipe (kedip + menoleh acak) di perangkat; vitest 8/8, e2e 2/2 (kamera tanpa wajah ditolak), SQL 21/21 | 35666c4 |
| 31 Okt 2026 12:05 | F1-03 (riset) | rencana izin/cuti + otopilot ditulis di STATE; cuti tahunan 12 hari dicari, belum terverifikasi dari teks UU (dicatat di LEARN) | lihat git log |
| 31 Okt 2026 09:45 | F0-02B, F0-13 | produksi hidup di Vercel akun tristan-tech-ai (deploy otomatis dari GitHub), uji luar lulus; BLOCKED karena email commit placeholder diperbaiki | 49723c8 |
| 31 Okt 2026 10:15 | R-02B | route /api/cek-jev di produksi; OIDC diterima, AI Gateway 403 butuh kartu kredit; ke UNTUK-TRISTAN, R-02C terblokir; pustaka jev.ts 7 tes; route dihapus | 3285a9f |
| 31 Okt 2026 10:45 | F1-02B | tautan tablet absen tanpa akun: token_kios (tes SQL 20/20, sidik cocok), /kios/tablet, kartu Tablet absen; e2e tablet 2/2 lokal + produksi; uji wajah nyata ke F1-02D (terblokir) | 715e5ac |
| 31 Okt 2026 11:05 | F1-03 (sebagian) | database izin otopilot: kebijakan_izin, pengajuan_izin, ajukan_izin, izin_ringkas, cabang izin.setujui; tes SQL 26/26, regresi 13/13, sidik cocok; UI menyusul | lihat git log |
| 31 Okt 2026 11:30 | F1-03 | izin dan cuti selesai: UI /app/izin, aturan izin di Usahamu, nav Izin; e2e izin lokal + produksi lulus (otomatis 1 hari, 3 hari ke Feed lalu disetujui) | bb225f7 |
| 31 Okt 2026 11:45 | F1-04 | Gerbang Gaji: 6 sinyal siluman, tes SQL 17/17 (0 positif palsu pada korpus 30 karyawan), indeks FK token_kios | lihat git log |
| 31 Okt 2026 12:00 | Q-03 | pemantau kuota Free (DB 34 MB = 6,5%, storage 1,5 MB), peringatan 80%, tes 7/7; cadangan dipisah ke Q-03B | 8213fbc |
| 31 Okt 2026 12:10 | F1-05 (sebagian) | riset aturan gaji resmi (dicek manual 3 baris TER + 1 contoh), modul PPh 21 TER/BPJS/lembur, tes 14/14 cocok contoh resmi, merah sengaja terbukti | 8eb9c94 |
| 31 Okt 2026 12:25 | F1-05 (sebagian) | database slip gaji: aturan resmi termuat, periode/slip/tautan aman, tahan otomatis Gerbang Gaji, kunci setelah disetujui; tes SQL 27/27, sidik cocok | lihat git log |
| 31 Okt 2026 12:45 | F1-05 (sebagian) | susun slip + layar Gaji + halaman slip publik; tes gaji 19/19; isian gaji per orang dan e2e menyusul | lihat git log |
| 31 Okt 2026 13:05 | F1-05 | slip gaji selesai: isian gaji/PTKP, layar Gaji, slip tautan; e2e lokal + produksi (PPh 21 Rp125.448, neto Rp7.634.552); F1-05B lembur ditambahkan | c7042d0 |
| 31 Okt 2026 13:10 | F1-06 (mulai) | rancangan docs/research/keputusan.md: jejak, pembatalan, p50, titik pakai izin.otopilot dan usulan.rute | lihat git log |
| 31 Okt 2026 13:25 | F1-06 (sebagian) | database gerbang keputusan: jejak, pembatalan membalik akibat, rute usulan uang besar ke pemilik, p50/p95; tes SQL 22/22; kartu UI menyusul | lihat git log |
| 31 Okt 2026 13:40 | F1-06 | gerbang keputusan selesai: kartu jejak + batal, regresi SQL lulus, e2e lokal + produksi, p50 izin 11,1 ms / rute 1,2 ms; F1-06B tingkat model ditambahkan | 2640a2b |
| 31 Okt 2026 13:50 | F2-01 (mulai) | rancangan docs/research/rekrut.md: lowongan per topi, /lamar/<kode> tanpa akun, RPC anon berbatas laju, baca-berkas lewat jalur token internal | lihat git log |
| 31 Okt 2026 14:05 | F2-01 (sebagian) | migrasi rekrut: lowongan berkode, lamar tanpa akun berbatas laju, unggah CV anon terbatas, pg_net ke baca-berkas; tes SQL ditulis | lihat git log |
| 31 Okt 2026 14:15 | F2-01 (sebagian) | tes SQL rekrut menemukan kebijakan Storage anon membaca berkas tanpa izin; diperbaiki migrasi rekrut_slot (fungsi security definer); tes diperketat; 21/21 | 43c8fe0 |
| 31 Okt 2026 14:25 | F2-01 (sebagian) | baca-berkas: jalur internal x-nadi-token, klaim status antre, usulan bersumber lamar; deploy didelegasikan ke agen dengan cek hash | 1b524dd |
