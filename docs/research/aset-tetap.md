# Aset tetap (M-06)

Dibaca 5 Nov 2026: UU 7/2021 (HPP), angka yang mengubah Pasal 11 UU PPh. https://peraturan.bpk.go.id/Download/178620/UU%20Nomor%207%20Tahun%202021.pdf

## Pasal 11 UU PPh
- Ayat (1): penyusutan harta berwujud bermasa manfaat lebih dari 1 tahun (kecuali tanah berstatus hak milik, HGB, HGU, hak pakai) dalam bagian sama besar selama masa manfaat.
- Ayat (2): selain bangunan, boleh dalam bagian menurun dengan tarif atas nilai sisa buku; pada akhir masa manfaat nilai sisa buku disusutkan sekaligus; taat asas.
- Ayat (3): mulai bulan dilakukannya pengeluaran (harta dalam pengerjaan: bulan selesai).
- Ayat (6): Kelompok 1 4 tahun (25% / 50%), Kelompok 2 8 tahun (12,5% / 25%), Kelompok 3 16 tahun (6,25% / 12,5%), Kelompok 4 20 tahun (5% / 10%), bangunan permanen 20 tahun (5%), tidak permanen 10 tahun (10%).
- Ayat (6a): bangunan permanen bermasa manfaat lebih dari 20 tahun boleh disusutkan sesuai masa manfaat sebenarnya. Belum didukung.
- Ayat (8): pengalihan atau penarikan harta: nilai sisa buku dibebankan sebagai kerugian, harga jual dibukukan sebagai penghasilan.

## Yang dibangun
- Rumus satu sumber: app.susut_bulan (database) dan jadwalSusut (TypeScript) dengan contoh tangan yang sama di tes SQL dan vitest.
  - Garis lurus: bulan ke-i = round(h x (i+1) / n) - round(h x i / n), sehingga jumlahnya tepat sama dengan harga.
  - Saldo menurun: per bulan = round(nilai buku awal tahun kalender x tarif / 12); bulan terakhir masa manfaat = sisa.
  - Contoh: Kelompok 1 Rp12.000.000 mulai Januari 2026: Rp500.000 per bulan pada 2026, Rp250.000 pada 2027, Rp125.000 pada 2028, Rp62.500 pada Januari sampai November 2029, Rp812.500 pada Desember 2029.
- Tafsiran: "bagian menurun" dihitung per tahun kalender, dibagi rata per bulan; tahun pertama memakai harga perolehan dengan bulan sisa tahun itu. Ini mengikuti cara umum di lampiran PMK lama dan belum dicocokkan dengan PMK 72/2023 (belum dibaca).
- Penyusutan otomatis tanggal 1 (cron nadi-penyusutan) untuk bulan lalu, dan tombol yang menyusulkan semua bulan yang belum. Bulan dengan periode terkunci dilewati dan dilaporkan.
- Jurnal: perolehan D 1-500 / K kas atau bank (atau tanpa jurnal bila sudah dicatat di pembelian); penyusutan D 6-500 / K 1-590 satu jurnal per usaha per bulan; pelepasan D kas/bank + D 1-590 / K 1-500, selisih ke 4-910 (laba) atau 6-990 (rugi).
- Pelepasan: penyusutan sampai bulan sebelum tanggal pelepasan.
- Aset dipinjam karyawan: riwayat di aset_pinjam, staf melihat aset yang sedang ia pinjam.

## Belum
- Penyusutan komersial terpisah dari fiskal (laporan keuangan memakai angka fiskal).
- Aset dalam pengerjaan, revaluasi (ayat (5)), bangunan > 20 tahun (ayat (6a)).
- PMK 72/2023 tentang kelompok harta belum dibaca; pemilihan kelompok diserahkan ke pemilik dengan contoh.
