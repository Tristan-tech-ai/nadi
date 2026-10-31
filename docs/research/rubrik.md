# Rubrik pelamar dan penjaga bias lowongan (F2-02)

Ditulis 31 Okt 2026. Masalah P01 (rekrutmen): pemilik UMKM menulis syarat lowongan dari kebiasaan ("maks 25 th, berpenampilan menarik") dan menyaring CV dengan perasaan.

## Dasar aturan
| Sumber | Isi yang dipakai | Status |
|---|---|---|
| SE Menaker M/6/HK.04/V/2025 (28 Mei 2025), PDF resmi JDIH Kemnaker | Butir 2 larangan diskriminasi atas dasar apapun; butir 3 syarat usia hanya bila sifat pekerjaan nyata memengaruhi kemampuan dan tidak mengurangi kesempatan; butir 4 berlaku sama untuk penyandang disabilitas | dibaca langsung |
| UU 13/2003 Pasal 5, Pasal 6 dan Penjelasannya | Kesempatan sama tanpa diskriminasi; pembedaan jenis kelamin, suku, ras, agama, warna kulit, aliran politik | dikutip dari hukumonline, teks resmi belum dibaca |
| UU 8/2016 Penyandang Disabilitas | Hak atas pekerjaan tanpa diskriminasi | belum dibaca pasal per pasal; dipakai hanya lewat SE butir 4 |
| Pernyataan Menaker (berita 28 Mei 2025) | Contoh: batas usia, berpenampilan menarik, status perkawinan, tinggi badan, suku, warna kulit | sekunder; contoh, bukan teks SE |

## Penjaga bias (src/lib/rekrut/bias.ts)
- Delapan jenis: usia, penampilan, status_kawin, jenis_kelamin, agama, suku_ras, politik, disabilitas (syarat fisik umum seperti "sehat jasmani", "tidak cacat").
- Satu peringatan per jenis berisi kutipan persis, alasan dengan dasar aturan, dan saran pengganti yang bisa dinilai.
- "Pengalaman minimal 2 tahun" tidak dianggap batas usia (20 karakter sebelum kecocokan diperiksa).
- Lowongan berperingatan disimpan **tertutup**. Pemilik boleh menekan "Tetap buka", karena SE butir 3a mengizinkan batas usia untuk sifat pekerjaan tertentu dan Nadi tidak bisa menilainya; peringatan tetap terlihat di kartu. Peringatan disimpan di kolom `lowongan.peringatan` dan tidak ikut ke halaman lamar publik.
- Batas: pemeriksa berbasis pola; kata seperti "wanita" ditandai di mana pun dalam teks lowongan (positif palsu mungkin, misalnya "toilet wanita"); pemilik yang paham boleh tetap membuka.

## Rubrik dari topi (src/lib/rekrut/rubrik.ts)
- Kriteria: pengalaman sebagai topi (bobot 3), tiap keahlian topi (2), tiap tanggung jawab topi (1). Skor = bobot terpenuhi / total, 0-100.
- CV disaring dulu (`saringCv`): hanya posisi, peran di riwayat kerja, dan keahlian. Nama, usia, jenis kelamin, agama, status kawin, suku, foto, tinggi/berat, alamat, NIK, disabilitas, politik tidak pernah dibaca. Tes membuktikan CV yang hanya berbeda di atribut itu bernilai sama, dan atribut berisi kata rubrik tidak menambah skor (merah sengaja: mutasi yang memasukkan nama ke posisi tertangkap).
- Pencocokan kata memakai varian imbuhan Indonesia kasar (melayani ~ pelayan ~ layan, memasak ~ masak, pencatatan ~ catat). Bukan model, jadi 0 token dan bisa dijelaskan.
- Tampil di Feed pada usulan `rekrut.pelamar` yang datang lewat lowongan bertopi: "Rubrik topi Pelayan: cocok 3 dari 5 (skor 75). Belum terlihat di CV: ... Umur, jenis kelamin, agama, foto, dan nama tidak dinilai."
- Rubrik hanya bahan pertimbangan; keputusan tetap di pemilik (Setujui/Tolak).
