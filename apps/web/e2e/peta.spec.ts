import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F5-02: Peta Usaha langsung lewat Supabase Realtime Broadcast. Demo: simulasi database tiap menit mengubah denah publik; layar harus
// ikut berubah tanpa muat ulang. Aplikasi: pemilik (akun uji A) membuka denah privat; perubahan dari klien lain lewat catat_mata
// muncul tanpa muat ulang.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
});

async function statusDenah(page: Page) {
  return page.getByTestId("peta-zona").evaluateAll((g) => g.map((x) => `${x.getAttribute("data-nama")}=${x.getAttribute("data-status")}`).join("|"));
}

test("demo: denah berubah sendiri lewat Broadcast tanpa muat ulang", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/demo");
  const peta = page.getByTestId("peta-usaha");
  await expect(peta.getByTestId("peta-zona")).toHaveCount(7);
  await expect(peta.getByTestId("peta-hidup")).toHaveAttribute("data-hidup", "ya", { timeout: 20_000 });
  await expect(peta.getByTestId("peta-ringkas")).toContainText("dari 6 meja terisi");
  const awal = await statusDenah(page);
  let muat = 0;
  page.on("load", () => muat++);
  await expect.poll(() => statusDenah(page), { timeout: 75_000, intervals: [2_000] }).not.toBe(awal);
  expect(muat, "tidak ada muat ulang").toBe(0);

  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).include("[data-testid=peta-usaha]").analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(lebar);
      await peta.screenshot({ path: foto(`peta-demo-${lebar}-${skema}.png`) });
    }
  }
});

test("aplikasi: denah privat menerima perubahan dari Mata tanpa muat ulang", async ({ page }) => {
  test.skip(!E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "butuh .env.local dan .env.e2e.local");
  test.setTimeout(120_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  let keadaan = (await sb.rpc("mata_keadaan")).data as { id: string; nama: string; jenis: string; status: string | null }[];
  if (!keadaan.some((z) => z.jenis === "meja")) {
    await sb.rpc("simpan_zona_mata", { p_zona: [{ nama: "Meja peta", jenis: "meja", poligon: [[0.1, 0.1], [0.4, 0.1], [0.4, 0.4], [0.1, 0.4]] }] });
    keadaan = (await sb.rpc("mata_keadaan")).data as typeof keadaan;
  }
  const meja = keadaan.find((z) => z.jenis === "meja")!;

  await page.goto("/masuk?next=/app/peta-usaha");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/peta-usaha");
  const peta = page.getByTestId("peta-usaha");
  await expect(peta.getByTestId("peta-hidup")).toHaveAttribute("data-hidup", "ya", { timeout: 20_000 });
  const zona = peta.getByTestId("peta-zona").filter({ has: page.locator(`text=${meja.nama}`) }).first();
  const sekarang = (await zona.getAttribute("data-status")) || "kosong";
  const tujuan = sekarang === "terisi" ? "kosong" : "terisi";
  let muat = 0;
  page.on("load", () => muat++);
  const r = await sb.rpc("catat_mata", { p_butir: [{ zona: meja.id, status: tujuan }] });
  expect(r.error).toBeNull();
  await expect(zona).toHaveAttribute("data-status", tujuan, { timeout: 15_000 });
  expect(muat, "tidak ada muat ulang").toBe(0);
  const axe = await new AxeBuilder({ page }).include("[data-testid=peta-usaha]").analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await peta.screenshot({ path: foto("peta-app-1440-light.png") });
});
