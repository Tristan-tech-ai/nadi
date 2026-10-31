# Mutu landing (F0-11)

Diukur 31 Okt 2026 pada build produksi lokal (`next start`, port 3100) dengan Lighthouse 13.6.0 (mode mobile bawaan, Chrome headless).

| Kategori | Skor |
|---|---|
| Performa | 100 |
| Aksesibilitas | 100 |
| Praktik terbaik | 100 |
| SEO | 100 |

LCP 0,76 dtk, TBT 22 ms, CLS 0. Halaman statis (prerender), satu komponen klien kecil (demo nota).

Pemeriksaan lain (e2e/asap.spec.ts): axe tanpa pelanggaran serius di 390 px dan 1440 px, terang dan gelap; judul utama paling banyak 3 baris di 390 px (ANTI-SLOP S12); demo nota bisa disetujui, ditolak, dan diulang; `scripts/cek-slop.py` bersih.

Belum diukur: produksi Vercel (deploy menunggu GitHub App, F0-13).
