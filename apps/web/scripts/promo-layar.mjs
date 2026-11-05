// Video demo v3: tangkap DOM asli beberapa layar (baca saja kecuali gaji-isi dan gaji-draf) di usaha contoh "Toko Bu Sari" (akun uji B, produksi, data sintetis)
// untuk babak gaji, otomasi, tanya data, dan satu kerangka. Selain gaji pokok dua karyawan sintetis dan draf gaji (tidak disetujui), tidak ada yang ditulis. Keluaran:
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
  // Menulis: gaji pokok dua karyawan sintetis lewat formulir asli halaman Orang (jalur sama dengan e2e/gaji.spec.ts), bila belum diisi.
  "gaji-isi": { jalur: "/app/orang", lebar: 1440, isi: async (p) => {
    for (const [nama, pokok, ptkp] of [["Rina Lestari", "4200000", "TK/0"], ["Dodi Pratama", "3750000", "K/1"]]) {
      const baris = p.getByRole("listitem").filter({ hasText: nama });
      if (!(await baris.getByText("Gaji belum diisi").count())) continue;
      await baris.getByText("Gaji belum diisi").click();
      const form = baris.getByRole("form", { name: `Gaji ${nama}` });
      await form.getByLabel("Gaji pokok (Rp)").fill(pokok);
      await form.getByLabel("Status PTKP").selectOption(ptkp);
      await form.getByRole("button", { name: `Simpan gaji ${nama}` }).click();
      await form.getByText("Tersimpan.").waitFor({ timeout: 30000 });
    }
  } },
  // Menulis: draf gaji bulan ini (tombol asli "Siapkan gaji bulan ini"); draf TIDAK disetujui, slip tidak terkunci.
  "gaji-draf": { jalur: "/app/gaji", lebar: 1440, isi: async (p) => {
    const tombol = p.getByRole("button", { name: /Siapkan gaji bulan ini|Hitung ulang draf/ });
    await tombol.first().click();
    await p.getByText(/Draf gaji siap|Belum ada karyawan dengan gaji pokok/).first().waitFor({ timeout: 60000 });
    await p.waitForLoadState("networkidle");
  } },
  // Baca saja: Feed dengan rincian kartu tagihan pemasok INV/2026/X/0007 dibuka (Kalau disetujui + Lihat rincian, U-10/U-13).
  "feed-rincian": { jalur: "/app", lebar: 1440, isi: async (p) => {
    const kartu = p.locator("article").filter({ hasText: "INV/2026/X/0007" }).first();
    await kartu.getByTestId("rincian-usulan").locator("summary").click();
    await kartu.getByTestId("rincian-usulan").getByText(/Memuat/).waitFor({ state: "detached", timeout: 30000 }).catch(() => {});
    await p.waitForLoadState("networkidle");
  } },
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
