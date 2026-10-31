# Akses dengan JWT lama setelah anggota dicabut

Diperiksa 1 Nov 2026 (tick 155) lewat execute_sql baca saja dan satu tes di transaksi yang dibatalkan (raise exception). Pemicu: rancangan F3-07 (docs/research/serah-terima-sql.md) mencabut anggota di tanggal efektif.

## Cara kerja sekarang
- app.pid(), app.prn(), app.pengelola() membaca klaim app_metadata dari JWT, tidak membaca tabel.
- app.anggota_aktif() dan app.orang_saya() membaca public.anggota (aktif = true), jadi langsung tertutup saat dicabut.
- Trigger app.sinkron_klaim_anggota (fondasi baris 134-146): saat anggota.aktif menjadi false, pid dan prn dihapus dari raw_app_meta_data. Token baru (setelah refresh) tidak lagi membawa usaha itu. Yang terbuka hanyalah **JWT akses yang sudah terbit**, sampai kedaluwarsa (bawaan Supabase 3600 detik; nilai proyek belum dicek di dasbor).

## Bukti (tes di transaksi dibatalkan)
Staf sintetis dengan JWT {pid, prn: staf}, lalu anggota.aktif = false dengan JWT yang sama:
`aktif: topi=1 kebijakan=1 orang=1 | dicabut (JWT lama): topi=1 kebijakan=1 orang=0 | app_metadata setelah cabut={}`.
Artinya kebijakan berbasis anggota_aktif (orang) langsung tertutup, kebijakan yang hanya membandingkan pid tetap terbuka.

## Kebijakan SELECT/ALL yang hanya bergantung pada klaim (17)
anggota_baca (cabang perusahaan_id = pid), aset_baca, audit_baca (+ prn pemilik), berkas_baca (+ pengelola klaim atau pengunggah), ekstraktor_baca, kebijakan_izin_baca, keputusan_baca (+ pengelola klaim), langganan_push_milik, mcp_token_milik, pakai_topi_baca, pemakaian_ai_baca (+ pengelola klaim), pengetahuan_baca, periode_gaji_baca, ringkasan_harian_baca, tempat_baca, topi_baca, usulan_baca (+ prn = any(untuk_peran)).

## Penilaian
- Jendela paling lama = umur JWT akses (bawaan 1 jam). Tidak ada jalan memperpanjang: refresh menghasilkan token tanpa pid.
- Paling berisiko: admin yang dicabut masih membaca **usulan** (nama pelamar, nominal uang), **keputusan**, **berkas** (nota, CV), **audit_log** (pemilik) selama sisa umur token. Staf yang dicabut membaca topi, tempat, aturan izin, ringkasan_harian (perlu dicek apakah memuat data per orang), periode_gaji (status saja, bukan slip; slip_gaji memakai orang_saya).
- Saat ini belum ada layar yang menonaktifkan anggota (grep: tidak ada `set aktif = false` di kode), jadi celah ini belum bisa dipicu dari aplikasi; F3-07 akan menjadi pemicu pertama.

## Perbaikan (Q-21)
Tambahkan `and (select app.anggota_aktif())` pada 17 kebijakan di atas (cabang auth.uid() milik sendiri di anggota_baca/langganan_push/mcp_token tetap, karena itu data pengguna itu sendiri). Harga kecil: anggota_aktif dipanggil sekali per kueri lewat initPlan `(select ...)`. Tes SQL: ulang tes di atas untuk ke-17 tabel (JWT lama setelah dicabut = 0 baris), regresi isolasi_tenant, keamanan_q12, bagi_adil, papan_kerja, usulan_pemilik_q17; get_advisors tanpa temuan baru.
