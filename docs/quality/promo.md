# Video promo, teaser, potongan fitur (F6-06, P-01, P-02)

Dibuat 4 Nov 2026 dari tangkapan layar produksi https://nadi-swart.vercel.app (desain setelah D-10/D-11, data sintetis Warung Uji A dan usaha contoh). Pengambilan layar: `HP=1 node apps/web/scripts/promo-layar.mjs` dan tanpa HP=1.

| Berkas | Ukuran | Durasi | Isi |
|---|---|---|---|
| docs/promo/nadi-promo.mp4 | 1920x1080, 30 fps | 46,0 dtk | kertas berserakan, Lempar nota (dicetak baris demi baris lalu usulan), Feed dicap DISETUJUI, tagihan QRIS, Peta warung, Sarapan data, ajakan /demo |
| docs/promo/teaser-15.mp4 | 1080x1920, 30 fps | 15,0 dtk | "Nota numpuk lagi?", foto nota, usulan dicap, "Nadi yang merapikan.", ajakan /demo |
| docs/promo/fitur/lempar.mp4 | 1080x1920 | 22,0 dtk | layar Lempar Saja, nota terbaca, usulan |
| docs/promo/fitur/feed.mp4 | 1080x1920 | 22,0 dtk | kartu usulan dicap, alur nyata invoice |
| docs/promo/fitur/mata.mp4 | 1080x1920 | 22,0 dtk | Mata membaca rekaman (zona, log perubahan), Peta warung langsung |
| docs/promo/fitur/sarapan.mp4 | 1080x1920 | 22,0 dtk | Sarapan data dua temuan berdampak rupiah |

## Pemeriksaan
- **Lint komposisi:** `npx hyperframes@0.9.8 check` ok=true, 0 galat. Info audio_none disengaja karena video tanpa suara (docs/ASSETS.md). Sisa peringatan berupa saran struktur Studio, bukan cacat render.
- **Pratinjau `snapshot`:** semua komposisi diperiksa per adegan. Yang diperbaiki:
  - gulir layar yang menyisakan ruang kosong (gulir kini dihitung dari ukuran gambar);
  - judul "QRIS-mu" yang terpotong di tanda hubung;
  - cap yang menutupi judul kartu;
  - layar Mata HP yang tertimpa navigasi bawah, kini dipotong dua.
- **Bingkai MP4 hasil render:** diambil dengan ffmpeg dan diperiksa: promo 6 bingkai, teaser 5, mata 3.
- **Anti-slop:**
  - Tanpa ungu, gradien, emoji, atau tanda pisah panjang.
  - Huruf Plus Jakarta Sans dan Bricolage Grotesque (OFL), warna token DIRECTION.md.
  - Angka dan kalimat di layar diambil dari layar Nadi sendiri atau dari dokumen bersumber.
- **Tautan ajakan:** nadi-swart.vercel.app/demo, domain produksi yang terindeks (DECISIONS 3 Nov 2026).

## Batas
- Tanpa suara dan musik.
- Teks layar hanya bahasa Indonesia.
- Layar Feed di video berasal dari usaha contoh dan Warung Uji A, bukan pengguna nyata.

## Membuat ulang
Komposisi disusun ulang dari `docs/promo/film/buat.py` (`python -I buat.py` dari folder film). Promo di-render dengan `npx --yes hyperframes@0.9.8 render -o ../nadi-promo.mp4`.

Untuk varian di folder varian/:
1. Salin ke proyek terpisah sebagai index.html, dengan jalur `../assets/` diganti `assets/`. Alasannya, check hanya menerima satu komposisi akar per proyek.
2. Render dengan perintah yang sama.
