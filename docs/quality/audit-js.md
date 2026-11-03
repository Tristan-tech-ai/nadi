# Audit fungsi serverless dan JS per halaman (H-04)

4 Nov 2026. Alat: `apps/web/scripts/audit-js.mjs <asal>` (Playwright, HP 390 px, byte terkompresi semua skrip yang diunduh
sampai networkidle, termasuk prefetch tautan di layar pertama). Produksi https://nadi-swart.vercel.app.

## Panggilan fungsi
- Rute dari build (Next 16.4.3): statis (○) untuk semua halaman publik (/, /en, /demo, /harga, /keamanan, /privasi, /syarat,
  /tentang, /panduan, /daftar, /kios, /lamar/status, /slip, /luring); PPR (◐) untuk /app/*, /masuk, /absen, /oauth/izinkan,
  /lamar/[kode], /i/[kode], /v/[kode], /cetak; dinamis (ƒ) hanya API (MCP, OAuth), /auth/konfirmasi, /app/lempar/terima,
  /app/akuntan/bpmp, /app/skill.
- **Temuan**: proxy (src/proxy.ts) cocok dengan hampir semua jalur, jadi setiap kunjungan halaman publik statis tetap
  menjalankan satu fungsi proxy (menyegarkan sesi yang tidak ada).
- **Dipangkas**: matcher kini hanya /app, /absen, /kios, /cetak, /oauth, /masuk, /auth, dan "/" bila ada cookie
  nadi_bahasa=en (syarat `has`, docs node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
  Halaman publik statis dilayani CDN tanpa fungsi. Bukti: e2e bahasa di produksi (cookie en tetap diarahkan ke /en), e2e auth,
  peta, mata, feed-hp lulus.

## JavaScript per halaman (KB terkompresi)
| Halaman | Sebelum | Sesudah |
|---|---|---|
| / | 231 | 164 |
| /en | 231 | 164 |
| /demo | 231 | 231 (klien Supabase kini dimuat saat Peta Usaha tampil) |
| /harga | 157 | 157 |
| /keamanan | 157 | 157 |
| /panduan | 156 | 156 |
| /masuk | 153 | 153 |
| /lamar/status | 207 | 207 |
| /app | 193 | 190 |
| /app/lempar | 275 | 275 |
| /app/perusahaan | 265 | 197 |
| /app/peta-usaha | 259 | 260 |

Penyebab beranda +74 KB: tautan "Buka usaha contoh" di layar pertama membuat Next mem-prefetch JS /demo, dan /demo membawa
seluruh klien Supabase (Realtime untuk Peta Usaha, 259 KB mentah / 67 KB terkompresi) di bundel awalnya. Klien itu kini
diimpor dinamis di dalam effect Peta Usaha.

## Gerbang
e2e/asap-produksi.spec.ts memeriksa anggaran harian (workflow asap.yml): / dan /en 190 KB, /harga /keamanan /panduan 180 KB,
/masuk 176 KB. Merah sengaja: ANGGARAN_JS_KALI=0.5 membuat 6 dari 6 gagal; jalan normal lulus.

## Sisa (bukan bagian tugas ini)
/app/lempar (275 KB) dan /app/izin (266 KB) terbesar di aplikasi; kandidat berikutnya adalah tesseract/OCR dan kamera yang
dimuat hanya saat dipakai.
