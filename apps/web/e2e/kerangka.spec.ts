import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// U-01: kerangka adaptif per kelas lebar jendela (docs/design/REKONSTRUKSI-APP.md bagian 4). Akun pemilik B, usaha aktif apa adanya.
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

const LEBAR = [[360, 740], [412, 915], [600, 960], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]] as const;

test("kerangka: navigasi benar per kelas lebar, axe bersih, tanpa gulir samping, invoice bisa ditemukan", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  for (const [lebar, tinggi] of LEBAR) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const nav = page.getByRole("navigation", { name: "Navigasi utama" });
      await expect(nav, `${lebar}: satu navigasi utama terlihat`).toHaveCount(1);
      const kelas = await nav.getAttribute("class");
      const harap = lebar < 600 ? "kerangka-bawah" : lebar < 1200 ? "kerangka-rail" : "kerangka-sidebar";
      expect(kelas, `${lebar}`).toContain(harap);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`kerangka-${lebar}-${skema}.png`) });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  // Desktop: Invoice langsung di sidebar.
  await page.setViewportSize({ width: 1440, height: 900 });
  const sidebar = page.getByRole("navigation", { name: "Navigasi utama" });
  // U-09: Disematkan (bawaan pemilik memuat Invoice), kaki bantuan/peta/pengaturan, tanpa angka statis di ruang.
  await expect(sidebar.getByTestId("kaki-sidebar").getByRole("link", { name: "Bantuan dan panduan" })).toBeVisible();
  await expect(sidebar.getByTestId("kaki-sidebar").getByRole("link", { name: "Usahamu" })).toBeVisible();
  const ringkasRuang = await sidebar.locator("summary").allInnerTexts();
  expect(ringkasRuang.filter((t) => /\d/.test(t) && !/menunggu/.test(t)), "tanpa angka jumlah halaman").toEqual([]);
  await sidebar.getByTestId("disematkan").getByRole("link", { name: "Invoice", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/invoice");
  // Ruang lain terlipat: Kas dan bank lewat ruang Uang.
  await page.goto("/app/gaji");
  await expect(sidebar.getByRole("link", { name: "Kas dan bank", exact: true })).toBeHidden();
  await sidebar.locator("summary", { hasText: "Uang" }).click();
  await sidebar.getByRole("link", { name: "Kas dan bank", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/kas");
  // Sematkan Kas dan bank dari kepala halaman, lalu lepas lagi.
  await page.getByRole("button", { name: "Sematkan di samping" }).click();
  await expect(sidebar.getByTestId("disematkan").getByRole("link", { name: "Kas dan bank", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lepas sematan" }).click();
  await expect(sidebar.getByTestId("disematkan").getByRole("link", { name: "Kas dan bank", exact: true })).toHaveCount(0);
  // Tablet: rail Uang membuka panel berisi Invoice.
  await page.goto("/app");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("button", { name: "Uang" }).click();
  await page.locator("#panel-ruang").getByRole("link", { name: /^Laporan keuangan/ }).click();
  await page.waitForURL((u) => u.pathname === "/app/buku");
  // HP: Menu membuka semua menu.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("button", { name: "Menu" }).click();
  const lembar = page.getByRole("dialog", { name: "Semua menu" });
  await expect(lembar).toBeVisible();
  await lembar.getByRole("link", { name: /^Gaji/ }).first().click();
  await page.waitForURL((u) => u.pathname === "/app/gaji");
  await expect(lembar).toHaveCount(0);
});
