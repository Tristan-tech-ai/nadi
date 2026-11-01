import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// F4-07: pemilik Warung Uji A mengisi profil pajak, melihat batas Rp4,8 M gabungan berubah karena usaha lain miliknya, membaca
// posisi PPh final dari pembukuan, dan memakai simulator. Profil dikembalikan ke orang pribadi tanpa usaha lain di akhir.
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

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("kompas pajak: profil, batas gabungan, posisi, simulator", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`/masuk?next=${encodeURIComponent("/app/pajak")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/pajak");

  const f = page.getByRole("form", { name: "Profil pajak" });
  const simpan = async (usahaLainLalu: string) => {
    await f.getByLabel("Bentuk usaha ini").selectOption({ label: "Orang pribadi (usaha atas nama sendiri)" });
    await f.getByLabel("Bruto usaha lain milikmu tahun lalu").fill(usahaLainLalu);
    await f.getByRole("button", { name: "Simpan profil pajak" }).click();
    await expect(f.getByRole("status")).toHaveText("Tersimpan.");
  };
  await simpan("5.000.000.000");
  const batas = page.getByTestId("hasil-batas");
  await expect(batas).toHaveAttribute("data-status", "lewat_tahun_lalu");
  await expect(batas).toContainText("di atas Rp4.800.000.000");
  await expect(batas).toContainText("Pasal 57 ayat (2) huruf e");

  await simpan("0");
  // Nilai yang tersimpan tetap terlihat (formulir terkendali, tidak dikosongkan React setelah aksi).
  await expect(f.getByLabel("Bentuk usaha ini")).toHaveValue("op");
  await expect(f.getByLabel("Bruto usaha lain milikmu tahun lalu")).toHaveValue("0");
  await expect(page.getByTestId("hasil-batas")).toHaveAttribute("data-status", "boleh");
  await expect(page.getByTestId("kalimat-posisi")).toContainText(/Kalau tutup buku hari ini, PPh final \d{4} dari pembukuan Nadi: Rp[\d.]+\./);
  await expect(page.getByTestId("posisi-pajak")).toContainText("PP 20/2026");

  const sim = page.getByTestId("simulator-pajak");
  await sim.getByLabel("Perkiraan bruto setahun").fill("2.000.000.000");
  await sim.getByLabel("Perkiraan laba setahun").fill("300.000.000");
  await sim.getByLabel("Status PTKP").selectOption("K/1");
  await expect(sim.getByTestId("baris-simulasi").nth(0)).toContainText("Rp7.500.000");
  await expect(sim.getByTestId("baris-simulasi").nth(1)).toContainText("Rp10.000.000");
  await expect(sim.getByTestId("baris-simulasi").nth(2)).toContainText("Rp29.550.000");
  await expect(sim.getByTestId("peringatan-pajak")).toContainText("gabungan semua usaha pemilik");
  await periksaUi(page, "kompas-pajak");
});
