# Landing 2 (D-20) dan halaman fitur (D-25), 4 Nov 2026

| Ukuran | Sebelum (landing D-11) | Sesudah (produksi) |
|---|---|---|
| Taste Skill `inspect.mjs`, 1440/768/390 | 11 FAIL, 8 WARN | 0 FAIL, 5 WARN |
| Judul pahlawan | 10 kata, 4 baris | 5 kata, 2 baris di 390/768/1440 |
| Gambar dan potongan antarmuka | 0 | potongan antarmuka bertanda data-ui (HP, nota, kartu, 9 pintu fitur) |
| Elemen bergerak | 7 | pengait digerakkan gulir, 3 ketukan, 9 visual fitur, penggeser |
| Lighthouse mobile performa / aksesibilitas | 97 / 100 | 100 / 100 |

WARN yang dipertahankan:
- **Latar halaman #F6F2EA:** ini latar `body` milik aplikasi, terlihat hanya saat halaman ditarik melewati batas.
- **Tanpa foto dan tanpa video sungguhan:** perintah Tristan meminta aset dibuat sendiri. Video promo baru (D-21) akan menjadi gambar bergerak.
- **Margin 106/123 px di 1440 px:** asalnya kertas miring di pengait.
- **Nota di 390 px terbaca sebagai pernyataan:** nota itu potongan dokumen, bukan kalimat.

Berkas:
- sebelum-1440.jpg, sebelum-390.jpg
- sesudah-1440.jpg, sesudah-390.jpg, sesudah-1440-halaman.jpg
- fitur-mata-1440.jpg
