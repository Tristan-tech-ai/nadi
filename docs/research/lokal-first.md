# Lokal-first, aplikasi desktop/HP, dan open source: kajian kelayakan

Ditulis 3 Nov 2026 atas pertanyaan Tristan. STATUS: DIBATALKAN (keputusan Tristan 3 Nov 2026). Yang dilanjutkan: rencana memangkas biaya
perawatan dengan otomatisasi penuh (docs/research/hemat-otomatis.md) dan grup iterasi desain (docs/design/ITERASI.md).
Angka biaya toko aplikasi dan detail API pihak ketiga di bawah BELUM diverifikasi ke sumber resmi (tandai sebelum dipakai).

## Yang diminta
Aplikasi desktop, Android, dan iOS; semua komputasi (deteksi, perangkum, transkrip) di perangkat pengguna; pasang sekali klik tanpa
terminal atau Docker; gratis, open source, donasi sukarela; Nadi hanya membayar traffic, bukan komputasi.

## Yang sudah realistis hari ini
- PWA sudah terpasang: bisa dipasang di Android dan desktop, di iPhone lewat Tambah ke Layar Utama (Web Push di iOS hanya untuk PWA
  yang dipasang, lebih terbatas).
- AI di perangkat sudah berjalan untuk tiga hal: deteksi meja (RF-DETR nano q8, 28,8 MB, 90 ms/cuplikan di laptop), OCR nota
  (tesseract.js), transkrip wawancara (whisper-small q8). Laptop lancar, HP Android murah lambat tetapi masih bisa.
- Aturan pajak, BPJS, dan paket industri bisa dibagikan sebagai berkas statis (biaya traffic saja).

## Yang bertabrakan dengan inti Nadi
1. Usaha = banyak orang di banyak perangkat (staf absen dari HP, tablet kios, pemilik di luar, akuntan). Data harus bertemu di satu
   tempat. Pilihannya: server sinkron yang di-hosting (komputasi, bukan hanya traffic), peer-to-peer (rapuh di jaringan seluler/NAT),
   atau PC pemilik sebagai server (harus menyala; akses dari luar butuh relay yang dibayar seseorang).
2. Pembaca berkas dan perangkum memakai model bahasa lewat API. Versi lokal butuh model 1 sampai 4 GB, akurasi pada nota Indonesia
   yang berantakan turun, berat di HP. Ekstraktor terkompilasi (aturan, 0 token) mengurangi kebutuhan model, tidak menghapusnya.
3. Arsitektur saat ini bergantung pada Supabase: 88 migrasi, RLS multi-tenant, pg_cron, pg_net, Vault, Realtime, Edge Function.
   Database lokal (mis. Postgres WASM) bisa memakai ulang sebagian SQL, tetapi auth, cron, realtime, dan isolasi harus ditulis ulang.
   Perkiraan: berbulan-bulan, bukan beberapa tick.
4. Risiko pengguna: data gaji dan NIK yang hanya ada di satu laptop hilang bila perangkat rusak/dicuri; wajib ada cadangan terenkripsi
   ke penyimpanan milik pengguna.
5. "Sekali klik" di Windows tanpa tanda tangan kode memunculkan peringatan SmartScreen; tanda tangan kode berbayar. Toko Apple dan
   Google berbayar (Apple tahunan, Google sekali). Ini bertentangan dengan "nol biaya".
6. Donasi jarang menutup perawatan empat platform; biaya terbesar adalah waktu dukungan, bukan server.

## Kesimpulan
Tidak mustahil, tetapi "semuanya lokal + banyak perangkat + sekali klik + nol komputasi + semua platform" sekaligus tidak realistis.

## Usul bertahap
1. Pertahankan versi hosting sekarang untuk yang ingin praktis.
2. Mode "server milikmu sendiri" sekali klik: pengguna masuk ke akun Supabase gratis miliknya, Nadi membuat proyek dan memasang
   migrasi lewat API manajemen, tanpa terminal; komputasi berjalan di kuota gratis pengguna. Paling dekat dengan "hanya bayar traffic".
   Kelayakan (OAuth integrasi Supabase, batas kuota gratis per akun) harus dibaca dari dokumen resmi sebelum dirancang.
3. AI lokal sebagai bawaan; opsi kunci API milik pengguna untuk akurasi lebih tinggi.
4. Aplikasi toko dan desktop bertanda tangan menyusul setelah ada pengguna nyata yang memintanya.
5. Logo dan landing: perlu kerja desain sungguhan (identitas yang lahir dari "kertas kerja yang hidup"), bukan poles; lolos anti-slop
   tidak sama dengan berkarakter. Kriteria terima: uji 5 detik dengan orang sasaran, bukan penilaian loop sendiri.
