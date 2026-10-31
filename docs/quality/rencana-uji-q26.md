# Rencana verifikasi loop untuk Q-26 (hari ini di database = zona usaha)

Ditulis 1 Nov 2026 (tick 183), sebelum Q-26 dikerjakan. Sumber: laporan akhir agen Q-24 (yang tidak selesai) dan kueri loop ke pg_proc / information_schema hari ini.

## Keadaan sekarang (kueri loop, tick 183)
- current_date di fungsi public/app: app.beban_orang (2), app.hitung_lintas_topi (2), app.pasang_topi_dari_jabatan (1), public.simpan_rencana_magang (3). Tidak ada yang lain.
- Bawaan kolom: hanya public.pakai_topi.mulai = CURRENT_DATE.
- Pola lain yang setara (now()::date, localtimestamp, date_trunc hari/minggu/bulan atas now()): hanya app.isi_demo dan public.demo_lihat. Keduanya usaha demo berzona tetap, masuk daftar putih dengan komentar alasan.

## Kenapa satu migrasi
pasang_topi_dari_jabatan mengisi pakai_topi.mulai, sedangkan hitung_lintas_topi dan beban_orang menyaring `mulai <= hari ini`. Kalau hanya sebagian yang diganti, antara 00.00 lokal dan 07.00 WIB (00.00 UTC) topi yang baru dipasang memakai tanggal lokal sementara penyaring masih memakai tanggal UTC. Akibatnya topi itu tidak terhitung sampai pagi.

## Catatan rancangan
Bawaan kolom tidak bisa membaca kolom lain (perusahaan_id), jadi `default app.hari_ini(perusahaan_id)` tidak sah. Pilihannya:
- (a) trigger BEFORE INSERT yang mengisi mulai bila null; atau
- (b) bawaan dihapus dan setiap penulis mengisi mulai sendiri.

Pilihan (a) lebih aman karena penulis lama (impor, putuskan_usulan, peta organisasi) tidak perlu diubah. Hasil yang diharapkan: bawaan kolom tidak lagi CURRENT_DATE, dan cek struktur juga membaca information_schema.columns.

## Yang diperiksa loop sebelum `done Q-26`
1. Kueri yang sama dengan di atas setelah migrasi:
   - current_date di fungsi public/app = 0, selain daftar putih yang berkomentar alasan;
   - bawaan pakai_topi.mulai bukan CURRENT_DATE.
2. Tes struktur dibuat merah dulu terhadap database sekarang (4 fungsi + 1 kolom), lalu hijau.
3. Tes perilaku di transaksi yang dibatalkan, untuk usaha Asia/Jakarta dengan waktu 00.30 WIB (17.30 UTC hari sebelumnya):
   - pasang topi lalu hitung_lintas_topi: topi langsung terhitung;
   - beban_orang memuat kerja hari itu;
   - simpan_rencana_magang menerima tanggal mulai hari ini lokal dan menolak kemarin bila aturannya begitu.
4. Cara memalsukan jam: tidak bisa mengubah now() di Supabase. Tes memakai fungsi yang menerima tanggal acuan, atau membandingkan app.hari_ini(pid) dengan (now() at time zone zona)::date untuk dua zona yang berbeda tanggal pada jam uji. Bila tidak ada jam yang memisahkan tanggal saat tes dijalankan, cukup cek struktur ditambah cek bahwa fungsi memanggil app.hari_ini, dan keterbatasan ini ditulis jujur di bukti.
5. Regresi: papan_kerja, bagi_adil, peta_organisasi, topi_impor, magang, zona_q24, kpi; semuanya gagal=[].
6. Sidik berkas = database; get_advisors security tanpa temuan baru; pembantu baru tanpa execute anon/authenticated.
7. Tidak menyentuh aplikasi; bila menyentuh, Vercel READY dan e2e magang.spec di produksi dengan --output terpisah.
