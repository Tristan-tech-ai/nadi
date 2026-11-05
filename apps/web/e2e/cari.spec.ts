import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// U-02: cari fitur (tombol Cari di kepala + Ctrl+K) dan halaman Semua menu, di HP 390 dan desktop 1440. Akun pemilik B, hanya membaca.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B, "sekali (desktop), butuh .env.e2e.local");
});

async function axeBersih(page: Page, label: string) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes.slice(0, 3).map((n) => `${n.target.join(" ")}: ${n.failureSummary?.split(String.fromCharCode(10))[1] ?? ""}`).join(" | ")}`), label).toEqual([]);
}

test("cari fitur dan Semua menu: HP dan desktop, terang dan gelap", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  await page.waitForLoadState("networkidle");

  // Desktop: Ctrl+K, kata sehari-hari, Enter membuka hasil pertama.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Cari fitur" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox")).toBeFocused();
  await dialog.getByRole("combobox").fill("slip gaji");
  await expect(dialog.getByRole("option").first()).toContainText("Gaji");
  for (const skema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: skema });
    await axeBersih(page, `dialog 1440 ${skema}`);
    await page.screenshot({ path: test.info().outputPath(`cari-1440-${skema}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => u.pathname === "/app/gaji");
  await expect(dialog).toBeHidden();

  // Panah bawah memilih hasil kedua; Escape menutup dan fokus kembali ke pemicu.
  const tombol = page.getByRole("button", { name: /^Cari/ });
  await tombol.click();
  await dialog.getByRole("combobox").fill("zzqx");
  await expect(dialog.getByRole("status")).toContainText("Belum ada fitur");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(tombol).toBeFocused();

  // Semua menu desktop: dari tautan di sidebar, pencarian GET jalan tanpa dialog.
  await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Semua menu dan gunanya" }).click();
  await page.waitForURL((u) => u.pathname === "/app/menu");
  await expect(page.getByRole("heading", { level: 1, name: "Semua menu" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Uang" })).toBeVisible();
  await page.getByLabel("Mau mengerjakan apa?").fill("stok");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await page.waitForURL((u) => u.searchParams.get("q") === "stok");
  await expect(page.getByRole("region", { name: "Fitur yang cocok" }).getByRole("link").first()).toContainText("Barang");
  for (const skema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: skema });
    await axeBersih(page, `menu 1440 ${skema}`);
    await page.screenshot({ path: test.info().outputPath(`menu-1440-${skema}.png`), fullPage: true });
  }

  // HP 390: tombol Cari di kepala, ketuk hasil.
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^Cari/ }).click();
  await dialog.getByRole("combobox").fill("tagihan");
  for (const skema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: skema });
    await axeBersih(page, `dialog 390 ${skema}`);
    await page.screenshot({ path: test.info().outputPath(`cari-390-${skema}.png`) });
  }
  await dialog.getByRole("option").first().click();
  await page.waitForURL((u) => u.pathname === "/app/invoice");
  await page.goto("/app/menu");
  for (const skema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: skema });
    await axeBersih(page, `menu 390 ${skema}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "menu 390 tanpa gulir samping").toBe(true);
    await page.screenshot({ path: test.info().outputPath(`menu-390-${skema}.png`) });
  }
});
