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
