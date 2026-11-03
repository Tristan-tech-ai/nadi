// H-04: ukuran JavaScript per halaman (byte terkompresi yang diunduh peramban) dan apakah proxy berjalan.
// pakai: node scripts/audit-js.mjs <asal> [keluaran.json]   (halaman /app memakai akun uji dari .env.e2e.local)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const [asal, keluar] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(new URL("../.env.e2e.local", import.meta.url), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const PUBLIK = ["/", "/en", "/demo", "/harga", "/keamanan", "/panduan", "/masuk", "/lamar/status"];
const APLIKASI = ["/app", "/app/lempar", "/app/gaji", "/app/izin", "/app/jadwal", "/app/mata", "/app/peta-usaha", "/app/perusahaan"];

async function ukur(page, jalur) {
  const res = await page.goto(asal + jalur, { waitUntil: "networkidle" });
  const js = await page.evaluate(() =>
    performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script" || r.name.endsWith(".js"))
      .reduce((s, r) => ({ n: s.n + 1, byte: s.byte + (r.encodedBodySize || r.transferSize || 0) }), { n: 0, byte: 0 }));
  return { jalur, status: res?.status(), skrip: js.n, kb: Math.round(js.byte / 1024), proxy: res?.headers()["x-middleware-rewrite"] !== undefined || res?.headers()["x-nadi-proxy"] === "1" };
}

const b = await chromium.launch();
const k = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await k.newPage();
const hasil = [];
for (const j of PUBLIK) hasil.push(await ukur(p, j));
await p.goto(`${asal}/masuk?next=/app`);
await p.getByLabel("Email").fill(env.E2E_EMAIL_A);
await p.getByLabel("Kata sandi").fill(env.E2E_SANDI);
await p.getByRole("button", { name: "Masuk" }).click();
await p.waitForURL((u) => u.pathname === "/app");
for (const j of APLIKASI) hasil.push(await ukur(p, j));
await b.close();
for (const h of hasil) console.log(`${h.jalur.padEnd(18)} ${String(h.status).padEnd(4)} ${String(h.skrip).padStart(3)} skrip ${String(h.kb).padStart(5)} KB`);
if (keluar) writeFileSync(keluar, JSON.stringify(hasil, null, 1));
