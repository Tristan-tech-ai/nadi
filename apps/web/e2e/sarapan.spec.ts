import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// F5-03: Sarapan Data di usaha contoh. Paling banyak 3 hal, masing-masing berdampak rupiah dan menyebut angka rupiah.
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali (desktop); ukuran layar diatur di tes");
});

for (const [jalur, nama] of [["/demo", "fnb"], ["/demo/toko", "toko"]] as const) {
  test(`Sarapan data di ${jalur}: 1 sampai 3 hal berdampak rupiah`, async ({ page }) => {
    await page.goto(jalur);
    const bagian = page.getByTestId("sarapan-data");
    await expect(bagian).toBeVisible();
    const butir = bagian.locator("li");
    const n = await butir.count();
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(3);
    for (let i = 0; i < n; i++) await expect(butir.nth(i)).toContainText(/Dampak Rp\d/);
    await expect(bagian.locator("li[data-kode=belanja_naik]")).toContainText("naik Rp");
    const teks = await bagian.innerText();
    expect(teks).not.toMatch(new RegExp("[\\u2013\\u2014]"));

    for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: lebar, height: tinggi });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(400);
        const axe = await new AxeBuilder({ page }).include("[data-testid=sarapan-data]").analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(lebar);
        await bagian.screenshot({ path: foto(`sarapan-${nama}-${lebar}-${skema}.png`) });
      }
    }
  });
}
