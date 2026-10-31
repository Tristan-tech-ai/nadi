import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// F1-02B: pemilik membuat tautan tablet; tablet tanpa akun menampilkan QR absen; setelah dicabut, tablet ditolak dengan pesan jelas.
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

async function masuk(page: Page, tujuan: string) {
  await page.goto(`/masuk?next=${encodeURIComponent(tujuan)}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === tujuan);
}

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
}

test("tautan tablet: tablet tanpa akun menampilkan QR, lalu ditolak setelah dicabut", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await masuk(page, "/app/perusahaan");
  const kartu = page.getByTestId("tablet-absen");
  await expect(kartu).toBeVisible();
  const nama = `Tablet uji ${Date.now()}`;
  await kartu.getByLabel("Nama tablet").fill(nama);
  await kartu.getByRole("button", { name: "Buat tautan tablet" }).click();
  const isi = page.getByTestId("tautan-tablet-isi");
  await expect(isi).toHaveText(/\/kios\/tablet#nmk_[0-9a-f]{64}$/);
  const tautan = (await isi.textContent())!;
  await periksaUi(page, "usahamu-tablet");

  // Tablet: konteks baru tanpa cookie sesi.
  const tablet = await (await browser.newContext()).newPage();
  await tablet.goto(new URL(tautan).pathname + new URL(tautan).hash);
  await expect(tablet).toHaveURL(/\/kios\/tablet$/);
  await expect(tablet.getByTestId("kode-kios")).toHaveText(/^\d{6}$/, { timeout: 15_000 });
  await expect(tablet.getByTestId("qr-kios").locator("svg")).toBeVisible();
  expect(new URL(tablet.url()).hash, "token dihapus dari bilah alamat").toBe("");
  await periksaUi(tablet, "tablet");
  // Muat ulang tanpa fragmen: token tersimpan di perangkat.
  await tablet.reload();
  await expect(tablet.getByTestId("kode-kios")).toHaveText(/^\d{6}$/, { timeout: 15_000 });

  // Pemilik mencabut; tablet menampilkan pesan dan berhenti.
  await page.reload();
  await expect(page.getByText(nama)).toBeVisible();
  await page.getByRole("button", { name: `Cabut ${nama}` }).click();
  await expect(page.getByText(nama)).toHaveCount(0);
  await tablet.reload();
  await expect(tablet.getByText("sudah dicabut", { exact: false })).toBeVisible();
  await tablet.reload();
  await expect(tablet.getByTestId("tablet-tanpa-tautan")).toBeVisible();
  await tablet.context().close();
});

test("tablet tanpa tautan menjelaskan cara memasang", async ({ browser }) => {
  const p = await (await browser.newContext()).newPage();
  await p.goto("/kios/tablet");
  await expect(p).toHaveURL(/\/kios\/tablet$/);
  await expect(p.getByTestId("tablet-tanpa-tautan")).toContainText("halaman Usahamu");
  await p.context().close();
});
