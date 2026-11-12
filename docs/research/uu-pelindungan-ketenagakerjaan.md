# UU Pelindungan Ketenagakerjaan (disahkan DPR 6 Okt 2026): dampak ke aturan Nadi

Ditulis 1 Nov 2026 (tick 202). Ditemukan saat memeriksa apakah PP 35/2021 sudah diubah.

## Yang terverifikasi
- **Sumber resmi DPR** (https://www.dpr.go.id/kegiatan-dpr/berita/DPR-Sahkan-UU-Pelindungan-Ketenagakerjaan-Dasco-Kado-Terindah-untuk-Buruh-69823, diakses 1 Nov 2026): RUU Pelindungan Ketenagakerjaan disahkan menjadi undang-undang dalam Rapat Paripurna ke-9, Masa Persidangan I Tahun Sidang 2026-2027, Selasa 6 Oktober 2026. RUU itu disepakati Komisi IX bersama pemerintah sebelum dibawa ke pembicaraan tingkat II.
- **Yang tidak dimuat halaman DPR:** tanggal mulai berlaku, jumlah bab atau pasal, dan isi pasal.

## Belum terverifikasi (hanya dari berita, belum dari teks resmi)
- **Mulai berlaku:** CNBC Indonesia (6 Okt 2026) mengutip Dirjen Kemnaker bahwa UU berlaku satu tahun sejak ditetapkan dan diundangkan.
- **Ukuran:** Liputan6 menyebut 23 bab dan 313 pasal.
- **Isi:** berita menyebut perubahan pada PKWT, alih daya, PHK dan pesangon, serta pengupahan, termasuk upah minimum sektoral.
- **Teks resmi:** Apindo (melalui Kumparan) menyatakan belum menerima teks resmi.
- **Permenaker 7/2026 tentang alih daya:** disebut di blog vendor, belum dicek di JDIH.

## Dampak ke Nadi
- **Aturan yang berlaku sekarang tetap dipakai:**
  - waktu kerja dan istirahat: UU 6/2023 Pasal 77-79 dan PP 35/2021 Pasal 21-26, diverifikasi di docs/research/pola-kerja.md;
  - upah: PP 36/2021 serta perubahan PP 51/2023 dan PP 49/2025;
  - pesangon: PP 35/2021 Pasal 40 dan seterusnya.

  Selama UU baru belum berlaku dan belum ada peraturan pelaksananya, Nadi tetap memakai aturan-aturan ini.
- **Fitur yang terkena saat UU baru berlaku:**
  - slip gaji dan lembur (F1-05/F1-05B);
  - upah harian dan serah terima (F3-07);
  - cadangan pesangon (F4-09);
  - Q-22 pola kerja, bila ketentuan waktu kerja diubah.
- **Kenapa arsitektur sekarang aman:** angka hukum disimpan di tabel aturan_bertanggal dengan tanggal berlaku. Aturan baru cukup ditambah sebagai baris bertanggal mulai, tanpa mengubah kode, asalkan bentuk hitungannya sama.
- **Yang perlu dilakukan:** begitu teks resmi dan nomor UU terbit di JDIH (peraturan.go.id / peraturan.bpk.go.id), baca pasal waktu kerja, upah, PKWT, PHK, dan pesangon, lalu tulis daftar perbedaannya dengan aturan_bertanggal. Ini dicatat sebagai tugas R-UUPK di antrean, dengan pemeriksaan berkala dan tanpa menunggu.

## Cek R-UUPK pertama (1 Nov 2026, tick 204)
- **Hasil:** nomor UU dan teks resmi belum ditemukan. Pencarian luas tidak menemukan "UU Nomor ... Tahun 2026 tentang Pelindungan Ketenagakerjaan" dalam Lembaran Negara.
- **LBH Surakarta** (https://www.lbhsurakarta.id/2026/10/uu-ketenagakerjaan-baru.html, sumber sekunder):
  - per 14 Okt 2026 teks resmi belum terbit dan nomornya belum ada di basis data hukum pemerintah;
  - UU ini berdiri sendiri, 23 bab 313 pasal, dimaksudkan menggantikan kerangka UU 13/2003 beserta perubahan di UU Cipta Kerja.
- **The Conversation** (https://theconversation.com/uu-ketenagakerjaan-baru-persoalan-upah-dan-eksploitasi-pekerja-masih-menghantui-293826) menyebut pengesahan 6 Okt 2026. Di artikel yang sama ada tanggal 1 Okt 2026 untuk tahap sebelumnya.
- **Batas waktu pengesahan:** UUD 1945 Pasal 20 ayat (5) menyatakan RUU yang disetujui bersama tetapi tidak disahkan Presiden dalam 30 hari tetap sah menjadi undang-undang dan wajib diundangkan. Ini dari ingatan dan BELUM dicek ke teks resmi. Bila benar, batasnya sekitar 5 Nov 2026, jadi nomor UU kemungkinan terbit dalam beberapa hari.
- **Cek berikutnya:** paling lambat 8 Nov 2026 di jdih.setkab.go.id, peraturan.go.id, dan peraturan.bpk.go.id. Sampai ada teks resmi, aturan_bertanggal tidak diubah.

## Cek R-UUPK kedua (4 Nov 2026, tick 274)
- **Hasil: belum terbit.** Nomor UU dan teks resmi belum ada di basis data hukum pemerintah per 4 Nov 2026:
  - JDIH BPK (https://peraturan.bpk.go.id/Search?keywords=Pelindungan+Ketenagakerjaan) tidak memuat Undang-Undang 2026 bertajuk Pelindungan/Perlindungan Ketenagakerjaan; yang muncul hanya Permenaker (mis. Permenaker 2/2026 tentang pekerja migran).
  - JDIH Kemnaker (https://jdih.kemnaker.go.id/) entri terbaru adalah Permenaker 16/2026 (28 Okt 2026) dan Kepmenaker 298-299/2026 (22 Okt 2026), tanpa UU ini.
  - Catatan agar tidak tertukar: UU Nomor 2 Tahun 2026 adalah UU Pelindungan Pekerja Rumah Tangga (diundangkan 30 Apr 2026, jdih.kemnaker.go.id/asset/data_puu/2026uu002.pdf), bukan UU ini.
- **Status menurut berita (sekunder, tidak dipakai sebagai aturan):**
  - Menaker Yassierli, 22 Okt 2026: naskah masih diproses di Kementerian Sekretariat Negara sebelum dipublikasikan lewat JDIH (https://pasardana.id/news/2026/10/22/menaker-uu-perlindungan-ketenagakerjaan-sedang-dalam-proses-di-setneg).
  - Serikat buruh mendesak Presiden menandatangani, ada rumor penundaan (https://www.rctiplus.com/news/detail/inews/5499232/buruh-desak-prabowo-segera-teken-uu-pelindungan-ketenagakerjaan--ada-rumor-penundaan).
  - Target lama "diundangkan 8 Oktober 2026" tidak terjadi (https://investortrust.id/national/117319/ruu-pelindungan-ketenagakerjaan-ditargetkan-diundangkan-8-oktober-2026).
  - Masa transisi satu tahun sejak diundangkan (Kemnaker, https://www.cnbcindonesia.com/news/20261006151306-4-773810/uu-pelindungan-ketenagakerjaan-resmi-disahkan-kapan-efektif-berlaku). Jumlah bab/pasal berbeda antarberita (20 bab 262 pasal di draf, 23 bab 313 pasal versi disahkan).
- **Batas 30 hari (UUD 1945 Pasal 20 ayat (5)):** RUU yang telah disetujui bersama tetapi tidak disahkan Presiden dalam 30 hari sah menjadi undang-undang dan wajib diundangkan; kalimat pengesahannya diatur UU 12/2011 Pasal 73. Isi ini kini cocok di beberapa sumber (setkab.go.id https://setkab.go.id/yusril-sarankan-sby-dan-jokowi-tidak-tandatangani-ruu-pilkada/, hukumonline), tetapi naskah resmi UUD belum dibaca langsung: tetap B. Bila dihitung dari persetujuan bersama 6 Okt 2026, batasnya 5 Nov 2026.
- **Akibat untuk Nadi:** tidak ada baris aturan_bertanggal yang diubah atau ditambah; F1-05 (PPh/BPJS/lembur PP 35/2021), F3-07 (upah sehari PP 36/2021 Pasal 17, Pasal 40 dan 50 PP 35/2021), F4-09 (pesangon PP 35/2021), dan Q-22 (pola kerja Pasal 21) tetap memakai aturan lama yang masih berlaku. Bahkan setelah terbit, aturan lama berlaku sampai masa transisi selesai, jadi baris baru nanti diberi berlaku_dari = tanggal berlaku UU, bukan tanggal pengundangan.
- **Cek berikutnya:** R-UUPK2, tidak sebelum 8 Nov 2026 (next_task.py tunda), di peraturan.bpk.go.id, jdih.setneg.go.id, dan jdih.kemnaker.go.id; bila terbit, kutip pasal waktu kerja, lembur, upah, PKWT, PHK, pesangon dan tulis tabel perbedaan.

## Cek R-UUPK2 (12 Nov 2026): SUDAH TERBIT

Sumber resmi: JDIH BPK https://peraturan.bpk.go.id/Details/359755/uu-no-27-tahun-2026-pelindungan-ketenagakerjaan (dibaca 12 Nov 2026), naskah dari jdih.setneg.go.id.

- **Nomor:** Undang-Undang Nomor 27 Tahun 2026 tentang Pelindungan Ketenagakerjaan.
- **Tanggal:** ditetapkan di Jakarta 28 Oktober 2026, diundangkan 28 Oktober 2026, berlaku 28 Oktober 2026.
- **Sumber pengundangan:** LN 2026 (179), TLN (7222), 176 halaman. Status di JDIH BPK: Berlaku.
- **Hubungan dengan aturan lain (dari metadata JDIH BPK):** mencabut UU No. 13 Tahun 2003 tentang Ketenagakerjaan; mencabut sebagian UU No. 6 Tahun 2023 (Penetapan Perppu Cipta Kerja menjadi UU).
- **Dampak segera ke Nadi:** semua aturan bertanggal yang dasarnya UU 13/2003 atau bagian ketenagakerjaan UU 6/2023 (waktu kerja, lembur, PKWT, PHK, pesangon, THR bila dirujuk) perlu dicek ulang terhadap pasal UU 27/2026 untuk masa sejak 28 Okt 2026. Isi pasal BELUM dibaca: naskah hanya tersedia sebagai unduhan PDF (UU Nomor 27 Tahun 2026.pdf, 12.849.456 byte) dan unduhan berkas menunggu izin Tristan. Sampai pasal dibaca, aturan_bertanggal tidak diubah dan angka baru tidak ditulis dari berita.
- **Berikutnya (R-UUPK2 lanjut):** setelah izin unduh, kutip pasal waktu kerja, lembur, upah, PKWT, PHK, pesangon, dan ketentuan peralihan (peraturan pelaksana yang tetap berlaku), lalu tabel perbedaan terhadap aturan_bertanggal dan F1-05/F3-07/F4-09/Q-22, baris aturan bertanggal berlaku_dari 2026-10-28 dengan tes SQL.
