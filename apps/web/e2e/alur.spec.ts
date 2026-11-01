import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// F6-03: alur nyata vs alur kertas di usaha contoh, disusun dari log kejadian demo (20 invoice, 15 lamaran sintetis).
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali (desktop); ukuran layar diatur di tes");
});

for (const [jalur, nama] of [["/demo", "demo-fnb"], ["/demo/toko", "demo-toko"]] as const) {
  test(`alur nyata tergambar di ${jalur}: ringkasan, penyimpangan, jalur, langkah`, async ({ page }) => {
    await page.goto(jalur);
    const bagian = page.getByTestId("alur-nyata");
    await expect(bagian).toBeVisible();
    const inv = bagian.getByTestId("alur-invoice");
    await expect(inv.getByTestId("alur-ringkas")).toContainText("20 invoice dalam 90 hari terakhir");
    await expect(inv.getByTestId("alur-penyimpangan")).toContainText("invoice lunas lewat jatuh tempo");
    await expect(inv.getByTestId("alur-varian").locator("li").first()).toContainText("Invoice terbit → Lunas");
    expect(await inv.getByTestId("alur-sisi").locator("tbody tr").count()).toBeGreaterThanOrEqual(4);
    const rek = bagian.getByTestId("alur-rekrut");
    await expect(rek.getByTestId("alur-ringkas")).toContainText("15 lamaran dalam 90 hari terakhir");
    await expect(rek.getByTestId("alur-penyimpangan")).toContainText("pelamar diterima tanpa ditinjau");
    await expect(rek.getByTestId("alur-penyimpangan")).toContainText("menunggu lebih dari 14 hari");
    const teks = await bagian.innerText();
    expect(teks).not.toMatch(new RegExp("[\\u2013\\u2014]"));
    expect(teks).not.toContain("pengingat_");

    for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: lebar, height: tinggi });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(400);
        const axe = await new AxeBuilder({ page }).include("[data-testid=alur-nyata]").analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
        const lebarIsi = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(lebarIsi, `tanpa gulir samping di ${lebar}`).toBeLessThanOrEqual(lebar);
        await bagian.screenshot({ path: foto(`alur-${nama}-${lebar}-${skema}.png`) });
      }
    }
  });
}
