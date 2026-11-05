// D-28: tangkap DOM asli Nadi (produksi, usaha contoh "Toko Bu Sari" akun uji B, dan /demo) untuk film promo yang dirender dari
// kode. CSS aplikasi disalin sekali (font Next ikut diunduh), tiap layar/keadaan disimpan sebagai potongan HTML tanpa skrip.
// Keluaran: docs/promo/film-langsung/assets/app/{app.css, media/*, <nama>.html, <nama>.png}. Jalankan dari apps/web setelah
// node scripts/promo-siapkan.mjs: node scripts/promo-dom.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baca = (n) => { try { return Object.fromEntries(readFileSync(join(import.meta.dirname, "..", n), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])); } catch { return {}; } };
const E = { ...baca(".env.local"), ...baca(".env.e2e.local") };
const BASE = "https://nadi-swart.vercel.app";
const KELUAR = join(import.meta.dirname, "..", "..", "..", "docs", "promo", "film-langsung", "assets", "app");
const KORPUS = join(import.meta.dirname, "..", "..", "..", "fixtures", "korpus");
mkdirSync(join(KELUAR, "media"), { recursive: true });
const info = JSON.parse(readFileSync(join(import.meta.dirname, "..", "test-results", "promo-bu-sari.json"), "utf8"));

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI });
await sb.rpc("pindah_perusahaan", { p_perusahaan: info.usaha });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "id-ID", timezoneId: "Asia/Makassar", colorScheme: "light" });
await ctx.route("https://wa.me/**", (r) => r.abort());
const p = await ctx.newPage();
// TAHAP=a,b menjalankan sebagian (lewati unggahan ulang Lempar bila sudah diambil).
const TAHAP = new Set((process.env.TAHAP ?? "feed,lempar,kartu,invoice,mata,sarapan").split(","));

let cssSudah = false;
async function css() {
  if (cssSudah) return;
  const hrefs = await p.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href));
  let teks = "";
  for (const h of hrefs) teks += (await (await ctx.request.get(h)).text()) + "\n";
  // Font Next: url(../media/x.woff2) relatif terhadap /_next/static/css/; diunduh ke media/ di samping app.css.
  const media = [...new Set([...teks.matchAll(/url\((?:\.\.\/media\/|\/_next\/static\/media\/)([^)]+)\)/g)].map((m) => m[1]))];
  for (const m of media) writeFileSync(join(KELUAR, "media", m), await (await ctx.request.get(`${BASE}/_next/static/media/${m}`)).body());
  writeFileSync(join(KELUAR, "app.css"), teks.replaceAll("../media/", "media/").replaceAll("/_next/static/media/", "media/"));
  console.log("css", hrefs.length, "berkas,", media.length, "font");
  cssSudah = true;
}
/** Simpan elemen (atau body) sebagai potongan HTML: skrip, pengumum rute, dan atribut acara dibuang; gambar jadi data URI. */
async function simpan(nama, pilih = "body") {
  await css();
  const html = await p.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    const c = el.cloneNode(true);
    c.querySelectorAll("script, next-route-announcer, noscript, link").forEach((x) => x.remove());
    for (const img of c.querySelectorAll("img")) {
      try {
        const r = await fetch(img.currentSrc || img.src);
        const blob = await r.blob();
        img.src = await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(blob); });
        img.removeAttribute("srcset");
      } catch { /* biarkan */ }
    }
    return c.outerHTML;
  }, pilih);
  writeFileSync(join(KELUAR, `${nama}.html`), html);
  await p.locator(pilih).first().screenshot({ path: join(KELUAR, `${nama}.png`) });
  console.log("ok", nama, html.length);
}

async function masuk(next) {
  await p.goto(`${BASE}/masuk?next=${encodeURIComponent(next)}`);
  await p.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await p.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await p.getByRole("button", { name: "Masuk" }).click();
  await p.waitForURL((u) => u.pathname === next);
}

