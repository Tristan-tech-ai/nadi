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
  "tinjau-draf": { tinjau: "[data-testid=tinjau-draf]", ringkas: "[data-testid=ringkas-draf]", terapkan: "[data-testid=terapkan-draf]", ragu: "text=Perlu dicek: Keyakinan AI 60%", judul: "h1", gaji: "text=Gaji tidak dicentang otomatis" },
  "invoice-publik": { status: "text=/belum dibayar/i", total: "text=Total >> nth=-1", totalrp: "text=Rp1.448.000 >> nth=-2", qris: "svg[viewBox='0 0 39 39']", nominal: "text=Pindai, lalu ketik nominal" },
  "kartu-nota-dicap": { kartu: "article", cap: ".cap-turun > span" },
  "gaji-draf": { judul: "h1", pesan: "text=/Draf gaji siap/", daftar: "[data-testid=daftar-slip]", tahan1: ":text-is('Ditahan') >> nth=0", alasan1: "text=/Belum ada absen atau izin sejak/ >> nth=0",
    bpjs: "text=BPJS Kesehatan >> nth=0", pph: ":text-is('PPh 21') >> visible=true >> nth=0", rincian1: "[data-testid=daftar-slip] details >> nth=0", tahan2: ":text-is('Ditahan') >> nth=1",
    input2: "input[placeholder^='Misalnya'] >> nth=1", lepas2: "button:text-is('Lepas') >> nth=1", setujui: "button:text-is('Setujui gaji bulan ini')" },
  alur: { baru: "text=Alur baru", nama: "input[name=nama] >> nth=0", ketika: "select[name=pemicu]", kartu: "input[name=kartu]", kerja: "input[name=kerja]", buat: "button:text-is('Buat alur')", form: "form:has(select[name=pemicu])" },
  tanya: { judul: "h1", tanya: "input[name=tanya]", tombol: "button:text-is('Tanya')", jawab: "[data-testid=tanya-jawaban]", rp: "text=Rp1.448.000", sumber: "text=Lihat sumbernya" },
  sarapan: { judul: "text=Sarapan data", d1: "text=Dampak >> nth=0", d2: "text=Dampak >> nth=1", rp1: "text=Rp1.406.000 >> nth=0" },
  "feed-rincian": { kartu: "article:has-text('INV/2026/X/0007')", kalau: "article:has-text('INV/2026/X/0007') >> text=Kalau disetujui:", rincian: "article:has-text('INV/2026/X/0007') >> [data-testid=rincian-usulan]", tambah: "article:has-text('INV/2026/X/0007') >> text=/Akan ditambah/", setujui: "article:has-text('INV/2026/X/0007') >> button:text-is('Setujui')", jenis: "article:has-text('INV/2026/X/0007') >> text=Jatuh tempo" },
  "feed-tutup": { kartu: "article:has-text('INV/2026/X/0007')", kalau: "article:has-text('INV/2026/X/0007') >> text=Kalau disetujui:", lihat: "article:has-text('INV/2026/X/0007') >> [data-testid=rincian-usulan] summary", setujui: "article:has-text('INV/2026/X/0007') >> button:text-is('Setujui')" },
  "lempar-kosong": { area: "[data-testid=area-lempar]" },
  "lempar-membaca": { daftar: "[data-testid=daftar-lempar]", area: "[data-testid=area-lempar]" },
  "lempar-siap": { daftar: "[data-testid=daftar-lempar]", kefeed: "[data-testid=ke-feed]", area: "[data-testid=area-lempar]", s0: "text=/^Siap disetujui:/ >> nth=0", f0: "[data-testid=daftar-lempar] > li >> nth=0", s1: "text=/^Siap disetujui:/ >> nth=1", f1: "[data-testid=daftar-lempar] > li >> nth=1", s2: "text=/^Siap disetujui:/ >> nth=2", f2: "[data-testid=daftar-lempar] > li >> nth=2", s3: "text=/^Siap disetujui:/ >> nth=3", f3: "[data-testid=daftar-lempar] > li >> nth=3", s4: "text=/^Siap disetujui:/ >> nth=4", f4: "[data-testid=daftar-lempar] > li >> nth=4" },
  "peta-panas": { svg: "svg", jumlah: "[data-testid=panas-jumlah]", daftar: "ul", antrean: "[data-testid=panas-zona][data-nama=Antrean]", jalur: "text=Jalur yang paling sering", jalur1: "ol > li >> nth=0", ramai: "text=Jam paling ramai", tunggu: "text=Menunggu di antrean" },
  "mata-panel": { papan: "text=Papan informasi kamera", uu: "text=/UU 27\/2022/", centang: "input[type=checkbox] >> nth=0", cetak: "text=Cetak papan informasi", judul: "text=Hitung kunjungan dari kamera atas" },
  "kartu-nota": { kartu: "article", judul: "article h3", dampak: "span[title='Rp376.500']", setujui: "button:text-is('Setujui')", tolak: "button:text-is('Tolak')", baru: "[data-testid=penanda-baru]" },
};
// Keadaan film yang berbeda dari tangkapan: Rincian slip pertama dibuka (sama persis dengan OLAH di buat.py).
const OLAH = { "gaji-draf": (h) => h.replace('<details class="mt-2 text-sm">', '<details open class="mt-2 text-sm">'),
  "feed-tutup": (h) => h.replace('data-testid="rincian-usulan" open=""', 'data-testid="rincian-usulan"') };
const ASAL = { "feed-tutup": "feed-rincian" };  // keadaan lain dari tangkapan yang sama
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const hasil = {};
for (const [nama, sel] of Object.entries(TARGET)) {
  const frag = (OLAH[nama] ?? ((h) => h))(readFileSync(join(APP, `${ASAL[nama] ?? nama}.html`), "utf8"));
  const lebar = readFileSync(join(APP, `${ASAL[nama] ?? nama}.png`)).readUInt32BE(16);
  const sem = join(APP, "_ukur3.html");
  writeFileSync(sem, `<!doctype html><html lang="id"><head><link rel="stylesheet" href="${process.env.CSS3 ?? "app.css"}"><style>.app .sticky:not(header) { position: static !important; }</style></head><body style="margin:0"><div class="app" id="w" style="width:${lebar}px">${frag}</div></body></html>`);
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
