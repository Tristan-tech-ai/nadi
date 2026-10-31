# Serah terima saat karyawan berhenti (F3-07)

Ditulis 1 Nov 2026. Kriteria antrean: "resign di perusahaan demo menghasilkan paket serah terima lengkap; akses dicabut di tanggal efektif". Masalah: saat orang keluar dari UMKM, yang hilang bukan hanya tenaga, tetapi juga pengetahuan (resep takaran, kontak pemasok, cara buka mesin kasir), dan akunnya sering tetap aktif berbulan-bulan.

## Dasar aturan (diverifikasi 1 Nov 2026)
Sumber: PP 35/2021, https://peraturan.bpk.go.id/Download/154582/PP%20Nomor%2035%20Tahun%202021.pdf (PDF hlm 23 dan Pasal 40, 50).
- **Pasal 36 huruf i:** pekerja mengundurkan diri atas kemauan sendiri "harus memenuhi syarat: 1. mengajukan permohonan pengunduran diri secara tertulis selambat-lambatnya 30 (tiga puluh) hari sebelum tanggal mulai pengunduran diri; 2. tidak terikat dalam ikatan dinas; dan 3. tetap melaksanakan kewajibannya sampai tanggal mulai pengunduran diri".
- **Pasal 50:** yang mengundurkan diri dan memenuhi syarat berhak atas "a. uang penggantian hak sesuai ketentuan Pasal 40 ayat (4); dan b. uang pisah yang besarannya diatur dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama."
- **Pasal 40 ayat (4):** uang penggantian hak meliputi "a. cuti tahunan yang belum diambil dan belum gugur; b. biaya atau ongkos pulang untuk Pekerja/Buruh dan keluarganya ke tempat dimana Pekerja/Buruh diterima bekerja; dan c. hal-hal lain yang ditetapkan dalam Perjanjian Kerja, Peraturan Perusahaan, atau Perjanjian Kerja Bersama."

Akibat untuk Nadi: tanggal efektif minimal 30 hari setelah surat diajukan (bila kurang, Nadi memberi peringatan, bukan menolak, karena pemilik boleh menyepakati lain); sisa cuti tahunan yang belum gugur dihitung dari saldo izin (F1-03) dan masuk slip terakhir sebagai komponen "penggantian cuti"; uang pisah hanya dari angka yang diisi pemilik (tidak ada angka bawaan).

## Paket serah terima (dibuat otomatis saat resign disetujui)
1. **Daftar topi dan kerja berjalan**: semua topi orang itu (pakai_topi), kerja status baru/jalan/tunggu (F3-01) dengan usulan penerima pengganti per kerja dari Pembagi kerja adil (F3-02; sebelum ada, orang lain bertopi sama dengan beban terendah).
2. **Rekam Ilmu**: daftar "yang hanya dia tahu" disusun dari jejak: tanggung jawab topi yang hanya dipegang dia, kerja berulang yang selalu dia kerjakan (judul mirip, pg_trgm), pemasok/kontak yang hanya pernah dia tangani. Untuk tiap butir, staf merekam suara 1 sampai 2 menit di HP (pola rekam wawancara F2-03, MediaRecorder + transkrip whisper di perangkat penerima). Transkrip dirapikan menjadi SOP langkah bernomor oleh model ringan, klip asli tetap disimpan.
3. **Akses**: daftar akun dan perangkat: akun staf Nadi (dicabut di tanggal efektif lewat pg_cron: anggota.aktif = false + banned_until di auth untuk akun staf sintetis), langganan push (dinonaktifkan), token kios yang dia buat. Akses di luar Nadi (WA grup, akun bank, kunci toko) tampil sebagai daftar periksa manual yang dicentang pemilik.
4. **Hak keuangan**: sisa cuti x upah harian (sumber Pasal 40 ayat (4) huruf a), uang pisah (isian pemilik), gaji sampai tanggal efektif. Masuk Feed sebagai usulan untuk disetujui, bukan dibayar otomatis.
5. **Wawancara keluar** (opsional, untuk staf): 3 pertanyaan tetap, jawaban hanya dilihat pemilik, tidak memengaruhi hak keuangan apa pun.

## Sinyal risiko beban (bagian F3-07 "sinyal risiko beban")
Peringatan dini sebelum orang resign: beban per jam > 1,5 kali rata-rata tim 3 minggu berturut-turut (F3-02), kerja lintas topi naik, izin sakit naik. Ditampilkan ke pemilik sebagai kalimat angka tanpa label "berisiko keluar" (menghindari stigma; VOICE prinsip 6).

## Uji untuk kriteria
- Tes SQL: resign disetujui -> paket berisi semua topi dan kerja berjalan orang itu; pg_cron di tanggal efektif mencabut keanggotaan (simulasi dengan memanggil fungsi pencabut berparameter tanggal); akun staf yang dicabut tidak bisa membaca data usaha (RLS).
- e2e di usaha demo: ajukan resign, setujui, paket tampil, setelah fungsi pencabut dijalankan akun staf ditolak masuk.
