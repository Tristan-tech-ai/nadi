import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// B-EKSIM2: perkiraan biaya mendarat impor dengan tarif dari aturan bertanggal terverifikasi (PMK 51/2025, PMK 131/2024).
// Angka harapan sama dengan src/lib/impor/biaya.test.ts.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

async function periksa(page: Page, nama: string, el?: Locator) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      if (el) await el.evaluate((x) => x.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${w} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${nama} ${w} tanpa gulir datar`).toBeLessThanOrEqual(w);
      await (el ?? page).screenshot({ path: test.info().outputPath(`${nama}-${w}-${skema}.png`), fullPage: !el });
    }
  }
}

test("perkiraan biaya impor: CIF, bea masuk, PPN 11/12, PPh 22 API/non-API, bertanda perkiraan", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(120_000);
  await page.goto("/masuk?next=/app/impor");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((x) => x.pathname === "/app/impor");
  await expect(page.getByRole("heading", { level: 1, name: "Perkiraan biaya impor" })).toBeVisible();
  const hasil = page.getByTestId("hasil-impor");
  await expect(hasil).toContainText("Isi harga barang dan kurs");
  await expect(page.getByTestId("bukan-billing")).toContainText("bukan kode billing");
  await expect(page.getByTestId("sumber-impor")).toContainText("PMK 51 Tahun 2025");
  await expect(page.getByTestId("sumber-impor")).toContainText("PMK 131 Tahun 2024");

  const f = page.getByTestId("form-impor");
  await f.getByLabel("Harga barang (USD, FOB)").fill("10000");
  await f.getByLabel("Ongkos kirim (USD)").fill("800");
  await f.getByLabel("Asuransi (USD)").fill("50");
  await f.getByLabel("Kurs pajak (Rp per USD)").fill("16.287,50");
  await f.getByLabel("Tarif bea masuk (%)").fill("5");
  await f.getByLabel(/Biaya lain sampai gudang/).fill("3.000.000");
  await expect(hasil.getByTestId("impor-cif")).toContainText("Rp176.719.375");
  await expect(hasil.getByTestId("impor-cif")).toContainText("USD 10,850.00");
  await expect(hasil.getByTestId("impor-nilai")).toContainText("Rp185.555.344");
  await expect(hasil.getByTestId("impor-ppn")).toContainText("Rp20.411.088");
  await expect(hasil.getByTestId("impor-pph")).toContainText("2,5%");
  await expect(hasil.getByTestId("impor-pph")).toContainText("Rp4.638.884");
  await expect(hasil.getByTestId("impor-keluar")).toContainText("Rp213.605.316");
  await expect(hasil.getByTestId("impor-mendarat")).toContainText("Rp188.555.344");
  await periksa(page, "impor");

  await f.getByLabel(/Punya API/).uncheck();
  await expect(hasil.getByTestId("impor-pph")).toContainText("7,5%");
  await expect(hasil.getByTestId("impor-pph")).toContainText("Rp13.916.651");
  await f.getByLabel(/Barang mewah/).check();
  await expect(hasil.getByTestId("impor-ppn")).toContainText("Rp22.266.641");
  await f.getByLabel("Kelompok barang untuk PPh 22").selectOption("emas_batangan");
  await expect(hasil.getByTestId("impor-pph")).toContainText("0,25%");
  await periksa(page, "impor-hasil", hasil);
});
