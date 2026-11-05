import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// U-06: pemilik menyembunyikan modul Kasir dari menu lewat Usahamu > Fitur yang dipakai: hilang dari navigasi, tetap bisa dicari
// (ditandai "Tidak di menu") dan tampil di Semua menu bagian tidak dipakai, lalu ditampilkan lagi. Akun pemilik B, keadaan
// modul dikembalikan seperti semula di akhir. Perbedaan menu toko vs klinik diuji di src/lib/fitur-usaha.test.ts.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B, "sekali (desktop), butuh .env.e2e.local");
});

async function atur(page: Page, nyala: boolean) {
  await page.goto("/app/perusahaan#fitur");
  const baris = page.getByTestId("fitur-dipakai").locator("li[data-modul=kasir]");
  if ((await baris.getAttribute("data-nyala")) === (nyala ? "ya" : "tidak")) return;
  await baris.getByRole("button").click();
  await expect(baris).toHaveAttribute("data-nyala", nyala ? "ya" : "tidak");
}

test("fitur yang dipakai: sembunyikan Kasir, tetap bisa dicari, tampilkan lagi", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`/masuk?next=${encodeURIComponent("/app/perusahaan")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/perusahaan");
  await page.setViewportSize({ width: 1440, height: 900 });
  const awal = await page.getByTestId("fitur-dipakai").locator("li[data-modul=kasir]").getAttribute("data-nyala");
  const nav = page.getByRole("navigation", { name: "Navigasi utama" });
  try {
    await atur(page, false);
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).include("#fitur").analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), skema).toEqual([]);
      await page.getByTestId("fitur-dipakai").screenshot({ path: test.info().outputPath(`fitur-1440-${skema}.png`) });
    }
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/app");
    await expect(nav.locator('a[href="/app/kasir"]')).toHaveCount(0);
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Cari fitur" });
    await dialog.getByRole("combobox").fill("kasir");
    await expect(dialog.getByRole("option").first()).toContainText("Tidak di menu");
    await page.keyboard.press("Escape");
    await page.goto("/app/menu");
    await expect(page.getByTestId("menu-mati")).toContainText("Kasir");
    await page.getByTestId("menu-mati").getByRole("link", { name: "Tampilkan di menu" }).click();
    await page.waitForURL((u) => u.pathname === "/app/perusahaan");
    await atur(page, true);
    await page.goto("/app");
    await expect(nav.locator('a[href="/app/kasir"]')).toHaveCount(1);
  } finally {
    await atur(page, awal === "ya");
  }
});
