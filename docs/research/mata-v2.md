# Mata v2: kunjungan, antrean, kasir, peta panas (W-02)

Ditulis 5 Nov 2026.

## Aturan yang dibaca

UU 27/2022 tentang Pelindungan Data Pribadi, PDF resmi JDIH BPK (https://peraturan.bpk.go.id/Download/224884/UU%20Nomor%2027%20Tahun%202022.pdf, dibaca 5 Nov 2026). Lapisan teks PDF bolong di dua kata Pasal 17, jadi halaman 9 dibaca dari gambarnya.

- Pasal 1 angka 1: Data Pribadi adalah data tentang orang perseorangan yang teridentifikasi atau dapat diidentifikasi, sendiri atau dikombinasi dengan informasi lain.
- Pasal 17 ayat (1): pemasangan alat pemroses atau pengolah data visual di tempat umum dan/atau fasilitas pelayanan publik dilakukan (a) untuk tujuan keamanan, pencegahan bencana, dan/atau penyelenggaraan lalu lintas atau pengumpulan, analisis, dan pengaturan Informasi lalu lintas; (b) harus menampilkan Informasi pada area yang telah dipasang alat itu; (c) tidak digunakan untuk mengidentifikasi seseorang.
- Pasal 17 ayat (2): huruf b dan c dikecualikan untuk pencegahan tindak pidana dan penegakan hukum.
- Penjelasan Pasal 17: cukup jelas.
- Pasal 20 ayat (2): dasar pemrosesan, antara lain persetujuan eksplisit (huruf a) dan kepentingan yang sah lainnya dengan memperhatikan tujuan, kebutuhan, dan keseimbangan kepentingan (huruf f).
- Pasal 74: penyesuaian paling lama 2 tahun sejak diundangkan 17 Okt 2022.

## Tafsiran (belum diperiksa ahli hukum)

- Toko yang terbuka untuk umum belum tentu "tempat umum" dalam arti Pasal 17. Teks tidak mendefinisikannya dan Penjelasannya "cukup jelas". Nadi memperlakukan toko pengguna seolah tempat umum, karena itu pilihan yang paling aman.
- Tujuan huruf a tidak menyebut analisis pengunjung toko. Karena itu Mata v2 dirancang supaya tidak memproses Data Pribadi sama sekali. Bingkai diperkecil ke 160 x 120 piksel di perangkat dan langsung dibuang. Yang disimpan hanya posisi titik tengah gumpal di memori, dan yang dikirim hanya jumlah dan detik per jam per zona. Tidak ada wajah, warna baju, nomor jejak, atau waktu per orang. Dengan begitu yang tersimpan bukan data tentang orang yang dapat diidentifikasi (Pasal 1 angka 1). Tafsiran ini belum terverifikasi oleh ahli hukum dan ditulis di docs/quality sebagai risiko terbuka.
- Huruf b tetap dipenuhi walau datanya anonim. Database menolak rekap sebelum pemilik atau admin menyatakan papan informasi terpasang (`set_vision_notice`). Nadi menyediakan papan siap cetak di /cetak/papan-mata.
- Huruf c ditegakkan oleh rancangan: tidak ada fitur, kolom, atau RPC yang bisa menyimpan atau mencocokkan ciri orang. Isyarat kutub (lebih terang atau lebih gelap dari lantai) hanya hidup sesaat di memori untuk memisahkan dua orang yang berpapasan.

## Cara kerja

1. Kamera atas atau rekaman. Bingkai abu-abu 160 px, 5 bingkai per detik.
2. Beda terhadap latar, dengan latar yang mengikuti cahaya di piksel lantai dan sangat lambat di piksel orang. Gumpal 4 tetangga; gumpal besar dipecah k-means menjadi beberapa orang menurut perkiraan luas satu orang.
3. Pelacak: penugasan optimal (algoritma Hungaria) jejak ke gumpal dengan gerbang jarak. Jejak yang hilang di pintu ditutup setelah 3 detik dan tidak dipasangkan lagi setelah 1 detik. Jejak yang hilang di dalam toko ditunggu 20 detik.
4. Potongan jejak disambung bila ujung dan awalnya berdekatan dalam 30 detik. Sisanya diseimbangkan lewat pintu: potongan yang hanya punya ujung masuk dipasangkan dengan potongan yang hanya punya ujung keluar. Rantai yang tidak pernah menyentuh pintu dibuang.
5. Jejak yang sebagian besar waktunya (>= 60%) di zona pos kerja dianggap karyawan dan tidak dihitung.
6. Rekap per jam: kunjungan, total lama, jumlah dan detik menunggu (zona antrean), jumlah dan detik dilayani (zona kasir), detik dan lintasan per zona, jalur (urutan zona, paling banyak 6). Jalur di bawah 3 kunjungan tidak ditampilkan.

## Korpus dan hasil

`fixtures/korpus/mata-v2` dibangkitkan `apps/web/scripts/korpus/mata-v2.ts` dari `src/lib/mata/toko-sintetis.ts`. Isinya denah toko dengan pintu, dua lorong, antrean berbentuk L, satu kasir, dan pos kerja. Pelanggan datang acak dan keliling lorong; sebagian antre di kasir yang melayani satu per satu, jadi antrean terbentuk dari jadwal layanan sungguhan. Derau: deteksi hilang 3 sampai 8% per bingkai, tiang yang menutupi orang, gumpal palsu, cahaya bergeser dan melompat, getar posisi, orang berdempetan di antrean, orang keluar berpapasan dengan antrean. Jawaban dihitung dari jalur yang sama.

Hasil `src/lib/mata/jejak.test.ts` (5 Nov 2026):

| Skenario | Kunjungan | Akurasi jumlah | Galat lama | Galat tunggu | Galat layan |
|---|---|---|---|---|---|
| sepi | 10/10 | 100% | 10,9% | 0,4% | 0,0% |
| ramai (karyawan) | 41/45 | 91,1% | 12,7% | 3,5% | 6,2% |
| antrean (karyawan) | 24/24 | 100% | 5,3% | 0,2% | 0,2% |
| ramai-2 (uji) | 49/50 | 98,0% | 8,3% | 0,1% | 0,1% |
| sepi-2 (uji) | 12/12 | 100% | 6,3% | 0,3% | 0,4% |

Galat lama = rata-rata |lama hasil - lama benar| / lama benar per kunjungan yang cocok (rentang waktu tumpang tindih, IoU >= 0,3). Parameter disetel pada tiga skenario pertama; dua skenario bertanda uji tidak dipakai saat menyetel. Gerbang dibuat merah dengan sengaja: tanpa zona pintu (sambung dan neraca pintu mati) skenario ramai jatuh di bawah 90%. e2e (`e2e/mata-v2.spec.ts`) menjalankan video pendek terkompresi VP9 di peramban: 5/5 kunjungan.

Catatan jujur: ini korpus sintetis dengan orang berupa lingkaran di lantai rata. Kamera sungguhan punya bayangan, orang membawa troli, sudut tidak tegak lurus, dan dua orang yang berjalan berdampingan terhitung satu (sumber kurang hitung di skenario ramai). Uji pada rekaman CCTV publik berlisensi bebas menjadi tugas W-02B.

## Uji rekaman kamera publik (W-02B, 5 Nov 2026)

Permintaan Tristan 5 Nov 2026: uji Mata pada CCTV umum yang boleh dipakai. Dua rekaman dari Wikimedia Commons, lisensinya dibaca dari metadata berkas (docs/ASSETS.md). Keduanya disimpan di scratchpad, tidak di repo.

- **Madero y Eje Central** (CC BY-SA 4.0): drone tegak lurus di atas persimpangan, gerak lambat. 62 detik pertama, zona zebra kanan bawah (118 x 73 piksel dari 640 x 360, diproses 236 px).
- **Ezymart Newtown** (domain publik): CCTV toko asli, kamera miring di atas kasir, 66 detik.

Rekaman gerak lambat 62 detik hanya memuat sedikit penyeberangan utuh, jadi hitungan kunjungan dari sana tidak bisa dibuat jujur. Yang dihitung tangan adalah jumlah orang di zona pada bingkai yang jelas: Madero 11 bingkai (t = 0 sampai 20 detik, 2 sampai 3 orang), Ezymart 10 bingkai (t = 36 sampai 63 detik, 1 sampai 2 orang). Hitungan tangan di Ezymart bisa meleset satu orang karena orang tertutup rak. Mata membaca median 5 bingkai di sekitar waktu itu dengan latar median.

| Rekaman | Ambang 30 (bawaan lama) | Ambang 45 |
|---|---|---|
| Madero zebra (kamera atas) | akurasi 54,5%, galat 6 orang (bayangan panjang ikut terhitung) | akurasi 86,4%, galat rata-rata 0,36 orang |
| Ezymart (kamera miring) | akurasi 40%, galat 1 orang | akurasi 20%, galat 1,4 orang |

Kesimpulan:
- Kamera atas di luar ruang: bayangan adalah sumber salah hitung terbesar. Ambang bawaan dinaikkan ke 45; korpus sintetis tetap lulus (akurasi 91 sampai 100%, galat lama 5 sampai 13%). Angka 86,4% disetel pada 11 sampel yang sama, jadi optimis; di bawah target 90%.
- Kamera miring (CCTV toko biasa): beda latar tidak cocok. Orang tertutup rak, latar penuh warna, dan orang yang berdiri lama di awal ikut menjadi latar. Untuk kamera ini pelacak perlu diberi titik dari model deteksi orang (sudah ada di Mata F5-01), bukan dari beda latar: tugas W-02C.
- Latar sekarang diambil dari median 15 bingkai tersebar (layar berkas), karena rekaman nyata jarang dimulai dari ruang kosong.
- Calon bahan promo: hanya Madero (titik orang tidak dapat dikenali), dengan atribusi dan konsekuensi CC BY-SA. Ezymart tidak dipakai.

## Belum

- Agen edge Rust (edge/mata-agen) belum mengirim rekap kunjungan; baru layar Mata di peramban.
- Ukuran orang (`luasOrang`) masih tetap; kamera dengan ketinggian lain perlu kalibrasi.
- Kamera miring (bukan dari atas) belum didukung oleh pemisah gumpal.
