// Lembar banding logo: setiap konsep di 16/24/32/64/180 px, terang dan gelap, plus wordmark.
// pakai: node logo-lembar.mjs <dir-logo> <keluar.png>
import { chromium } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [dir, keluar] = process.argv.slice(2);
const berkas = readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
const gelap = (s) => s.replaceAll("#1C1B18", "#ECE7DD").replaceAll("#E9A825", "#F0B53D");
const sel = (svg, px) => `<img width="${px}" height="${px}" src="data:image/svg+xml,${encodeURIComponent(svg)}">`;
const baris = (nama, svg, bg, fg, kata) => `
  <div class="baris" style="background:${bg};color:${fg}">
    <div class="nama">${nama}</div>
    ${[16, 24, 32, 64, 180].map((p) => `<div class="c">${sel(svg, p)}<small>${p}</small></div>`).join("")}
    <div class="kata">${sel(svg, 36)}<span>nadi</span></div>
  </div>`;
let isi = "";
for (const f of berkas) {
  const s = readFileSync(join(dir, f), "utf8");
  isi += baris(f.replace(".svg", ""), s, "#F6F2EA", "#1C1B18");
  isi += baris(f.replace(".svg", "") + " gelap", gelap(s), "#141311", "#ECE7DD");
}
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=Plus+Jakarta+Sans:wght@500&display=block">
<style>body{margin:0;font-family:'Plus Jakarta Sans'} .baris{display:flex;align-items:flex-end;gap:28px;padding:18px 24px}
.nama{width:200px;font-size:14px} .c{display:flex;flex-direction:column;align-items:center;gap:4px} small{font-size:11px;opacity:.6}
.kata{display:flex;align-items:center;gap:8px;margin-left:24px} .kata span{font-family:'Bricolage Grotesque';font-weight:800;font-size:30px;letter-spacing:-0.02em}</style>
</head><body>${isi}</body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: "networkidle" });
await p.screenshot({ path: keluar, fullPage: true });
await b.close();
console.log("lembar", keluar);
