import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DENAH } from "../src/lib/mata/toko-sintetis";

// W-02 Mata v2: pemilik (akun A, Warung Uji A) memasang denah toko sintetis (pintu, lorong, antrean, kasir, pos kerja), mencentang
// papan informasi, menghitung kunjungan dari video korpus fixtures/korpus/mata-v2/pendek.webm (5 pelanggan berjalur diketahui)
// di peramban, lalu Peta Usaha menampilkan peta panas dengan kunjungan bertambah sebanyak yang dihitung.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "mata-v2");

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("Mata v2: hitung kunjungan dari video, peta panas di Peta Usaha", async ({ page }) => {
  test.setTimeout(600_000);
  const benar = (JSON.parse(readFileSync(join(KORPUS, "pendek.json"), "utf8")) as { jawaban: unknown[] }).jawaban.length;
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  expect((await sb.rpc("save_vision_zones", { p_zones: DENAH.zona.map((z) => ({ nama: z.nama, jenis: z.jenis, poligon: z.poligon })) })).error).toBeNull();
  expect((await sb.rpc("set_vision_notice", { p_on: false })).error).toBeNull();

  await page.goto("/masuk?next=/app/peta-usaha");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/peta-usaha");
  const panas = page.getByTestId("peta-panas");
  await expect(panas).toBeVisible();
  const sebelum = Number(await panas.getAttribute("data-kunjungan"));

  await page.goto("/app/mata");
  const panel = page.getByTestId("hitung-kunjungan");
  await expect(panel.getByTestId("kunjungan-berkas")).toHaveCount(0);
  await panel.getByTestId("kunjungan-papan").check();
  await panel.getByTestId("kunjungan-berkas").setInputFiles(join(KORPUS, "pendek.webm"));
  await expect(panel.getByTestId("kunjungan-terkirim")).toBeVisible({ timeout: 480_000 });
  const n = Number(await panel.getByTestId("kunjungan-hasil").getAttribute("data-kunjungan"));
  console.log(`kunjungan peramban ${n}/${benar}`);
  expect(Math.abs(n - benar) / benar).toBeLessThanOrEqual(0.1);

  await page.goto("/app/peta-usaha");
  await expect(panas).toHaveAttribute("data-kunjungan", String(sebelum + n));
  await expect(panas.getByTestId("panas-zona")).toHaveCount(DENAH.zona.length);
  expect(Number(await panas.locator('[data-testid="panas-zona"][data-nama="Lorong A"], [data-testid="panas-zona"][data-nama="Lorong B"]').evaluateAll((g) => g.reduce((s, x) => s + Number(x.getAttribute("data-detik")), 0)))).toBeGreaterThan(0);
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(200);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id), `${w} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`peta-panas-${w}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/cetak/papan-mata");
  await expect(page.getByTestId("papan-mata")).toContainText("Area ini memakai kamera");
});
