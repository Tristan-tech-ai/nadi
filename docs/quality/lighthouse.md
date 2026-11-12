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

## Setelah kerangka adaptif U-01 (6 Nov 2026)

Bilah bawah HP kini `position: fixed` dengan pengganjal. Aturan target-size axe tidak menghitung elemen fixed sebagai penutup tombol, sedangkan elemen sticky dihitung (`_isFixedPosition` di axe-core 4.14.0). Itu sebabnya skor aksesibilitas yang sebelumnya 96/97 sekarang 100.

| Halaman | Performa | Aksesibilitas | CLS | Catatan |
|---|---|---|---|---|
| /app | 92 | 100 | 0 | Sebelumnya 84 dengan CLS 0,186. Ringkasan uang dan Sarapan Data dipindah ke bawah daftar keputusan |
| /app/invoice | 93 | 100 | 0 | |
| /app/orang | 92 | 100 | 0,002 | Deretan tautan fitur kecil dibuang (gagal target-size; fiturnya ada di navigasi ruang) |
| /app/kursus, /app/alur, dan 5 halaman Q-41 lainnya | 90-100 | 100 | | Diukur dengan bilah bawah fixed yang sama (scratchpad nav-fixed sebelum U-01) |

## Beranda produksi setelah SEO-01 (12 Nov 2026, Q-54)

Lighthouse 13.6.0, emulasi mobile bawaan, langsung ke produksi https://nadiusaha.my.id (deploy 65ce9c7: film landing v4b, og:image, JSON-LD). Laporan JSON: `docs/quality/lighthouse-beranda/id.json` dan `en.json`.

| Halaman | Performa | Aksesibilitas | Best practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| / | 99 | 100 | 100 | 100 | 1,6 dtk | 0 | 20 ms |
| /en | 100 | 100 | 100 | 100 | 1,1 dtk | 0 | 0 ms |

Film landing tidak menurunkan performa, jadi tidak ada perubahan preload. Sisa saran Lighthouse (JavaScript tak terpakai, legacy JS, pengiriman gambar) bernilai insight, bukan kegagalan audit.
