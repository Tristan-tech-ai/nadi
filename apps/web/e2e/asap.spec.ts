import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("beranda tampil, berbahasa Indonesia, tanpa pelanggaran aksesibilitas serius", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const hasil = await new AxeBuilder({ page }).analyze();
  const serius = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serius.map((v) => v.id)).toEqual([]);
});

test("area aplikasi mengalihkan tamu ke halaman masuk", async ({ page }) => {
  const res = await page.goto("/app");
  expect(page.url()).toContain("/masuk?next=%2Fapp");
  expect(res).not.toBeNull();
});

for (const jalur of ["/masuk", "/daftar"]) {
  test(`halaman ${jalur} tanpa pelanggaran aksesibilitas serius`, async ({ page }, info) => {
    await page.goto(jalur);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const hasil = await new AxeBuilder({ page }).analyze();
    expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: info.outputPath(`${jalur.slice(1)}-${info.project.name}.png`) });
  });
}
