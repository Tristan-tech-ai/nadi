# Eval tanya data (M-22)

Pengurai: `apps/web/src/lib/tanya/urai.ts` (aturan, tanpa model). Hari acuan Jumat 6 Nov 2026.

| Set | Ditulis | Hasil | Catatan |
|---|---|---|---|
| Korpus utama 50 kalimat (`korpus.ts`) | sebelum pengurai, oleh penulis pengurai | 50/50 niat + rentang + nama barang | Penulis sama dengan pengurai, jadi angka ini optimistis |
| Uji buta 20 kalimat (`buta.test.ts`) | setelah pengurai jadi | 15/20 (75%) pada pengukuran pertama | Gagal: "uang keluar" (tidak dikenal), "sisa uang di rekening" (terbaca stok), "ngutang" (tidak dikenal), "lewat tempo" (tidak dikenal), "lemburan" (terbaca karyawan) |
| Uji buta setelah perbaikan | sama | 20/20 | Set ini dipakai memperbaiki pola, jadi sekarang hanya uji regresi |

Pertanyaan pendapat, sebab, atau ramalan ("terbaik", "kenapa", "bagaimana", "prediksi") selalu ditolak, tidak dijawab dengan angka.
Kalimat yang tidak cocok dengan niat mana pun juga ditolak dengan contoh pertanyaan. Angka dihitung RPC `ask_data` dari sumber yang
sama dengan layar aslinya, dan setiap jawaban membawa tautan ke layar itu.

Batas yang diketahui: bahasa gaul di luar daftar kata, rentang "tanggal 3 sampai 10", dan pertanyaan gabungan ("penjualan dan laba")
belum dikenali; yang kedua hanya dijawab niat pertama yang cocok.
