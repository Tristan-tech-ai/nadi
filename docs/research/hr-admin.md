# HR administrasi (M-11)

Dibaca 5 Nov 2026.

## Surat peringatan
Sumber: PP 35/2021 (https://peraturan.bpk.go.id/Download/154582/PP%20Nomor%2035%20Tahun%202021.pdf, lapisan teks; hlm 23 dan 52).

- Pasal 36 huruf k: PHK dapat terjadi karena pekerja melanggar ketentuan perjanjian kerja (PK), peraturan perusahaan (PP), atau perjanjian kerja bersama (PKB) dan sebelumnya telah diberi surat peringatan pertama, kedua, dan ketiga berturut-turut, masing-masing berlaku paling lama 6 bulan kecuali ditetapkan lain dalam PK, PP, atau PKB.
- Pasal 52 ayat (1): hak pekerja yang di-PHK karena alasan itu (0,5 kali pesangon Pasal 40 ayat (2), 1 kali UPMK ayat (3), uang penggantian hak ayat (4)). Sudah dipakai di hitungan hak berhenti.
- Penjelasan Pasal 52 ayat (1):
  - SP diterbitkan berurutan. SP pertama berlaku 6 bulan.
  - Pelanggaran lagi dalam masa SP pertama boleh diberi SP kedua, berlaku 6 bulan sejak diterbitkan. Begitu juga SP ketiga (terakhir).
  - Pelanggaran dalam masa SP ketiga dapat menjadi dasar PHK.
  - Bila masa SP pertama sudah lewat, SP berikutnya kembali menjadi SP pertama; berlaku juga untuk SP kedua dan ketiga.
  - PK, PP, atau PKB boleh memuat pelanggaran tertentu yang langsung diberi peringatan pertama dan terakhir.

Yang dibangun (public.beri_sp):
- Tingkat dihitung database dari SP yang masih berlaku pada tanggal pelanggaran, bukan dipilih pengguna.
- Masa berlaku bawaan 6 bulan, bisa 1 sampai 12 bulan bila PK/PP/PKB menetapkan lain.
- Selama SP ketiga atau SP pertama dan terakhir berlaku, SP baru ditolak dengan pesan bahwa pelanggaran itu dapat menjadi dasar PHK. Nadi tidak melakukan PHK; hak berhenti tetap lewat /app/serah-terima.
- Tafsiran: "berlaku 6 bulan sejak diterbitkan" = tanggal SP sampai tanggal yang sama 6 bulan kemudian dikurangi 1 hari.

## Profil kerja, riwayat, bagan
- profil_kerja: jabatan, level, departemen/cost center, atasan langsung, status kerja (PKWTT, PKWT dengan tanggal akhir, harian lepas, magang, paruh waktu).
- riwayat_kerja: setiap perubahan jabatan, level, departemen, atau atasan (masuk, promosi, mutasi, demosi). Perubahan tanggal kontrak saja tidak menambah riwayat.
- Atasan harus orang di usaha yang sama dan tidak boleh membuat lingkaran; database menolak.
- Bagan organisasi digambar dari atasan langsung.

## Pengumuman
- Untuk semua orang atau per peran. Tanda baca per akun; pengelola melihat jumlah anggota aktif sasaran dan yang sudah membaca. Feed menampilkan jumlah yang belum dibaca.

## Daftar periksa
- Onboarding dan offboarding, masing-masing 6 butir bawaan yang dicentang pengelola.

## Belum (M-11B)
- Custom field karyawan.
- Form dan survei.
- Persetujuan bertingkat (atasan langsung, HR, pemilik) dan delegasi saat cuti.
- Templat dokumen bebas (kontrak PKWT, offering) dan cetak SP sebagai surat keluar bernomor.