// Feed dengan lima usulan hasil Lempar.
await masuk("/app");
if (TAHAP.has("feed")) {
await p.locator("article").nth(4).waitFor();
await p.waitForTimeout(800);
await simpan("feed", "body");
}
if (TAHAP.has("lempar")) {
// Lempar kosong, lalu keadaan membaca dan siap dari unggahan sungguhan (salinan unik lima berkas korpus).
await p.goto(`${BASE}/app/lempar`);
await p.getByTestId("area-lempar").waitFor();
await simpan("lempar-kosong", "body");
const BERKAS = [["nota/nota-01.png", "image/png"], ["invoice/invoice-01.pdf", "application/pdf"], ["absen/absen-01.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["mutasi/mutasi-01.csv", "text/csv"], ["slip_gaji/slip-01.pdf", "application/pdf"]];
const awal = (await sb.from("usulan").select("id").eq("perusahaan_id", info.usaha)).data.map((x) => x.id);
await p.getByTestId("input-berkas").setInputFiles(BERKAS.map(([j, mimeType]) => ({ name: j.split("/")[1], mimeType,
  buffer: j.endsWith(".png") ? Buffer.concat([readFileSync(join(KORPUS, j)), Buffer.from(`\n${Date.now()}`)]) : Buffer.concat([readFileSync(join(KORPUS, j)), Buffer.from(j.endsWith(".csv") ? `\n` : `\n%${Date.now()}`)]) })));
await p.getByTestId("daftar-lempar").locator("li").nth(4).waitFor();
await p.waitForTimeout(600);
await simpan("lempar-membaca", "main");
await p.getByTestId("daftar-lempar").locator('li[data-status="usulan"], li[data-status="ada"], li[data-status="galat"]').nth(4).waitFor({ timeout: 180_000 });
await p.waitForTimeout(600);
await simpan("lempar-siap", "main");
// Usulan salinan ditolak agar Feed contoh tetap lima kartu (tidak ada yang dihapus).
for (const u of (await sb.from("usulan").select("id").eq("perusahaan_id", info.usaha).eq("status", "menunggu")).data) if (!awal.includes(u.id)) await sb.rpc("putuskan_usulan", { p_usulan: u.id, p_setuju: false });
}

// Feed: setujui kartu nota di layar, simpan keadaan dicap.
if (TAHAP.has("kartu")) {
await p.goto(`${BASE}/app`);
const nota = p.locator("article", { hasText: "Catat belanja" }).first();
await nota.waitFor();
await nota.evaluate((el) => el.setAttribute("data-ambil", "nota"));
await simpan("kartu-nota", '[data-ambil="nota"]');
await nota.getByRole("button", { name: "Setujui" }).click();
await nota.getByTestId("hasil-putusan").waitFor();
await p.waitForTimeout(5000);
await nota.evaluate((el) => el.setAttribute("data-ambil", "nota"));
await simpan("kartu-nota-dicap", '[data-ambil="nota"]');
}

// Invoice: daftar pemilik dan halaman tagihan pelanggan ber-QRIS.
if (TAHAP.has("invoice")) {
await p.goto(`${BASE}/app/invoice`);
await p.getByTestId("baris-daftar-invoice").first().waitFor();
await simpan("invoice-app", "main");
await p.goto(`${BASE}/i/${info.invoice.kode_verifikasi}`);
await p.waitForTimeout(1500);
await simpan("invoice-publik", "main");
}
if (TAHAP.has("mata")) {
// Mata: panel hitung kunjungan dan peta panas.
await p.goto(`${BASE}/app/mata`);
await p.getByTestId("hitung-kunjungan").waitFor();
await simpan("mata-panel", '[data-testid="hitung-kunjungan"]');
await p.goto(`${BASE}/app/peta-usaha`);
await p.getByTestId("peta-panas").waitFor();
await simpan("peta-usaha", "main");
await simpan("peta-panas", '[data-testid="peta-panas"]');
}
if (TAHAP.has("sarapan")) {
// Sarapan Data dari demo publik.
await p.goto(`${BASE}/demo`);
await p.getByTestId("sarapan-data").waitFor();
await simpan("sarapan", '[data-testid="sarapan-data"]');
}
await b.close();
