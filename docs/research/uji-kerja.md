# Uji kerja per topi dan IPIP (F2-04)

Ditulis 31 Okt 2026. Masalah P01: rekrutmen UMKM hanya dari CV dan wawancara singkat, sehingga kemampuan kerja nyata (menghitung kembalian, membagi tagihan, menakar resep) baru ketahuan setelah orangnya bekerja.

## Sumber primer (diakses 31 Okt 2026)
- IPIP, halaman utama: "The items and scales are in the public domain", boleh disalin, diubah, diterjemahkan tanpa izin dan tanpa bayar. https://ipip.ori.org/
- Kunci 50 butir Big-Five Factor Markers (Goldberg 1992): https://ipip.ori.org/newBigFive5broadKey.htm
- Petunjuk skor resmi: butir + = 1 (Very Inaccurate) sampai 5 (Very Accurate), butir - dibalik, skor skala = jumlah. https://ipip.ori.org/newScoringInstructions.htm
- Terjemahan Indonesia 50 butir oleh Hanif Akhtar (Universitas Muhammadiyah Malang), tercantum di daftar terjemahan resmi IPIP: https://ipip.ori.org/IndonesianBFM.htm (daftar: https://ipip.ori.org/newTranslations.htm). Halaman itu mencantumkan reliabilitas (Cronbach alpha, n=502): ekstraversi 0,839, keramahan 0,762, ketelitian 0,811, kestabilan emosi 0,862, intelek 0,768.

## Cara data diambil
`apps/web/src/lib/rekrut/ipip-50.ts` diurai dari HTML halaman terjemahan (bukan diketik ulang). Teks Inggris setiap butir dicari di halaman kunci resmi, lalu faktor dan tanda kuncinya dibandingkan: 50 dari 50 cocok. Label pilihan jawaban berbahasa Indonesia adalah terjemahan sendiri karena halaman terjemahan tidak mencantumkannya.

## Keputusan
1. **IPIP tidak dipakai untuk meranking atau menggugurkan pelamar.** Tidak ada norma Indonesia yang kami punya untuk menafsirkan skor sebagai tinggi atau rendah, dan Big Five adalah gambaran diri, bukan ukuran kemampuan kerja. Skor tampil apa adanya (10 sampai 50 per faktor) di layar penilai sebagai bahan obrolan wawancara, dengan keterangan itu. Rubrik pelamar (F2-02) tetap dari CV, wawancara, dan uji kerja.
2. **Kestabilan emosi** ditampilkan dengan catatan bahwa skor ini bukan diagnosis kesehatan mental dan tidak boleh menjadi alasan menolak. Dasar: SE Menaker M/6/HK.04/V/2025 butir 2 dan 4 (larangan diskriminasi, berlaku juga untuk penyandang disabilitas; dibaca di F2-02, docs/research/rubrik.md). Cakupan disabilitas mental dalam UU 8/2016 belum dibaca pasal per pasal (belum terverifikasi).
3. **IPIP opsional untuk pelamar**, seperti wawancara suara. Pelamar yang tidak mengisi tidak dirugikan.
4. **Uji kerja** berupa soal hitungan pekerjaan sehari-hari per topi (kasir, pelayan, koki, barista, gudang, pramuniaga, sales). Angka dibuat dari benih per lamaran (PRNG mulberry32), jadi soal dua pelamar berbeda tetapi bisa disusun ulang persis saat menilai. Nilai = jumlah jawaban benar persis, tanpa model AI (0 token).
5. Topi tanpa templat tidak mendapat uji kerja (bukan soal umum yang tidak relevan).

## Batas yang diketahui
- Soal hitungan mengukur ketelitian dan berhitung, bukan keterampilan tangan (memasak, melayani). Uji praktik tetap di tempat.
- Pelamar bisa memakai kalkulator; itu wajar karena di tempat kerja juga boleh. Yang diukur adalah memahami soal pekerjaan dan menjawab benar.
