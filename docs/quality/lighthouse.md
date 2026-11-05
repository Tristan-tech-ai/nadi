# Lighthouse mobile halaman aplikasi

Lighthouse 13.6.0, emulasi mobile bawaan, build produksi lokal (`pnpm build` lalu `pnpm start -p 3100`), masuk sebagai akun uji B
(kepala Cookie dari `lh_masuk.cjs`, berkas kuki dihapus setelahnya).

| Tanggal | Halaman | Performa | Aksesibilitas | Catatan |
|---|---|---|---|---|
| 6 Nov 2026 | /app/kinerja | 90 | 100 | |
| 6 Nov 2026 | /app/kursus | 90 | 96 | target-size: tombol "Tambah soal" di garis lipat tertutup sebagian oleh navigasi bawah sticky (terlihat 117,5 x 19 px) |
| 6 Nov 2026 | /sertifikat/<kode> | 96 | 100 | halaman publik |
| 6 Nov 2026 | /app/wawasan | 91 | 100 | |
| 6 Nov 2026 | /app/buku/pembiayaan | 91 | 100 | |
| 6 Nov 2026 | /app/alur | 90 | 97 | target-size: sama, tombol di garis lipat tertutup sebagian navigasi bawah (terlihat 68,2 x 21 px) |
| 6 Nov 2026 | /app/tanya | 100 | 100 | |

Temuan sistemik: navigasi bawah aplikasi `sticky bottom-0` menutupi baris paling bawah layar pertama, jadi halaman mana pun yang
kebetulan punya tombol tepat di garis lipat gagal audit target-size. Perbaikan yang benar ada di kerangka aplikasi (Q-41), bukan
menggeser isi per halaman.
