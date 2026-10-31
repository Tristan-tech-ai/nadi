# Tampilan staf mentor di /app/magang (lanjutan F2-06)

Ditulis 1 Nov 2026. F2-06 diuji di browser dari sisi pemilik saja; sisi staf yang memakai topi mentor belum pernah dibuka. Catatan ini menjadi kriteria saat layar itu diuji.

## Siapa melihat apa
- Pemilik/admin: semua rencana magang, tarif per jam, Dana Rekrutmen, laporan biaya per rekrutmen (sudah ada).
- Staf bertopi mentor: HANYA rencana peserta yang ia bimbing. Tanpa tarif, tanpa anggaran, tanpa biaya per rekrutmen (angka uang usaha bukan urusan mentor).
- Peserta magang: tidak melihat jam mentornya; ia melihat rencana mingguan dan uji akhirnya sendiri.

## Layar mentor (HP, satu tugas per layar)
- Kepala: "Pesertamu" lalu satu kartu per peserta: nama, minggu ke berapa ("Minggu 3 dari 12"), tujuan topi ("Jadi kasir").
- Rencana minggu ini tampil sebagai daftar periksa pendek, bukan tabel.
- Tombol utama satu: "Catat jam bimbingan" (lembar bawah: tanggal, berapa menit, catatan singkat). Setelah simpan: "Tersimpan. 45 menit bimbingan Sari hari ini."
- Jam yang sudah dicatat bisa dilihat, tidak bisa dihapus; salah catat diperbaiki dengan catatan koreksi (menit negatif tidak dipakai).

## Keadaan
- Kosong: "Belum ada peserta yang kamu bimbing. Pemilik menunjuk mentor saat membuat rencana magang."
- Tanpa izin (staf bukan mentor membuka /app/magang): "Halaman ini untuk mentor dan pemilik. Kalau kamu membimbing peserta, minta pemilik menunjukmu sebagai mentor."
- Galat simpan: "Jam bimbingan belum tersimpan. Coba lagi; isianmu masih ada."

## Kriteria uji (masuk antrean bila RLS saat ini membuka lebih dari ini)
1. Tes SQL: staf mentor membaca rencana_magang miliknya saja, tidak membaca jam_rekrut.tarif atau lowongan.biaya_iklan.
2. e2e: akun staf mentor membuka /app/magang, tidak ada teks "Rp" di layar, bisa mencatat jam.
