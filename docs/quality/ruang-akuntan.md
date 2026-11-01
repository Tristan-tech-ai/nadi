# Hasil uji F4-08 Ruang Akuntan dan ekspor BPMP (1 Nov 2026)

Sumber: template DJP "BPMP Excel to XML v.3" (docs/research/coretax-bpmp.md).

| Butir | Hasil |
|---|---|
| Migrasi 20261101031000_ruang_akuntan, 20261101031100_undang_akuntan | sidik e48b32fe dan 951c8631 = database (81 migrasi). Sebelum apply: fungsi belum ada |
| Tes SQL ruang_akuntan.test.sql | 13/13 (setelah satu kesalahan data uji: topi uji mulai hari ini sehingga posisi bulan September memang "Pegawai"; data uji diberi tanggal mulai 1 Jan): identitas NPWP 16 angka, ID TKU 22 angka diawali NPWP (bawaan NPWP + 000000), pemilik atau akuntan; data_bpmp hanya slip disetujui dan tidak ditahan, dengan PTKP dan posisi dari topi bulan itu, tanpa hash NIK; draf tanpa baris; ruang_akuntan klien akuntan lebih dulu, keanggotaan nonaktif tidak ikut; staf dan anon ditolak |
| Tes SQL undang_akuntan.test.sql | 15/15: jawaban sama untuk email terdaftar dan tidak (tidak bisa dipakai menebak email), email tanpa beda huruf besar, akun staf sintetis dan bukan-email ditolak, admin yang ada tidak diturunkan, cabut = nonaktif (baris tetap) dan akuntan tak lagi melihat usaha itu, ditambah lagi aktif kembali, admin dan anon ditolak |
| Vitest src/lib/pajak/bpmp.test.ts | merah (modul belum ada), lalu 3/3 + 1 pembanding template resmi (env BPMP_TEMPLATE ke berkas DJP) lulus: bruto PPh = pendapatan + JKK, tarif TER per kategori PTKP, tanggal potong akhir bulan, PTKP kosong dilewati dengan alasan, Desember tidak diekspor; buku: sheet DATA, A1/B1 NPWP, judul baris 4 kolom B..N literal dari template, data baris 5, NIK kosong dengan catatan (diperiksa di comments xml dalam zip). Merah sengaja: dua judul ditukar, tertangkap pembanding resmi; tes literal ditambahkan supaya gerbang tanpa berkas DJP juga merah |
| e2e apps/web/e2e/akuntan.spec.ts (lokal, desktop) | lulus: pemilik menambahkan akun B sebagai akuntan "Uji Gaji E2E"; B membuka klien dari Ruang Akuntan, mengisi NPWP, mengunduh BPMP; berkas dibaca ulang: judul template v.3, Resident, 21-100-01, bruto > 0, tarif angka, ID TKU bawaan, NIK kosong. axe 0 serius 390/1440 terang/gelap. Usaha aktif A dan B dikembalikan |

Dicatat jujur: kolom NIK harus diisi akuntan di Excel (Nadi tidak menyimpan NIK lengkap); konversi ke XML memakai konverter resmi DJP, bukan Nadi; e2e ini mengubah usaha aktif akun A sesaat, jadi tidak dijalankan paralel dengan gaji.spec.
