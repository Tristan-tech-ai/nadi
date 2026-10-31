# Tinjauan Q-26 sebelum commit (hari ini di database = zona usaha)

Ditulis 1 Nov 2026 (tick 188). Hanya membaca berkas agen yang belum di-commit, supabase/migrations/20261101014000_hari_ini_q26.sql (79 baris) dan supabase/tests/hari_ini_q26.test.sql (214 baris), dibandingkan dengan docs/quality/zona-hari-ini-pemakai.md dan rencana-uji-q26.md.

## Migrasi
- Pola sama dengan Q-24: definisi hidup diambil dengan pg_get_functiondef, lalu hanya ekspresi tanggal diganti. Jumlah kemunculan diperiksa, dan bila definisi akhirnya masih memuat current_date, migrasi gagal. Empat fungsi diubah:
  - app.hitung_lintas_topi: penyaring + pembatas usaha;
  - app.beban_orang: 1 tempat;
  - app.pasang_topi_dari_jabatan: coalesce(p_mulai, app.hari_ini(p_pid));
  - public.simpan_rencana_magang: 2 penyaring + topi mentor.
- Bawaan pakai_topi.mulai di-drop dan diganti pemicu BEFORE INSERT `pakai_topi_mulai`. Isinya sesuai rancangan tick 184, dan putuskan_usulan tidak diubah.
- **Keputusan agen yang di luar rancangan loop:** app.hitung_lintas_topi dijadikan security definer.
  - Alasan: pemicu ini jalan saat klien (authenticated) memasukkan kerja, sedangkan app.hari_ini sengaja tidak bisa dipanggil authenticated (Q-24).
  - Pengaman: search_path kosong (dicek di database, proconfig `search_path=""`), hak execute dicabut dari public/anon/authenticated, dan pencarian pakai_topi dibatasi `p.perusahaan_id = new.perusahaan_id`.
  - Apakah aman: new.perusahaan_id berasal dari baris kerja yang sudah lolos WITH CHECK RLS kerja, jadi klien tidak bisa membuat pemicu membaca topi usaha lain. Hasilnya hanya boolean lintas_topi pada barisnya sendiri. Diterima.
  - Pilihan lainnya adalah memberi authenticated hak execute app.hari_ini. Itu membuka fungsi baru ke klien hanya demi satu pemicu, jadi pilihan agen lebih sempit.
- Daftar putih isi_demo dan demo_lihat diberi komentar alasan (data demo sintetis di hari UTC yang sama). Sesuai rencana.
- Data lama tidak dikoreksi. Ini sesuai catatan tick 184: mulai satu hari lebih awal tidak menghilangkan topi dari hitungan.
- Database: 56 migrasi, terakhir hari_ini_q26; bawaan kolom sekarang null. Sidik belum dicek loop.

## Tes
- Cek struktur:
  - 0 current_date di luar daftar putih;
  - 0 pola UTC setara (now()::date, localtimestamp, current_timestamp::date, date_trunc atas now());
  - komentar daftar putih;
  - hitung_lintas_topi definer + search_path + pembatas usaha;
  - bawaan null dan NOT NULL tetap;
  - pemicu ada dan aktif;
  - hak execute fungsi pemicu tertutup.
- Perilaku diuji untuk dua usaha, Asia/Jakarta dan Asia/Jayapura, melalui:
  - insert klien tanpa mulai;
  - hitung_lintas_topi;
  - pasang_topi_dari_jabatan dan topi impor;
  - beban_orang;
  - insert dari fungsi security definer;
  - simpan_rencana_magang.
- Ada cek "catatan jam uji" yang jujur. Cek perilaku hanya membedakan kode lama dari kode baru bila tanggal lokal berbeda dengan tanggal UTC saat tes berjalan.
- **Peluang sekarang:** jam mesin 1 Nov 03.58 WIB = 31 Okt 20.58 UTC. Sampai 07.00 WIB tanggal lokal berbeda dengan tanggal UTC, jadi tes ulang terpisah yang dijalankan sebelum itu benar-benar menguji perbedaan. Tes ulang harus dijalankan secepatnya, dan jam pelaksanaannya dicatat di bukti.

## Untuk verifikasi loop
1. Sidik berkas = schema_migrations (hari_ini_q26).
2. Tes ulang terpisah oleh agen pembantu: hari_ini_q26, zona_q24, papan_kerja, bagi_adil, peta_organisasi, topi_impor, magang, kpi. Semua gagal=[], dengan catatan jam UTC/lokal.
3. Kueri loop: current_date di pg_proc public/app = 0 di luar daftar putih.
4. get_advisors security tanpa temuan baru untuk dua fungsi definer ini.
5. Commit berkas agen dengan pesan "Q-26: ...", gate, push. Tidak menyentuh aplikasi, jadi e2e produksi tidak wajib. kerja.spec dijalankan sekali terhadap produksi karena hitung_lintas_topi berubah.
- Sidik dicek loop tick 188: berkas = database = 13857dd4. Tes ulang terpisah dimulai 1 Nov ~04.00 WIB (tanggal UTC masih 31 Okt).
- Laporan agen (tick 189): hari_ini_q26 merah 25 gagal (11 struktur + 14 perilaku) lalu 52/52 pada 20.53-20.58 UTC 31 Okt (tanggal lokal 1 Nov); regresi 11 berkas gagal=[]; advisor tanpa temuan untuk dua fungsi pemicu.
- Kueri loop sendiri (tick 189): current_date di fungsi public/app = 0 baris; bawaan pakai_topi.mulai null; pemicu pakai_topi_mulai aktif (O); execute isi_mulai_pakai_topi dan hitung_lintas_topi untuk anon dan authenticated = false.
