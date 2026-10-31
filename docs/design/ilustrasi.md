# Ilustrasi khas Nadi (D-03)

Ditulis 1 Nov 2026. Turunan langsung dari DIRECTION.md §1 ("kertas kerja yang hidup") dan §6 (SVG buatan sendiri, garis tinta, isian kunyit datar, tanpa gradien, tanpa foto stok). Tujuannya: keadaan kosong dan onboarding terasa milik Nadi, bukan ilustrasi orang-orang generik bertangan panjang.

## Bahasa gambar
- **Benda kerja, bukan orang.** Nota thermal, buku kas bergaris, stempel, map, HP dengan QR, tablet di pintu, kantong belanja pasar. Tanpa figur manusia (menghindari stereotipe dan masalah representasi), tanpa maskot.
- **Garis tinta** `var(--tinta)` 1,5 px pada viewBox 0 0 160 120, ujung bulat; **satu isian** `var(--kunyit)` datar sebagai stabilo pada satu benda per gambar; latar transparan agar ikut tema terang/gelap.
- **Satu detail hidup**: garis denyut kecil (bentuk logo) di salah satu benda, misalnya di layar HP. Tidak bergerak kecuali `prefers-reduced-motion: no-preference` dan hanya bila keadaan memang sedang memuat.
- Ukuran tampil 120 sampai 160 px di HP, `aria-hidden` (teks di sebelahnya yang menjelaskan), `width`/`height` eksplisit (S61).

## Daftar gambar v1
| Nama | Dipakai di | Isi |
|---|---|---|
| `kosong-feed` | Feed tanpa usulan | nota thermal kosong di atas buku kas, stabilo kunyit di baris pertama |
| `kosong-orang` | /app/orang tanpa orang | map terbuka dengan kartu nama kosong dan stempel "BARU" |
| `kosong-izin` | /app/izin tanpa pengajuan | kalender meja dengan satu tanggal disorot kunyit |
| `kosong-gaji` | /app/gaji belum ada periode | amplop gaji dengan garis denyut |
| `lamar-terkirim` | /lamar setelah kirim | amplop masuk ke kotak pos toko |
| `luring` | /luring | HP dengan sinyal kosong dan nota terlipat |

## Aturan teknis
- Komponen React per gambar di `src/components/ilustrasi/`, SVG sebaris (tanpa berkas gambar, tanpa permintaan jaringan), warna hanya lewat `currentColor` dan `var(--kunyit)` agar lolos S05.
- Dicatat di docs/ASSETS.md sebagai "dibuat sendiri, milik proyek".
- Diuji: snapshot ukuran byte per SVG < 3 KB; axe tanpa pelanggaran; tangkapan 390/1440 terang dan gelap tiap keadaan kosong.

## Kriteria terima (antrean)
Gambar sendiri dalam SVG; foto hanya bila lisensinya bebas dan tercatat. Ditambah: 6 gambar di atas terpasang di keadaan kosong masing-masing, tanpa ungu, gradien, atau figur manusia.
