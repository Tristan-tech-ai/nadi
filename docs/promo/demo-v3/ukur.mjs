// Video demo v3: ukur kotak elemen di potongan DOM asli (CSS aplikasi) supaya lapisan (stabilo, cap, kursor) diposisikan dari
// elemen yang sebenarnya, bukan ditebak (UJI-GERAK.md masalah 2 dan 5). Jalankan: node ukur.mjs (dari folder ini).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(join(import.meta.dirname, "..", "..", "..", "apps", "web", "package.json"));
const { chromium } = require("@playwright/test");
const AKAR = import.meta.dirname;
const APP = join(AKAR, "..", "film-langsung", "assets", "app");
const TARGET = {
  "invoice-publik": { status: "text=/belum dibayar/i", total: "text=Total >> nth=-1", totalrp: "text=Rp1.448.000 >> nth=-2", qris: "svg[viewBox='0 0 39 39']", nominal: "text=Pindai, lalu ketik nominal" },
  "kartu-nota-dicap": { kartu: "article", cap: ".cap-turun > span" },
  "kartu-nota": { kartu: "article", judul: "article h3", dampak: "span[title='Rp376.500']", setujui: "button:text-is('Setujui')", tolak: "button:text-is('Tolak')", baru: "[data-testid=penanda-baru]" },
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const hasil = {};
for (const [nama, sel] of Object.entries(TARGET)) {
  const frag = readFileSync(join(APP, `${nama}.html`), "utf8");
  const lebar = readFileSync(join(APP, `${nama}.png`)).readUInt32BE(16);
  const sem = join(APP, "_ukur3.html");
  writeFileSync(sem, `<!doctype html><html lang="id"><head><link rel="stylesheet" href="app.css"></head><body style="margin:0"><div class="app" id="w" style="width:${lebar}px">${frag}</div></body></html>`);
  await p.goto("file:///" + sem.replaceAll("\\", "/"));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const w = await p.locator("#w").boundingBox();
  hasil[nama] = { lebar, tinggi: Math.round(w.height) };
  for (const [k, s] of Object.entries(sel)) {
    const r = await p.locator("#w").locator(s).first().boundingBox({ timeout: 2000 }).catch(() => null);
    hasil[nama][k] = r ? { x: Math.round(r.x - w.x), y: Math.round(r.y - w.y), w: Math.round(r.width), h: Math.round(r.height) } : null;
  }
  // Rentang teks "Rp376.500" di dalam judul (untuk stabilo tepat di angka).
  if (nama === "kartu-nota") hasil[nama].judul_rp = await p.evaluate(() => {
    const h = document.querySelector("#w article h3"); const t = h.firstChild; const i = t.textContent.indexOf("Rp376.500");
    const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 9); const a = r.getBoundingClientRect(); const w = document.querySelector("#w").getBoundingClientRect();
    return { x: Math.round(a.x - w.x), y: Math.round(a.y - w.y), w: Math.round(a.width), h: Math.round(a.height) };
  });
}
writeFileSync(join(AKAR, "ukur.json"), JSON.stringify(hasil, null, 1));
console.log(JSON.stringify(hasil));
await b.close();
