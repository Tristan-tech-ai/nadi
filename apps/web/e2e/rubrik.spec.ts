import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// F2-02: lowongan 'maks 25 th, berpenampilan menarik' diberi peringatan (usia, penampilan), disimpan tertutup, dan pemilik bisa tetap membukanya.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = bacaEnv(".env.e2e.local");

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

test("lowongan diskriminatif diberi peringatan dan disimpan tertutup", async ({ page }) => {
  await page.goto("/masuk?next=/app/orang");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/orang/);
  const judul = `Pelayan bias ${Date.now()}`;
  const kartu = page.getByTestId("kartu-lowongan");
  await kartu.getByLabel("Judul lowongan").fill(judul);
  await kartu.getByLabel(/Ringkasan tugas/).fill("Syarat: maks 25 th, berpenampilan menarik. Pengalaman minimal 1 tahun.");
  await kartu.getByRole("button", { name: "Buat lowongan" }).click();

  const baris = kartu.getByTestId("daftar-lowongan").getByRole("listitem").filter({ hasText: judul });
  const catatan = baris.getByTestId("peringatan-lowongan");
  await expect(catatan).toBeVisible();
  await expect(catatan.locator("li")).toHaveCount(2);
  await expect(catatan.locator('li[data-kode="usia"]')).toContainText("maks 25 th");
  await expect(catatan.locator('li[data-kode="penampilan"]')).toContainText("berpenampilan menarik");
  await expect(baris.getByText("Tutup", { exact: true })).toBeVisible();

  await catatan.scrollIntoViewIfNeeded();
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).include('[data-testid="kartu-lowongan"]').analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await catatan.screenshot({ path: test.info().outputPath(`peringatan-${lebar}-${skema}.png`) });
    }
  }

  // Pemilik tetap boleh membuka (mis. batas usia karena sifat pekerjaan, SE butir 3a); peringatan tetap terlihat.
  await baris.getByRole("button", { name: `Tetap buka lowongan ${judul}` }).click();
  await expect(baris.getByText("Buka", { exact: true })).toBeVisible();
  await expect(baris.getByTestId("peringatan-lowongan")).toBeVisible();
});
