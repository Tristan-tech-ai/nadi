import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { nilaiBuku } from "../src/lib/aset/susut";

// M-06: pemilik (akun A) mencatat laptop Kelompok 1 saldo menurun bulan lalu, pratinjau penyusutan bulan pertama, menyusutkan sampai
// bulan lalu (nilai buku sama dengan jadwal Pasal 11), meminjamkan lalu menerima kembali, lalu menjual dengan rugi.
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

test("aset tetap: catat, susutkan, pinjamkan, jual", async ({ page }) => {
  test.setTimeout(120_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const nama = `Laptop uji ${tanda}`;
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
  const lalu = new Date(Date.UTC(Number(hari.slice(0, 4)), Number(hari.slice(5, 7)) - 2, 10)).toISOString().slice(0, 10);
  await page.goto("/masuk?next=/app/aset");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/aset");

  const f = page.getByRole("form", { name: "Catat aset" });
  await f.getByLabel("Nama aset").fill(nama);
  await f.getByLabel("Kelompok").selectOption("k1");
  await f.getByLabel("Metode").selectOption("saldo_menurun");
  await f.getByLabel("Tanggal beli").fill(lalu);
  await f.getByLabel("Harga perolehan").fill("12000000");
  await expect(page.getByTestId("pratinjau-susut")).toContainText("Rp500.000");
  await f.getByRole("button", { name: "Catat aset" }).click();
  const item = page.getByTestId("daftar-aset").locator(`li[data-nama="${nama}"]`);
  await expect(item).toBeVisible();

  await page.getByRole("button", { name: "Susutkan sampai bulan lalu" }).click();
  const harap = nilaiBuku(12_000_000, "k1", "saldo_menurun", lalu.slice(0, 7), lalu.slice(0, 7));
  await expect(item.getByTestId("nilai-buku")).toContainText(`Rp${harap.toLocaleString("id-ID")}`);

  const pinjam = item.getByRole("form", { name: `Pinjamkan: ${nama}` });
  await pinjam.getByLabel("Pinjamkan ke").selectOption({ index: 1 });
  await pinjam.getByRole("button", { name: "Pinjamkan" }).click();
  await expect(item).toContainText("Dipinjam");
  await item.getByRole("button", { name: `Sudah dikembalikan: ${nama}` }).click();
  await expect(item).not.toContainText("Dipinjam");

  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id), `${w} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`aset-${w}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });

  await item.getByText("Jual atau lepas").click();
  const jual = item.getByRole("form", { name: `Jual atau lepas: ${nama}` });
  await jual.getByLabel("Harga jual (Rp, 0 bila dibuang)").fill("11000000");
  await jual.getByRole("button", { name: "Simpan" }).click();
  await expect(item).toContainText("Dijual");
});
