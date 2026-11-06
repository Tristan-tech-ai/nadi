# Tinjauan film v4 terhadap cerita Tristan

Film: `docs/promo/nadi-demo.mp4`, 204 dtk, 1920×1080 60 fps dengan motion blur 4 subframe (rana 180 derajat). Dibangun mengikuti skill Barty-Bart/motion-graphics (CARA.md). Setiap baris di bawah dicek pada lembar stills dan lembar gerak 8 bingkai/dtk dari render.

| Cerita Tristan | Detik | Di film | Status |
|---|---|---|---|
| Banyak berkas berantakan di satu titik | 0-2,5 | Tumpukan 12 berkas berikon jenisnya (XLSX, PDF, DOCX, CSV, JPG, PNG) di tengah, dekat | ada |
| Merenggang sambil berputar, teks awal | 2,5-8,5 | Berkas menyebar sambil berputar 3D; "Masih mengurus semua berkas ini manual?" lalu "tiap malam? / tiap hari? / tiap bulan?" berganti di ketukan | ada |
| Atau bayar aplikasi mahal untuk otomatisasi yang begitu-begitu saja | 8,5-12,6 | Kalimat dengan "aplikasi mahal" disorot, lalu kalimat menerobos kamera | ada |
| Terowongan harga 3D, menerobos, dengan efek | 12-18 | Kamera menerobos terowongan kartu harga resmi bertanggal (kasir, modul AI +Rp499.000, akuntansi, gaji per karyawan, pajak), makin cepat dengan garis kecepatan; sumber kecil "Harga resmi di situs penyedia, dilihat 3 Nov 2026" | ada |
| Nadi muncul dengan harga jauh lebih murah | 18-22 | Lapangan kunyit: logo, "Nadi", "Mulai Rp0.", "Rp149.000 per bulan untuk 15 orang." | ada |
| Zoom out dengan efek kecepatan, semua di dalam koin | 22,2-24 | Lingkaran mengecil cepat, bingkai emas muncul, isi menjadi muka koin | ada |
| Flip koin, koin masuk area drop diikuti berkas seperti ke kolam | 24,4-31 | Koin dilempar berputar ke luar bingkai, kamera menunduk ke kotak Lempar asli, koin jatuh dengan riak, sembilan berkas menyusul dan tenggelam dengan riak masing-masing | ada |
| Koin berubah menjadi loading | 34-36 | Koin larut menjadi lingkaran memuat, selesai dengan centang; daftar berkas Disiapkan, Dikirim, Dibaca, Siap | ada |
| Tahu dulu datanya masuk ke mana, langsung di-reveal | 38,6-45 | Kalimat lalu kartu tagihan INV/2026/X/0007 asli: "Kalau disetujui" disorot, Lihat rincian, "Akan ditambah (3)" | ada |
| Disetujui | 46,2 | Kursor menekan Setujui, cap DITERIMA | ada |
| Koin keluar, menggelinding, membuka teks di belakangnya | 48,6-56 | Koin melompat dari kartu lalu menggelinding; "Punya AI sendiri? Kerjakan langsung dari obrolan." terbuka tepat di belakang koin | ada |
| Banyakin chatting onboarding | 56-74 | Tujuh pesan: Excel karyawan dilampirkan, AI membaca data usaha, Budi Santoso ganda, pemilik membetulkan, AI menulis draf 15 baris, gaji tidak dicentang | ada |
| UI masuk satu per satu (draft hasil AI), cursor klik terapkan, teks sedikit | 74-91 | Tinjau draf asli, baris masuk satu per satu, Perlu dicek dan baris gaji disorot, klik "Terapkan 10 baris", toast batal 10 menit, lalu "AI-mu menyiapkan. Kamu yang memutuskan." | ada |
| (lanjutan) Tagihan | 91-104 | Tagihan publik asli dengan QRIS, koin masuk ke QR, cocok dengan mutasi rekening, cap LUNAS | ada |
| (lanjutan) Gaji | 104-116,6 | Draf gaji asli: 2 ditahan Gerbang Gaji, alasan Dodi Pratama disorot, rincian BPJS dan PPh 21 | ada |
| "Yang berulang biar jalan sendiri" dibuat konkret | 116,6-131 | Membuat alur sungguhan (Ketika Invoice lunas, kerja "Kirim pesanan {nomor}"), lalu diagram: tiga invoice lunas, tiga kartu "Kirim pesanan" masuk daftar kerja Gudang; kalimat "Tiap invoice lunas, pesanan langsung masuk daftar kerja gudang." | ada |
| (lanjutan) Tanya data | 131-139 | "Laba bulan ini berapa?" diketik, jawaban Rp1.448.000 dan "Lihat sumbernya" | ada |
| Kamera (dikembangkan sendiri) | 139-163 | Koin menggelinding di denah toko, kamera menunduk, denah menjadi CCTV asli dengan pelacakan Nadi; gambar menjadi kotak-kotak, lalu titik, lalu hanya angka Masuk dan Keluar yang tersisa ("Wajah tidak disimpan. Yang dikirim hanya angkanya."); peta panas asli | ada |
| Self improvement: struk aneh ditolak, AI mencerna, scanner baru | 163-188 | Struk SPBU asli ditolak (bingkai merah "Format ini belum dikenal", terpental); koin menjadi lensa, pemasok/tanggal/total menyala; bagian itu membentuk pemindai baru; tiga centang pemeriksa; struk SPBU berikutnya langsung terbaca dengan isian dari OCR aslinya, "Biaya AI untuk struk ini: Rp0". Tanpa kata aturan, regex, sintaks, atau token | ada |
| Penutup | 188-204 | Laptop, tablet, dan HP dengan Hari ini yang sama; koin dilempar terakhir lalu menetap di tengah; "Lempar berkasnya. Nadi yang merapikan." dan nadi-swart.vercel.app | ada |

## Suara (skill sound-effects)

- **Efek:** 105 cue dari beat sheet, semuanya rekaman nyata CC0 (Freesound dan Kenney, lisensi dicek di halaman sumber 6 Nov 2026).
- **Musik:** Rafael Krux, CC BY 4.0. Bagian tengahnya diulang sekali di batas birama.
- **Kenyaringan:** diukur pada MP4 akhir (`docs/promo/nadi-demo.mp4`): -16,4 LUFS terintegrasi, true peak -4,7 dBFS; hasil campuran mono sama (-16,4 LUFS, -4,7 dBFS). Rincian di `SOUND.md`, kredit di `CREDITS.txt`.
- **Beat grid:** librosa terkunci di off-beat, jadi grid digeser 83 ms.
- **Galat potongan terhadap ketukan:** sebagian besar di bawah 135 ms. Yang terbesar: 11,4 dtk (kalimat menerobos kamera), 46,3 (cap DITERIMA), 157,8 (ke peta panas), 88,2, dan 93,2.
- **Lima titik untuk didengar Tristan dengan headphone:** 11,4 · 46,3 · 88,2 · 93,2 · 157,8.
- **Yang tidak bersuara:** ketikan. Rekaman ketik satu-satunya di pustaka berlisensi Mixkit, dan teks lisensinya hanya tampil lewat skrip sehingga belum bisa dicek.

## Yang belum

- Waktu animasi belum digeser ke ketukan musik untuk lima potongan dengan galat terbesar.
- Bunyi ketik.
- Koin sempat tampil terbalik (logo "U") saat berputar. Ini wajar untuk lemparan, tetapi bisa diganti muka belakang bergambar lain.
- Belum ada pembanding berdampingan dengan rujukan video Tristan untuk v4.
