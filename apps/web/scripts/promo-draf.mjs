// Video demo v3 babak 3 (kerja dari AI-mu lewat MCP): tangkap DOM asli layar tinjau draf AI di usaha contoh "Toko Bu Sari" (akun
// uji B, produksi, data sintetis dari docs/promo/aset-demo/karyawan-berantakan.xlsx). Draf dibuat lewat RPC save_ai_draft (jalur
// yang sama dengan alat MCP tulis_draf) dan TIDAK diterapkan, jadi data usaha contoh tidak berubah. Keluaran:
// docs/promo/film-langsung/assets/app/tinjau-draf.{html,png}. Jalankan dari apps/web: node scripts/promo-draf.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baca = (n) => { try { return Object.fromEntries(readFileSync(join(import.meta.dirname, "..", n), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])); } catch { return {}; } };
const E = { ...baca(".env.local"), ...baca(".env.e2e.local") };
const BASE = "https://nadi-swart.vercel.app";
const KELUAR = join(import.meta.dirname, "..", "..", "..", "docs", "promo", "film-langsung", "assets", "app");

const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
if ((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error) throw new Error("masuk gagal");
const { data: us } = await sb.from("perusahaan").select("id").eq("nama", "Toko Bu Sari").limit(1);
await sb.rpc("pindah_perusahaan", { p_perusahaan: us[0].id });
await sb.auth.refreshSession();
// Baris seperti yang ditulis AI pengguna dari Excel berantakan: nama dirapikan, jabatan disamakan, gaji dari "Rp5250rb" dst.
const ORANG = [
  ["Siti Rahmawati", "Kasir", "2019-01-01", 3600000], ["Budi Santoso", "Kasir pagi", "2020-06-08", 5250000], ["Ketut Ariani", "Pramuniaga", "2021-11-15", 4200000],
  ["Agus Prasetyo", "Pramuniaga", "2022-04-01", 5850000], ["Dewi Lestari", "Staf gudang", "2023-09-02", 4800000], ["Made Wirawan", "Staf gudang", "2024-02-09", 3750000],
  ["Rina Kartika", "Kurir", "2019-07-16", 5400000], ["Joko Susilo", "Admin", "2020-12-23", 4350000], ["Nyoman Sudarsana", "Admin", "2021-05-01", 6000000],
];
const baris = [
  { bagian: "topi", nilai: { nama: "Kasir pagi" }, alasan: "Dari obrolan: Budi pindah ke kasir pagi", keyakinan: 95 },
  ...ORANG.map(([nama, jabatan, mulai]) => ({ bagian: "orang", nilai: { nama, jabatan, mulai }, alasan: "Dari karyawan-berantakan.xlsx", keyakinan: 92 })),
  { bagian: "orang", nilai: { nama: "Budi Santoso", jabatan: "kasir", mulai: "2020-06-08" }, alasan: "Baris ganda di Excel", keyakinan: 60 },
  ...ORANG.slice(0, 4).map(([nama, , , pokok]) => ({ bagian: "gaji", nilai: { nama, pokok }, alasan: "Kolom Gapok di Excel", keyakinan: 90 })),
];
const { data: id, error } = await sb.rpc("save_ai_draft", { p_baris: baris });
if (error) throw error;
console.log("draf", id);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "id-ID", timezoneId: "Asia/Makassar", colorScheme: "light" });
const p = await ctx.newPage();
await p.goto(`${BASE}/masuk?next=${encodeURIComponent(`/app/siapkan/draf/${id}`)}`);
await p.getByLabel("Email").fill(E.E2E_EMAIL_B);
await p.getByLabel("Kata sandi").fill(E.E2E_SANDI);
await p.getByRole("button", { name: "Masuk" }).click();
await p.waitForURL((u) => u.pathname.startsWith("/app/siapkan/draf/"));
await p.getByTestId("tinjau-draf").waitFor();
await p.waitForTimeout(800);
const html = await p.evaluate(() => {
  const c = document.body.cloneNode(true);
  c.querySelectorAll("script, next-route-announcer, noscript, link").forEach((x) => x.remove());
  return c.outerHTML;
});
writeFileSync(join(KELUAR, "tinjau-draf.html"), html);
await p.locator("body").screenshot({ path: join(KELUAR, "tinjau-draf.png") });
console.log("ok tinjau-draf", html.length, await p.getByTestId("ringkas-draf").textContent());
await b.close();
