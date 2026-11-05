// D-28: ukur kotak elemen penting di tiap potongan DOM asli (lebar 1440 px, CSS aplikasi) supaya kamera dan kursor di buat.py
// mendarat di tombol dan baris yang sebenarnya. Jalankan dari folder ini: NODE_PATH=../../../apps/web/node_modules node ukur.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(join(import.meta.dirname, "..", "..", "..", "apps", "web", "package.json"));
const { chromium } = require("@playwright/test");

const AKAR = import.meta.dirname;
const TARGET = {
  "kartu-nota": { setujui: "button:text-is('Setujui')", kartu: "article" },
  "kartu-nota-dicap": { kartu: "article" },
  "lempar-kosong": { area: "[data-testid=area-lempar]", judul: "h1" },
  "lempar-membaca": { daftar: "[data-testid=daftar-lempar]", area: "[data-testid=area-lempar]" },
  "lempar-siap": { daftar: "[data-testid=daftar-lempar]", kefeed: "[data-testid=ke-feed]" },
  feed: { setujui: "article:has-text('Catat belanja') button:text-is('Setujui')", nota: "article:has-text('Catat belanja')", kartu1: "article >> nth=0", kartu5: "article >> nth=4", ringkas: "h1" },
  "invoice-publik": { total: "text=Total >> nth=-1", qris: "svg[viewBox='0 0 39 39']", kepala: "h1", bayar: "text=Cara bayar" },
  "peta-panas": { svg: "svg", jumlah: "[data-testid=panas-jumlah]", daftar: "ul", antrean: "[data-testid=panas-zona][data-nama=Antrean]" },
  sarapan: { satu: "p >> nth=2" },
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const hasil = {};
for (const [nama, sel] of Object.entries(TARGET)) {
  const frag = readFileSync(join(AKAR, "assets", "app", `${nama}.html`), "utf8");
  // Lebar wadah = lebar tangkapan asli elemen (PNG), supaya tata letak sama dengan di aplikasi.
  const png = readFileSync(join(AKAR, "assets", "app", `${nama}.png`));
  const lebar = png.readUInt32BE(16);
  const sem = join(AKAR, "assets", "app", `_ukur.html`);
  writeFileSync(sem, `<!doctype html><html lang="id"><head><link rel="stylesheet" href="app.css"></head><style>.app nav[aria-label="Navigasi utama"], .app .fixed { display: none !important; }</style><body style="margin:0"><div class="app" id="w" style="width:${lebar}px">${frag}</div></body></html>`);
  await p.goto("file:///" + sem.replaceAll("\\", "/"));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const w = await p.locator("#w").boundingBox();
  hasil[nama] = { lebar, tinggi: Math.round(w.height) };
  for (const [k, s] of Object.entries(sel)) {
    const r = await p.locator("#w").locator(s).first().boundingBox({ timeout: 2000 }).catch(() => null);
    hasil[nama][k] = r ? { x: Math.round(r.x - w.x), y: Math.round(r.y - w.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
  }
}
writeFileSync(join(AKAR, "ukur.json"), JSON.stringify(hasil, null, 1));
console.log(JSON.stringify(hasil));
await b.close();
