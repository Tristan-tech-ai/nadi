// Video demo v3: tangkap DOM asli beberapa layar BACA-SAJA di usaha contoh "Toko Bu Sari" (akun uji B, produksi, data sintetis)
// untuk babak gaji, otomasi, tanya data, dan satu kerangka. Tidak ada yang ditulis ke data usaha. Keluaran:
// docs/promo/film-langsung/assets/app/<nama>.{html,png}. Jalankan dari apps/web: node scripts/promo-layar.mjs [nama ...]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baca = (n) => { try { return Object.fromEntries(readFileSync(join(import.meta.dirname, "..", n), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])); } catch { return {}; } };
const E = { ...baca(".env.local"), ...baca(".env.e2e.local") };
const BASE = "https://nadi-swart.vercel.app";
const KELUAR = join(import.meta.dirname, "..", "..", "..", "docs", "promo", "film-langsung", "assets", "app");
const LAYAR = {
  gaji: { jalur: "/app/gaji", lebar: 1440 },
  alur: { jalur: "/app/alur", lebar: 1440 },
  tanya: { jalur: "/app/tanya", lebar: 1440, isi: async (p) => {
    const f = p.getByRole("form", { name: "Tanya data" });
    await f.getByLabel("Pertanyaanmu").fill("Laba bulan ini berapa?");
    await f.getByRole("button", { name: "Tanya", exact: true }).click();
    await p.getByTestId("tanya-jawaban").waitFor({ timeout: 60000 });
  } },
  "hari-1440": { jalur: "/app", lebar: 1440 },
  "hari-768": { jalur: "/app", lebar: 768 },
  "hari-390": { jalur: "/app", lebar: 390 },
};
const pilih = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LAYAR);
const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
if ((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error) throw new Error("masuk gagal");
const { data: us } = await sb.from("perusahaan").select("id").eq("nama", "Toko Bu Sari").limit(1);
await sb.rpc("pindah_perusahaan", { p_perusahaan: us[0].id });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "id-ID", timezoneId: "Asia/Makassar", colorScheme: "light" });
const p = await ctx.newPage();
await p.goto(`${BASE}/masuk?next=${encodeURIComponent("/app")}`);
await p.getByLabel("Email").fill(E.E2E_EMAIL_B);
await p.getByLabel("Kata sandi").fill(E.E2E_SANDI);
await p.getByRole("button", { name: "Masuk" }).click();
await p.waitForURL((u) => u.pathname === "/app");
for (const nama of pilih) {
  const l = LAYAR[nama];
  await p.setViewportSize({ width: l.lebar, height: 900 });
  await p.goto(`${BASE}${l.jalur}`);
  await p.waitForLoadState("networkidle");
  if (l.isi) await l.isi(p);
  await p.waitForTimeout(800);
  const html = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll("script, next-route-announcer, noscript, link").forEach((x) => x.remove()); return c.outerHTML; });
  writeFileSync(join(KELUAR, `${nama}.html`), html);
  await p.locator("body").screenshot({ path: join(KELUAR, `${nama}.png`) });
  console.log("ok", nama, html.length, await p.getByTestId("nama-perusahaan").first().textContent().catch(() => "?"));
}
await b.close();
