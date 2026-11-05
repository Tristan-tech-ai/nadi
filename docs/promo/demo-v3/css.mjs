// Video demo v3: unduh CSS aplikasi terbaru dari produksi (Tailwind satu bundel) + font ke css/ (diabaikan git), supaya potongan
// DOM yang ditangkap sekarang (mis. tinjau-draf dengan kelas min-[600px]:grid-cols-3) tampil sama dengan aplikasi. Jalankan: node css.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const BASE = "https://nadi-swart.vercel.app";
const KELUAR = join(import.meta.dirname, "css");
mkdirSync(join(KELUAR, "media"), { recursive: true });
const html = await (await fetch(`${BASE}/masuk`)).text();
const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => new URL(m[1], BASE).href);
let teks = "";
for (const h of hrefs) teks += (await (await fetch(h)).text()) + "\n";
const media = [...new Set([...teks.matchAll(/url\((?:\.\.\/media\/|\/_next\/static\/media\/)([^)]+)\)/g)].map((m) => m[1]))];
for (const m of media) writeFileSync(join(KELUAR, "media", m), Buffer.from(await (await fetch(`${BASE}/_next/static/media/${m}`)).arrayBuffer()));
writeFileSync(join(KELUAR, "app.css"), teks.replaceAll("../media/", "media/").replaceAll("/_next/static/media/", "media/"));
console.log("css", hrefs.length, "berkas", teks.length, "byte,", media.length, "font; min-[600px]:", teks.includes("min-\[600px\]"));
