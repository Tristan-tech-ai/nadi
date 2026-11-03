# Rencana: murah dirawat, tetap hampir sepenuhnya otomatis

Ditulis 3 Nov 2026 atas keputusan Tristan (lokal-first dibatalkan; lihat docs/research/lokal-first.md). Tujuan: "menembus tembok"
antara aplikasi otomatisasi lengkap tetapi mahal dan aplikasi murah tetapi serba manual. Nadi harus otomatis seperti yang mahal,
dengan biaya operasi seperti yang murah. Setiap trik di bawah diukur, bukan diklaim.

## Sasaran yang bisa diuji
- Biaya operasi per usaha per bulan (server + token AI + storage + egress) diukur otomatis dan ditampilkan untuk loop; target awal
  ditetapkan dari angka nyata setelah 30 hari, lalu diturunkan per kuartal.
- Lebih dari 80% berkas dibaca tanpa model (aturan atau ekstraktor terkompilasi), diukur dari pemakaian_ai.
- Nol pekerjaan rutin manual untuk tim Nadi: tidak ada pemeriksaan harian yang dilakukan manusia.

## Trik yang dipakai (sudah ada = S, baru = B)
1. Tangga kecerdasan (S): aturan pasti, lalu ekstraktor terkompilasi (0 token), lalu model kecil, model besar hanya bila keyakinan
   rendah. Baru (B): ukur rasio per jenis berkas dan buat ekstraktor otomatis untuk tata letak yang paling sering memakan token.
2. Bank Data (S): berkas sama (sha256) tidak dibaca dua kali; (B) hasil baca dipakai ulang lintas usaha untuk dokumen publik yang
   identik (template formulir pemerintah, label kemasan) tanpa membuka data pribadi.
3. Komputasi di perangkat pengguna (S): deteksi meja, OCR, transkrip berjalan di peramban; server hanya menerima hasil. (B) Pindahkan
   lebih banyak pekerjaan berat ke perangkat bila akurasinya setara (diukur di korpus).
4. AI milik pengguna lewat MCP (S): asisten AI pengguna sendiri membaca dan mengusulkan; biaya tokennya di langganan mereka, bukan di
   Nadi. (B) Jadikan jalur utama untuk ringkasan dan tanya-jawab, bukan fitur tambahan.
5. Kerja malam sekali jalan (S): Analis Malam lewat Message Batches (diskon 50%), insight disusun SQL; (B) satukan semua kerja
   berkala model ke satu batch malam.
6. Database mengerjakan logika (S): RPC set-based dan pg_cron, bukan banyak panggilan fungsi serverless. (B) Audit panggilan fungsi
   Vercel per halaman dan pangkas yang tidak perlu.
7. Halaman publik di-cache (S): use cache + CDN untuk landing dan demo. (B) Lighthouse dan ukuran JS per halaman jadi gerbang.
8. Storage hemat (S): foto 1600 px q0,7, suara 32 kbps, kejadian mentah 90 hari, ringkasan harian. (B) Arsip berkas lama ke format
   lebih kecil otomatis.
9. Pagar kuota (S): ukur_kuota harian, peringatan 80%, batas harian AI per usaha. (B) Biaya per usaha per bulan tercatat dan dilaporkan.
10. Operasi yang memperbaiki diri (S sebagian: rute usulan macet, cabut akses berhenti). (B) Uji asap produksi terjadwal yang membuka
    halaman utama dan alur inti tiap hari; kegagalan menjadi tugas fix otomatis di antrean loop. (B) Cadangan mingguan otomatis (Q-03B).
11. Dukungan tanpa manusia (S sebagian: /panduan, pesan galat yang menyebut langkah). (B) Bantuan sesuai layar dan keadaan kosong yang
    mengajari; pertanyaan umum dijawab dari dokumen panduan, bukan tim.

## Yang tidak dilakukan
- Tidak memotong otomatisasi demi biaya; bila trik menurunkan akurasi di korpus, trik itu ditolak.
- Tidak memakai kunci AI gratis untuk data nyata; tidak memakai layanan berbayar tanpa keputusan Tristan.

## Tugas antrean
H-01 biaya per usaha per bulan; H-02 rasio baca tanpa model per jenis + ekstraktor otomatis; H-03 uji asap produksi terjadwal;
H-04 audit fungsi serverless dan JS per halaman; H-05 MCP sebagai jalur utama ringkasan (lihat loop/WORK_QUEUE.json).
