import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// D-03: 8 ilustrasi tampil di lembar komponen dan kepala Lempar, terang dan gelap, 390 dan 1440, tanpa pelanggaran axe serius.
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
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

async function periksa(page: Page, target: Locator, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await target.screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`) });
    }
  }
}

test("ilustrasi: lembar komponen dan kepala Lempar", async ({ page }) => {
  await page.goto("/dev/komponen");
  const lembar = page.getByTestId("ilustrasi");
  await expect(lembar.locator("svg[aria-hidden='true']")).toHaveCount(8);
  await periksa(page, lembar, "ilustrasi");
  await page.goto("/masuk?next=/app/lempar");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/lempar");
  const kepala = page.getByRole("heading", { name: "Lempar Saja" }).locator("..");
  await expect(kepala.locator(":scope > svg[aria-hidden='true']")).toBeVisible();
  await periksa(page, kepala, "lempar");
});
