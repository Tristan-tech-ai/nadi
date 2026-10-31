# Rencana verifikasi loop untuk Q-24 (zona usaha, bukan WITA tetap)

Ditulis 1 Nov 2026 saat Q-24 dikerjakan agen latar. Rancangan dan bukti masalah: docs/quality/zona-fungsi.md. Diperiksa loop sendiri sebelum `done Q-24`.

1. Sidik migrasi zona_usaha_q24 = database (54 migrasi bila tidak ada migrasi lain).
2. Struktur: kueri loop sendiri atas pg_proc: 0 baris 'Asia/Makassar' di public/app selain cadangan coalesce(zona_waktu, ...) dan daftar putih app.isi_demo / app.ukur_kuota; 0 `current_date` di putuskan_usulan.
3. Diff per fungsi (definisi hidup sebelum vs sesudah, diambil loop sendiri dari berkas migrasi): hanya baris zona yang berubah; tidak ada perubahan logika lain yang menyelinap (terutama putuskan_usulan, gerbang_gaji, ajukan_izin).
4. Data lama: kueri bukti seperti tick 169 diulang: kejadian izin.* usaha Asia/Jakarta kini jatuh di tanggal lokal = pengajuan_izin.mulai (0 di hari sebelumnya); jumlah baris di audit_log dengan aksi 'koreksi_zona_q24' = jumlah yang dikoreksi; tidak ada baris kejadian yang hilang (hitung total kejadian izin sebelum = sesudah).
5. Tes zona_q24 dijalankan agen pembantu terpisah, hijau; regresi izin_otopilot, papan_kerja, kpi, bagi_adil, peta_organisasi, jwt_cabut_q21, isolasi_tenant, keputusan gagal=[].
6. get_advisors security: tidak ada fungsi baru di daftar anon.
7. Produksi: Vercel READY (bila apps/web berubah) dan e2e izin.spec + peta.spec terhadap produksi lulus dengan --output terpisah.
8. WITA tersembunyi lewat '+08' / app.tanggal_aman (temuan tick 178): putuskan_usulan tidak lagi memakai tanggal_aman untuk waktu kejadian; kueri ulang: kejadian uang.keluar sumber lempar di usaha Asia/Jakarta tidak ada lagi yang 23.00 lokal hasil tengah malam WITA (sebelumnya 20/20); cek struktur menandai '+08' dan tanggal_aman.
