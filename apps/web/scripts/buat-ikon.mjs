// Ikon PWA, favicon, dan ikon Apple dari tanda Nadi (src/components/ui/logo-jalur.ts). Jalankan: node scripts/buat-ikon.mjs
import { chromium } from "@playwright/test";
import { svgTanda } from "../src/components/ui/logo-jalur.ts";

const KERTAS = "#F6F2EA", TINTA = "#1C1B18", KUNYIT = "#E9A825"; // slop-ok: token kertas/tinta/kunyit untuk berkas PNG
const daftar = [
  ["public/ikon/ikon-192.png", 192, 4], ["public/ikon/ikon-512.png", 512, 4], ["public/ikon/ikon-maskable-512.png", 512, 8],
  ["public/ikon/apple-touch-icon.png", 180, 4], ["src/app/icon.png", 192, 4], ["src/app/apple-icon.png", 180, 4],
];
const b = await chromium.launch(); const p = await b.newPage();
for (const [jalur, ukuran, pad] of daftar) {
  await p.setViewportSize({ width: ukuran, height: ukuran });
  await p.setContent(`<style>body{margin:0}</style><img src="data:image/svg+xml,${encodeURIComponent(svgTanda(TINTA, KUNYIT, KERTAS, pad))}" width="${ukuran}" height="${ukuran}">`);
  await p.screenshot({ path: jalur });
}
await b.close(); console.log("ikon dibuat", daftar.length);
