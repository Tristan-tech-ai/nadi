import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// F6-04: pemilik membuka direktori mitra (data contoh, izin belum diperiksa), mengirim permintaan ke psikolog contoh, melihatnya
// di "Permintaanmu", lalu membatalkannya. Tidak ada pembayaran dan tidak ada pesan keluar.
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

test("direktori mitra: permintaan tersimpan tanpa pembayaran, bisa dibatalkan", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(120_000);
  await page.goto("/masuk?next=/app/mitra");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((x) => x.pathname === "/app/mitra");
  await expect(page.getByTestId("mitra-contoh")).toContainText("masih data contoh");
  await expect(page.getByTestId("mitra-psikolog")).toContainText("UU 23/2022 Pasal 15 dan 17");
  await expect(page.getByTestId("mitra-akuntan_publik")).toContainText("UU 5/2011 Pasal 5");
  await expect(page.getByTestId("mitra-konsultan_pajak")).toContainText("PMK 175/2022");
  await periksa(page, "mitra");

  const pesan = `Asesmen dua calon kasir minggu depan (uji ${Date.now()})`;
  const kartu = page.getByTestId("kartu-mitra").filter({ hasText: "Contoh: Biro Psikologi Seruni" });
  await expect(kartu).toContainText("Izin belum diperiksa Nadi");
  await kartu.getByText("Kirim permintaan", { exact: true }).first().click();
  await kartu.getByLabel("Layanan").selectOption("Asesmen calon karyawan");
  await kartu.getByLabel("Kebutuhanmu").fill(pesan);
  await periksa(page, "mitra-form", kartu);
  await kartu.getByTestId("kirim-permintaan").click();
  await expect(kartu.getByTestId("permintaan-tersimpan")).toContainText("tidak sampai ke siapa pun");

  const baris = page.getByTestId("baris-permintaan").filter({ hasText: pesan });
  await expect(baris).toContainText("Tersimpan");
  await periksa(page, "mitra-permintaan", baris);
  await baris.getByRole("button", { name: /Batalkan permintaan ke Contoh: Biro Psikologi Seruni/ }).click();
  await expect(page.getByTestId("baris-permintaan").filter({ hasText: pesan })).toContainText("Dibatalkan");
});
