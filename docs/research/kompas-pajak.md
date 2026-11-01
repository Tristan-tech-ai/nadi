# Kompas Pajak (F4-07)

Ditulis 1 Nov 2026 dari naskah resmi, bukan artikel. Masalah P13: aturan PPh final UMKM berubah lewat PP 20/2026 dan batasnya kini gabungan, sehingga usaha yang selama ini aman bisa tiba-tiba wajib tarif umum tanpa sadar.

## Sumber primer (dibaca 1 Nov 2026)
- **PP 20/2026** tentang Perubahan atas PP 55/2022 (LN 2026 No. 43, ditetapkan dan diundangkan 22 Apr 2026, berlaku pada tanggal diundangkan). Naskah: https://www.pajak.go.id/sites/default/files/lampiran/PP_20_2026_Perubahan%20PP%2055%20Tahun%202022.pdf (salinan juga di peraturan.bpk.go.id/Details/349415 dan jdih.kemenkeu.go.id/dok/pp-20-tahun-2026). Pasal I mengubah: menyisipkan Pasal 20A (suap bukan biaya), mengubah Pasal 56 ayat (1) dan (4), Pasal 57 ayat (1), (2), (4), Pasal 58, menghapus Pasal 59.
- **PP 55/2022** (naskah https://peraturan.bpk.go.id/Download/284096/PP%20Nomor%2055%20Tahun%202022.pdf) untuk pasal yang tidak diubah: Pasal 56 ayat (2), Pasal 60, 61, 62, 63.

## Isi yang dipakai
- Tarif PPh final 0,5% (Pasal 56 ayat (2), tidak diubah).
- Subjek (Pasal 57 ayat (1) baru): orang pribadi; badan berbentuk perseroan perorangan yang didirikan 1 orang; koperasi; dengan peredaran bruto tidak melebihi Rp4.800.000.000 setahun.
- Tidak termasuk (Pasal 57 ayat (2) baru) antara lain: memilih tarif umum (wajib memberi tahu DJP, ayat (3)); PT perorangan milik orang berkeahlian khusus yang menjual jasa sejenis pekerjaan bebas; **orang pribadi beserta seluruh PT perorangan yang ia dirikan yang brutonya secara keseluruhan melebihi Rp4,8 M setahun** (huruf e); koperasi setelah 4 tahun pajak sejak terdaftar (huruf f). Huruf e dan f serta ayat (3): tahun-tahun berikutnya tidak bisa final lagi (ayat (4)).
- Pasal 58 baru: bruto = seluruh bruto usaha dan pekerjaan bebas **tahun pajak terakhir sebelum** tahun bersangkutan, final maupun tidak, termasuk dari luar negeri, sebelum potongan penjualan. Suami-istri pisah harta (atau istri memilih menjalankan kewajiban sendiri): bruto suami dan istri digabung, beserta PT perorangan yang didirikan keduanya.
- Pasal 59 (batas waktu final 7/4/3 tahun) dihapus.
- Pasal II peralihan: CV, firma, PT selain perorangan, BUMDes yang jangka waktu finalnya menurut PP 55/2022 belum berakhir tetap boleh final sampai jangka waktu itu berakhir.
- PP 55/2022 Pasal 60: dasar pengenaan = bruto sebulan; orang pribadi: bagian bruto sampai Rp500.000.000 setahun tidak dikenai, dihitung kumulatif sejak masa pajak pertama; PPh = 0,5% x dasar (setelah bagian bebas untuk orang pribadi).
- Pasal 61: bila bruto tahun berjalan melebihi Rp4,8 M, tetap final sampai akhir tahun; tahun berikutnya tarif Pasal 17.
- Pasal 62 ayat (2): disetor sendiri setiap bulan.

## Keputusan
1. Angka masuk aturan_bertanggal kunci pph.final_umkm (terverifikasi, berlaku 22 Apr 2026, sumber pasal dan URL). Hitungan di apps/web/src/lib/pajak/kompas.ts.
2. Posisi pajak dihitung dari jurnal pendapatan (F4-04) per bulan; pembulatan ke bawah per rupiah (PP tidak mengatur pembulatan; asumsi dicatat).
3. Pengecek batas memakai bruto tahun lalu (Pasal 58) gabungan dengan usaha lain pemilik dan pasangan pisah harta, isian pemilik; tahun berjalan dipantau untuk Pasal 61.
4. Simulator hanya membandingkan pilihan yang sah: orang pribadi final, PT perorangan final, orang pribadi tarif umum Pasal 17 (lapisan dan PTKP sudah terverifikasi dari F1-05). Badan tarif umum (Pasal 17 ayat (1) huruf b, Pasal 31E) **tidak dihitung** sampai teksnya dibaca. Simulator dan pengecek menyatakan bahwa memecah usaha atau memakai nama orang lain tidak membuat batas terlewati; tidak ada fitur yang membantu menghindari batas.
5. Belum: PPN, PPh 21/23/4(2), pajak daerah, pelaporan SPT, koperasi 4 tahun (butuh tanggal terdaftar), surat keterangan Pasal 63.
