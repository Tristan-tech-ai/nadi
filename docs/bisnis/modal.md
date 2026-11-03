# Modal dan runway (B-03)

Ditulis 3 Nov 2026 dari lembar Modal di docs/bisnis/model.xlsx (simulasi 36 bulan, berumus, 0 galat setelah hitung ulang).
Satu skenario = satu target: Hemat 100 usaha berbayar, Wajar 1.000, Agresif 10.000. Margin, CAC, dan churn diambil dari lembar
Ekonomi unit (B-02).

## Biaya tetap (sumber resmi, diakses 3 Nov 2026)
- Supabase Pro mulai $25/bln dengan kredit compute $10 (supabase.com/pricing).
- Vercel Pro $20/bln; **paket Hobby yang dipakai sekarang tidak boleh untuk penggunaan komersial** (vercel.com/pricing, FAQ). Begitu
  Nadi memungut bayaran, produksi wajib pindah ke Pro. Ini keputusan bayar Tristan, dicatat di loop/UNTUK-TRISTAN.md.
- Kurs JISDOR 3 Nov 2026 Rp18.148.
- Tambahan compute, domain/email, dan biaya tim adalah asumsi (sel kuning).

## Hasil
| | Hemat (100) | Wajar (1.000) | Agresif (10.000) |
|---|---|---|---|
| Bulan sampai target | 18 | 24 | 30 |
| Biaya tetap per bulan | Rp866.660 | Rp27.055.540 | Rp160.483.260 |
| (termasuk tim) | Rp0 | Rp25.000.000 | Rp150.000.000 |
| Bulan pertama arus kas positif | 3 | 7 | 10 |
| Modal maksimum terpakai | Rp1.422.693 | Rp111.780.133 | Rp1.595.504.640 |
| Modal dihimpun (x1,5) | Rp2.134.040 | Rp167.670.199 | Rp2.393.256.960 |
| Arus kas bulan 36 | Rp10.216.438 | Rp125.219.440 | Rp1.118.746.540 |
| Runway modal dihimpun pada bakar terbesar | 2,0 bln | 4,8 bln | 6,9 bln |

## Yang terbaca
1. Infrastruktur bukan masalah modal: Rp0,8 jt/bln untuk 100 usaha. Yang menentukan modal adalah **biaya tim dan CAC**.
2. Jalur Hemat (pendiri tanpa gaji, pemasaran organik, lomba) hampir tanpa modal: sekitar Rp1,4 jt sebelum impas. Ini jalan
   yang masuk akal sebelum mencari investor, karena menghasilkan data churn dan konversi nyata.
3. Jalur Wajar butuh sekitar Rp112-168 jt (setara gaji tim kecil beberapa bulan); jalur Agresif sekitar Rp1,6-2,4 M, ukuran
   putaran pra-seed/seed. Angka ini sangat peka terhadap asumsi CAC dan churn, jadi investor akan menanyakan data nyata dulu.
4. Runway pendek di Agresif (6,9 bln pada bakar terbesar) berarti dana harus dihimpun sebelum mulai beriklan, bukan sambil jalan.

## Kepekaan yang harus dicek sebelum dipakai di deck
- Churn 8% vs 3% mengubah LTV hampir 2 kali.
- Konversi Gratis 6% vs 2% mengubah biaya subsidi Gratis per usaha berbayar dari Rp34 rb ke Rp107 rb.
- Harga compute Supabase di atas Micro dan biaya domain belum dibaca dari sumber resmi.
