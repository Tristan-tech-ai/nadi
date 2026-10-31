# Rencana verifikasi loop untuk Q-22 (pola kerja satu sumber)

Ditulis 1 Nov 2026. Rancangan: docs/research/pola-kerja.md, docs/design/aturan-kerja.md. Diperiksa loop sendiri sebelum `done Q-22`.

1. Sidik migrasi = database; tes SQL dijalankan loop sendiri, hijau; regresi lembur (gaji.spec bagian lembur), jwt_cabut_q21, isolasi_tenant gagal=[].
2. app.pola_kerja(pid) mengembalikan '6_hari' bila pengaturan kosong dan nilai tersimpan bila ada; nilai selain '6_hari'/'5_hari' ditolak saat menyimpan.
3. Hanya pemilik (app.peran_aktif() = 'pemilik') yang bisa mengubah; admin, akuntan, staf, anon ditolak 42501; pemilik yang dicabut dengan JWT lama ditolak (pola Q-21). Perubahan tercatat di audit_log dengan nilai lama dan baru.
4. catat_lembur: usaha pola 6 menolak 'libur_pola_5_hari', usaha pola 5 menolak 'libur_pola_6_hari' dan 'libur_pola_6_hari_jatuh_hari_kerja_terpendek', dengan pesan yang menyebut pola usaha; 'hari_kerja' diterima di kedua pola. Merah dulu sebelum migrasi.
5. Lembur lama tidak berubah setelah pola diganti (bandingkan jumlah baris dan jenis sebelum/sesudah di tes SQL).
6. Lembar dampak menampilkan jumlah lembur libur lama yang nyata (bukan angka karangan).
7. Foto 390/1440 terang/gelap kartu Aturan kerja: dua pilihan dengan angka dan pasal, tanda "dipakai sekarang" teks + centang, satu tombol utama; axe tanpa pelanggaran serius.
8. Vercel READY lalu e2e terhadap produksi (ganti pola di usaha uji, catat lembur jenis salah ditolak, kembalikan pola) dengan --output terpisah.
