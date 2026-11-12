import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// R-UUPK2: kalkulator pesangon publik memakai aturan pesangon.uu27 (UU 27/2026 Pasal 232-250, berlaku 28 Okt 2026) dan menghitung
// per alasan berhenti. Masa kerja 1 Mar 2020 sampai 13 Nov 2026 = 6 tahun 8 bulan: uang pesangon 7 bulan, UPMK 3 bulan, upah Rp4.000.000.
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali (desktop), lebar 390 dan 1440 dicek di dalam tes");
});

test("kalkulator pesangon per alasan berhenti UU 27/2026, tanpa catatan aturan lama", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/alat/pesangon");
  const k = page.getByTestId("kalkulator-pesangon");
  await expect(k).toBeVisible();
  await k.getByLabel("Tanggal berhenti").fill("2026-11-13");
  const alasan = k.getByLabel("Alasan berhenti");
  const hasil = k.getByTestId("hasil-pesangon");
  // Bawaan: usaha tutup karena rugi 2 tahun (Pasal 237), 1 kali pesangon + 1 kali UPMK.
  await expect(hasil).toHaveText("Rp40.000.000");
  await expect(k.getByTestId("rincian-alasan")).toContainText("Pasal 237 UU 27/2026");
  for (const [label, rp, pasal] of [
    ["Pensiun", "Rp68.000.000", "Pasal 247"],
    ["Pemilik menutup usaha untuk seterusnya", "Rp46.000.000", "Pasal 238"],
    ["Sakit berkepanjangan atau cacat karena kecelakaan kerja lebih dari 12 bulan", "Rp80.000.000", "Pasal 246"],
    ["Mengundurkan diri", "Rp4.000.000", "Pasal 242"],
  ] as const) {
    await alasan.selectOption({ label });
    await expect(hasil, label).toHaveText(rp);
    await expect(k.getByTestId("rincian-alasan"), label).toContainText(pasal);
  }
  await expect(k.getByTestId("rincian-alasan")).toContainText("uang pisah paling sedikit Rp4.000.000");
  await expect(k.getByTestId("rincian-alasan")).toContainText("tanpa uang pesangon");
  await expect(alasan.locator("option", { hasText: /efisiensi/i })).toHaveCount(0);
  await expect(page.getByText("Pasal 250")).toBeVisible();
  await expect(page.getByTestId("catatan-uu-baru")).toHaveCount(0);
  await expect(page.getByText("masih memakai aturan sebelumnya")).toHaveCount(0);
  await expect(page.getByTestId("sumber-aturan")).toContainText("pesangon.uu27");

  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).include('[data-testid="kalkulator-pesangon"]').analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`pesangon-uu27-${lebar}-${skema}.png`), fullPage: true });
    }
  }

  await page.goto("/en/alat/pesangon");
  const e = page.getByTestId("kalkulator-pesangon");
  await e.getByLabel("Last working date").fill("2026-11-13");
  await e.getByLabel("Reason the job ends").selectOption({ label: "Retirement" });
  await expect(e.getByTestId("hasil-pesangon")).toHaveText("Rp68.000.000");
  await expect(e.getByTestId("rincian-alasan")).toContainText("Article 247 of UU 27/2026");
});
