# Pola kerja usaha (5 atau 6 hari seminggu): di mana disimpan

Ditulis 1 Nov 2026. Dibutuhkan oleh F3-06 (batas 7 atau 8 jam sehari, hari libur 1 atau 2), F3-07 (upah sehari /25 atau /21, docs/research/upah-harian.md), dan lembur F1-05B.

## Keadaan sekarang (diperiksa lewat execute_sql baca saja dan grep)
- **Tidak ada satu sumber pola kerja per usaha.** Kunci perusahaan.pengaturan yang ada di produksi hanya: demo (2 usaha), demo_jangkar (2), anggaran_rekrut_bulanan (1), tarif_jam_rekrut (1).
- Pola hanya muncul **per baris lembur**: public.lembur.jenis memilih 'libur_pola_6_hari', 'libur_pola_6_hari_jatuh_hari_kerja_terpendek', 'libur_pola_5_hari' (20261031240000_lembur.sql baris 9, batas jam baris 29-30), dipilih pengelola setiap kali mencatat. Tidak ada yang menjaga agar satu usaha konsisten memakai satu pola.
- Kode aplikasi yang menyebut pola: lib/gaji/lembur.ts, bpjs-lembur.ts, aksi-gaji.tsx (label pilihan jenis lembur), plus tes gaji.

## Risiko bila dibiarkan
- F3-06 dan F3-07 masing-masing akan menebak pola sendiri; slip bisa memakai /25 sementara jadwal memakai batas 8 jam (pola 5) untuk usaha yang sama.
- Pengelola bisa mencatat lembur libur pola 5 untuk usaha yang bekerja 6 hari, menghasilkan upah lembur yang salah tanpa peringatan.

## Keputusan
- Satu sumber: `perusahaan.pengaturan->>'pola_kerja'` dengan nilai '6_hari' | '5_hari', bawaan '6_hari' bila kosong (pola paling umum di F&B dan toko; PP 35/2021 Pasal 21 ayat (2) huruf a). Diakses lewat fungsi app.pola_kerja(pid) supaya semua RPC membaca hal yang sama.
- Diatur di /app/perusahaan (kartu "Aturan kerja": "Usahamu bekerja 6 hari seminggu (7 jam sehari) atau 5 hari (8 jam sehari)"), pemilik saja, tercatat di audit.
- catat_lembur: jenis libur dibatasi sesuai pola usaha (pola 6 hanya 'libur_pola_6_hari*', pola 5 hanya 'libur_pola_5_hari'); jenis yang tidak cocok ditolak dengan pesan yang menyebut pola usaha. Lembur lama tidak diubah.
- Tugas ini kecil dan menjadi prasyarat F3-06/F3-07; dicatat sebagai tugas Q-22 di antrean.
