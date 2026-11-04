# Kalender kepatuhan (M-25)

Dibaca 5 Nov 2026.

## Sumber
- PMK 81/2024 (sudah dibaca di M-09B): setor PPh tgl 15 bulan berikutnya (Pasal 94 ayat (2)), lapor SPT Masa PPh 20 hari setelah masa (Pasal 171 ayat (1)), setor dan lapor PPN akhir bulan berikutnya (Pasal 94 ayat (3) huruf e, Pasal 171 ayat (13)); libur digeser (Pasal 100, 173).
- PP 44/2015 Pasal 21 ayat (2): pemberi kerja membayar iuran JKK dan JKM setiap bulan paling lambat tanggal 15 bulan berikutnya; ayat (3): bila tanggal 15 jatuh pada hari libur, dibayar pada hari kerja berikutnya; Pasal 22: denda 2% per bulan keterlambatan. https://peraturan.bpk.go.id/Download/28927/PP%20Nomor%2044%20Tahun%202015.pdf
- Perpres 82/2018 Pasal 39 ayat (1): pemberi kerja memungut, membayar, dan menyetor iuran jaminan kesehatan paling lambat tanggal 10 setiap bulan; ayat (4): bila tanggal 10 jatuh pada hari libur, dibayar pada hari kerja berikutnya. https://peraturan.bpk.go.id/Download/254897/Perpres%20Nomor%2082%20Tahun%202018.pdf
- Permenaker 6/2016 Pasal 5 ayat (4): THR paling lambat 7 hari sebelum Hari Raya (M-10).
- PP 35/2021 Penjelasan Pasal 52 ayat (1): masa berlaku SP (M-11).

## Belum diverifikasi
- Perubahan Perpres 82/2018 (75/2019, 64/2020, 59/2024) belum dicek untuk Pasal 39.
- Tenggat iuran JHT (PP 46/2015) dan JP (PP 45/2015) belum dibaca; kalender menulis dasar PP 44/2015 untuk JKK dan JKM saja. Dalam praktik satu tagihan BPJS Ketenagakerjaan memuat keempat program.
- THR untuk hari raya selain Idulfitri tidak dihitung otomatis karena Nadi tidak menyimpan agama karyawan.

## Yang dibangun
- app.tenggat_kepatuhan: satu daftar tenggat per usaha (pajak, BPJS bila ada karyawan aktif, THR, kontrak PKWT, SP berakhir, izin usaha). PPN hanya untuk usaha yang mengisi identitas pajak sebagai PKP.
- Pergeseran libur memakai app.hari_kerja_pajak yang sama dengan kalender pajak (Sabtu, Minggu, libur nasional, cuti bersama 2026).
- public.kalender_kepatuhan untuk pemilik, admin, akuntan; /app/kepatuhan menampilkan 90 hari ke depan.
- izin_usaha (NIB, PIRT, halal, BPOM, lainnya) dengan pengingat_hari.
- Cron harian 23.00 UTC (07.00 WITA) membuat kartu info.kepatuhan di Feed pemilik untuk tenggat 7 hari ke depan; izin usaha sejak pengingat_hari. Kunci per tenggat, jadi kartu tidak dobel. Push mengikuti cron nadi-push-usulan.
- Tanggal THR yang jatuh pada akhir pekan tidak digeser, karena aturannya "paling lambat"; pembayaran sebelum tanggal itu tetap tepat waktu.
