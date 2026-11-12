import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Q-52: halaman yang hitungannya berdasar PP 35/2021, PP 36/2021, atau UU 13/2003 menampilkan catatan UU 27/2026 (berlaku 28 Okt 2026)
// dengan tautan ke teks resmi di JDIH BPK; halaman berdasar aturan lain (THR, Permenaker 6/2016) tidak.
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali (desktop), lebar 390 dan 1440 dicek di dalam tes");
});

async function periksa(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).include('[data-testid="catatan-uu-baru"]').analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
}

test("catatan UU 27/2026 di alat pesangon, gaji, dan kamus; tidak di THR", async ({ page }) => {
  test.setTimeout(120_000);
  for (const [jalur, nama, teks] of [
    ["/alat/pesangon", "alat-pesangon", "UU 27/2026 tentang Pelindungan Ketenagakerjaan berlaku sejak 28 Okt 2026"],
    ["/alat/gaji", "alat-gaji", "mencabut UU 13/2003"],
    ["/en/alat/pesangon", "alat-pesangon-en", "Law 27/2026 on Labour Protection has applied since 28 Oct 2026"],
    ["/kamus/pesangon", "kamus-pesangon", "Hitungan di sini masih memakai aturan sebelumnya"],
  ] as const) {
    await page.goto(jalur);
    const catatan = page.getByTestId("catatan-uu-baru");
    await expect(catatan, jalur).toHaveCount(1);
    await expect(catatan).toContainText(teks);
    await expect(catatan.getByRole("link")).toHaveAttribute("href", "https://peraturan.bpk.go.id/Details/359755/uu-no-27-tahun-2026-pelindungan-ketenagakerjaan");
    await periksa(page, nama);
  }
  await page.goto("/alat/thr");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("catatan-uu-baru")).toHaveCount(0);
});
