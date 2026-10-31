# Pembagi kerja adil: ukuran ketimpangan dan algoritma dasar (F3-02)

Ditulis 1 Nov 2026. Kriteria antrean: "uji unit: indeks ketimpangan turun dibanding pembagian rakus pada data sintetis". Tampilan: docs/design/bagi-adil.md.

## Ukuran: koefisien Gini atas beban per jam
Beban per jam orang i: b_i = poin minggu ini / jam jadwal minggu ini (jam dari F3-06; tanpa jadwal semua dianggap jam sama).

G = (sum_i sum_j |b_i - b_j|) / (2 n^2 mu), dengan mu rata-rata b. G = 0 berarti beban per jam rata; makin besar makin timpang. Definisi ini rumus selisih rata-rata absolut yang baku untuk Gini (setara dengan definisi kurva Lorenz). Rumus tidak bergantung pustaka, jadi diuji langsung dengan contoh di bawah.

Kenapa Gini dan bukan simpangan baku: Gini tidak bergantung skala (usaha dengan kerja 10 poin dan 100 poin seminggu bisa dibandingkan) dan mudah dijelaskan sebagai satu angka 0 sampai 1.

## Pembanding: pembagian rakus
"Rakus" meniru kebiasaan nyata yang menjadi masalah P11: setiap kerja baru diberikan ke orang yang paling banyak menyelesaikan kerja (yang "paling bisa diandalkan"). Inilah yang membuat yang rajin terus ketiban.

## Algoritma adil v1 (tanpa model, 0 token)
Urutkan kerja baru dari poin terbesar. Untuk setiap kerja, kandidat = orang aktif yang memakai topi kerja itu (wajib cocok keahlian) dan belum melewati batas jam hari itu. Pilih kandidat dengan beban per jam SESUDAH menerima kerja paling kecil: min_k (poin_k + t) / jam_k. Seri diputus dengan yang paling lama tidak diberi kerja, lalu id. Tenggat dipakai sebagai syarat: kandidat yang shift-nya berakhir sebelum tenggat dilewati.

Kesempatan belajar (opsional per usaha): bila sebuah kerja ditandai "boleh untuk belajar", kandidat boleh termasuk orang yang sedang magang dengan topi tujuan itu (F2-06), dan poinnya dihitung 1,5 kali untuk beban mentor, bukan peserta.

## Contoh hitung (dihitung ulang dengan skrip, 1 Nov 2026)
Tiga kasir: Sari (40 jam, 20 poin), Budi (40 jam, 10 poin), Dewi (20 jam, 4 poin). Kerja baru: 4, 3, 2, 2 poin.

| Keadaan | Sari | Budi | Dewi | Gini |
|---|---|---|---|---|
| Awal (poin/jam) | 0,500 | 0,250 | 0,200 | 0,2105 |
| Rakus: semua ke Sari | 0,775 | 0,250 | 0,200 | 0,3129 |
| Adil v1: 4 ke Budi, 3 ke Dewi, 2 ke Budi, 2 ke Budi | 0,500 | 0,450 | 0,350 | 0,0769 |

Kasus ini menjadi uji unit pertama: gini(adil) < gini(rakus), dan nilai Gini sama sampai 4 desimal. Uji kedua dengan data sintetis acak (benih tetap, 200 kerja, 8 orang, 3 topi): gini(adil) < gini(rakus) di setiap benih 1 sampai 50, dan setiap kerja hanya diberikan ke orang bertopi cocok.

## Batas yang disadari
- Poin adalah estimasi (F3-01); kalibrasi dari durasi nyata memperbaiki angka dari waktu ke waktu, tetapi minggu pertama bisa meleset.
- Algoritma rakus lokal ini tidak optimal global; untuk ukuran UMKM (< 30 orang, < 100 kerja per hari) cukup, dan bisa dijelaskan per keputusan ("Budi: beban paling ringan di antara kasir").
