# Rata-rata beban tim yang jujur (rancangan Q-27)

Ditulis 1 Nov 2026 (tick 187), sebelum dikerjakan. Pemicu: foto layar staf saat verifikasi Q-25 menampilkan "Minggu ini 2 poin. Rata-rata tim 0. Bebanmu di atas rata-rata. Pemilik sudah melihat angka yang sama."

## Masalah (diukur, bukan diduga)
- public.beban_saya menghitung `avg(poin)` dari **semua baris** app.beban_orang. Isinya setiap orang bertopi, termasuk yang tidak diberi kerja apa pun minggu itu.
- Warung Uji A: 50 baris beban_orang, 0 berpoin saat dicek (tick 186). Rata-rata 2/50 = 0,04 dibulatkan `round(v_rata, 1)` menjadi 0, lalu tampil "Rata-rata tim 0".
- `di_atas` = poin > 1,5 x rata-rata, sehingga 2 > 0,06 bernilai benar. Staf dengan satu kerja kecil diberi tahu bebannya di atas rata-rata, padahal seluruh tim memang hampir kosong.
- Usaha nyata juga bisa begini. Contohnya warung dengan 8 orang bertopi yang minggu ini hanya 3 orang memakai papan kerja.

## Aturan baru
1. **Kelompok pembanding** = orang yang ikut papan kerja minggu itu: poin > 0, atau antre > 0, atau selesai_n > 0. Orang bertopi tanpa kerja sama sekali tidak ikut menurunkan rata-rata, karena mereka belum memakai papan kerja, bukan sedang santai.
2. **Rata-rata tampil** hanya bila kelompok itu minimal 3 orang, sama dengan aturan lama yang dipakai pada kelompok yang benar. Rata-rata ditulis 1 desimal.
3. **Di atas rata-rata** hanya bila kedua syarat ini terpenuhi:
   - poin > 1,5 x rata-rata;
   - selisihnya minimal 4 poin (1 poin = 15 menit, jadi 4 poin = 1 jam kerja wajar).

   Selisih kecil pada angka kecil hanyalah derau, bukan ketidakadilan.
4. **Teks** tidak pernah mencetak "Rata-rata tim 0".
   - Bila kelompok < 3 orang: "Rata-rata tim tampil bila minimal 3 orang memakai papan kerja minggu ini."
   - Bila rata-rata < 0,1, yang tidak mungkin terjadi di kelompok baru karena setiap anggota punya kerja: tetap dijaga di kode dengan teks "Rata-rata tim belum ada".

## Contoh angka (untuk tes)
| Tim | Kelompok | Rata-rata | Saya | Di atas? |
|---|---|---|---|---|
| 50 orang, 47 tanpa kerja, 3 berpoin 2/4/6 | 3 | 4 | 6 | tidak (6 > 6 salah) |
| sama, saya 12 poin (2/4/12) | 3 | 6 | 12 | ya (12 > 9 dan selisih 6 >= 4) |
| 3 berpoin 1/1/3 | 3 | 1,7 | 3 | tidak (3 > 2,5 tetapi selisih 1,3 < 4) |
| 2 berpoin | 2 | (tidak tampil) | | tidak |
| saya tanpa kerja, tim 3 berpoin | 3 | x | 0 | tidak; teks "Minggu ini 0 poin." |

## Yang ikut diperiksa
- **Kartu pemilik** "Sari memikul 31% kerja minggu ini dengan 20% jam kerja" (kalimatTerberat) memakai porsi jam dari semua orang bertopi. Di tim 50 orang dengan 2 orang aktif, porsi jam tiap orang 2%. Kalimatnya tetap benar karena jam kerja orang lain memang ada. Ini tidak diubah di Q-27, tetapi dicatat bila kemudian terlihat menyesatkan di foto.
- **KPI F3-03** (lib/kerja/kpi.ts) sudah memakai "minimal 3 orang punya kerja selesai minggu ini". Aturan baru beban_saya menjadi searah dengannya.

## Bukti yang diminta
Tes SQL dengan tabel contoh di atas (transaksi dibatalkan), vitest teksBebanSaya, e2e kerja.spec tetap lulus, foto 390 terang layar staf, dan sidik migrasi sama dengan database.
