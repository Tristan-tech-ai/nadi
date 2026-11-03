// Tangkap layar asli Nadi dari produksi untuk film promo (F6-06), skala 2x agar tajam saat diperbesar di video.
// Jalankan dari apps/web: node scripts/promo-layar.mjs [url produksi]. Keluaran: docs/promo/film/assets/layar/*.png.
// Akun uji A dibaca dari .env.e2e.local (tidak dicetak). Data yang tampil sintetis.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baca = (n) => { try { return Object.fromEntries(readFileSync(join(import.meta.dirname, "..", n), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])); } catch { return {}; } };
const E = { ...baca(".env.local"), ...baca(".env.e2e.local") };
const BASE = process.argv[2] ?? "https://nadi-tristan-tech-ais-projects.vercel.app";
const KELUAR = join(import.meta.dirname, "..", "..", "..", "docs", "promo", "film", "assets", "layar");
const KORPUS = join(import.meta.dirname, "..", "..", "..", "fixtures", "korpus", "mata");
mkdirSync(KELUAR, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "id-ID", timezoneId: "Asia/Makassar", colorScheme: "light" });
const p = await ctx.newPage();
const simpan = async (nama, loc) => { await loc.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await loc.screenshot({ path: join(KELUAR, `${nama}.png`) }); console.log("ok", nama); };

const LEWATI = process.env.LEWATI_DEMO === "1";
if (!LEWATI) {
await p.goto(`${BASE}/`);
await p.waitForTimeout(3000);
await p.screenshot({ path: join(KELUAR, "landing.png") });
console.log("ok landing");

await p.goto(`${BASE}/demo`);
await p.getByTestId("feed-demo").waitFor();
await simpan("feed-kartu", p.getByTestId("feed-demo").locator("article").first());
await simpan("sarapan", p.getByTestId("sarapan-data"));
await p.getByTestId("peta-usaha").getByTestId("peta-hidup").and(p.locator("[data-hidup=ya]")).waitFor({ timeout: 20000 });
await simpan("peta", p.getByTestId("peta-usaha"));
await simpan("alur", p.getByTestId("alur-invoice"));
}

// Halaman tagihan pelanggan: invoice terbit (belum lunas) milik akun uji A.
const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
let inv = (await sb.from("invoice").select("kode_verifikasi").eq("status", "terbit").order("dibuat_at", { ascending: false }).limit(1).maybeSingle()).data;
if (!inv) {
  const jt = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const r = await sb.rpc("buat_invoice", { p_pelanggan: "Bu Rina (arisan RT 03)", p_hp: null, p_baris: [{ uraian: "Nasi kotak arisan", jumlah: 30, harga: 25000 }],
    p_jatuh_tempo: jt, p_catatan: "Pesanan arisan", p_kunci: crypto.randomUUID() });
  inv = { kode_verifikasi: r.data?.kode };
}
if (inv) {
  await p.goto(`${BASE}/i/${inv.kode_verifikasi}`);
  await simpan("tagihan", p.getByTestId("tagihan"));
}

// Aplikasi pemilik: Lempar dan Mata (video korpus, berhenti di tengah agar meja terisi).
await p.goto(`${BASE}/masuk?next=/app/lempar`);
await p.getByLabel("Email").fill(E.E2E_EMAIL_A);
await p.getByLabel("Kata sandi").fill(E.E2E_SANDI);
await p.getByRole("button", { name: "Masuk" }).click();
await p.waitForURL((u) => u.pathname === "/app/lempar");
await p.waitForTimeout(1500);
await p.screenshot({ path: join(KELUAR, "lempar.png") });
console.log("ok lempar");
await p.goto(`${BASE}/app/mata`);
await p.getByTestId("zona-mata").first().waitFor();
await p.waitForTimeout(2000);
await p.getByTestId("pilih-video").setInputFiles(join(KORPUS, "video.webm"));
await p.getByTestId("mulai-pantau").click();
await p.getByTestId("mata-status").filter({ hasText: "Cuplikan 42 dari 60" }).waitFor({ timeout: 300000 });
await p.getByRole("button", { name: "Berhenti" }).click();
await p.waitForTimeout(1500);
await simpan("mata", p.locator("main"));
await b.close();
