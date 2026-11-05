import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ruangUntuk } from "../src/lib/ruang";

// U-03: kepala halaman seragam di semua halaman pemilik (satu h1, jejak ruang, tombol bantuan), HP 390 dan desktop 1440.
// Akun pemilik B, hanya membuka halaman (tidak mengubah data).
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

test("kepala halaman: setiap halaman pemilik punya satu h1, jejak ruang, dan bantuan", async ({ page }) => {
  test.setTimeout(600_000);
  await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const r of ruangUntuk("pemilik")) {
    for (const h of r.halaman) {
      await page.goto(h.href);
      await expect(page.locator("main h1"), h.href).toHaveCount(1);
      const jejak = page.getByRole("navigation", { name: "Kamu di sini" });
      await expect(jejak.getByRole("link", { name: r.label.id, exact: true }), h.href).toBeVisible();
      await expect(jejak.locator("[aria-current=page]"), h.href).toHaveText(h.label.id);
    }
  }

  // Tinjauan rinci: bantuan terbuka, axe, tangkapan layar 390 dan 1440 terang/gelap.
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const jalur of ["/app/invoice", "/app/gaji"]) {
      await page.goto(jalur);
      await page.waitForLoadState("networkidle");
      await page.locator(".kepala-halaman summary").click();
      const bantuan = page.locator(".kepala-halaman details[open]");
      await expect(bantuan.getByRole("link", { name: "Panduan untuk peranmu" })).toBeVisible();
      for (const skema of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: skema });
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${jalur} ${lebar} ${skema}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${jalur} ${lebar} tanpa gulir samping`).toBe(true);
        await page.screenshot({ path: test.info().outputPath(`kepala-${jalur.replaceAll("/", "_")}-${lebar}-${skema}.png`) });
      }
      await page.emulateMedia({ colorScheme: "light" });
    }
  }
  // Jejak ruang membawa ke ruang itu di Semua menu.
  await page.goto("/app/invoice");
  await page.getByRole("navigation", { name: "Kamu di sini" }).getByRole("link", { name: "Uang" }).click();
  await page.waitForURL((u) => u.pathname === "/app/menu" && u.hash === "#menu-uang");
});
