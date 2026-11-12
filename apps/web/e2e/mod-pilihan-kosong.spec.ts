import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Q-48, LOKAL saja (temuan rekaman video v2): paket Pesanan katering di usaha yang belum punya pelanggan. Isian Pelanggan wajib
// tidak buntu: ada kalimat dan tautan ke halaman Pelanggan. Jalankan seperti e2e/alur-jeda.spec.ts.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("fitur tambahan: isian Pelanggan kosong menautkan ke halaman Pelanggan", async ({ page }) => {
  test.setTimeout(180_000);
  const email = `mod-kosong-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Dapur Uji Katering", p_industri: "fnb" });
  expect(usaha.error, usaha.error?.message).toBeNull();

  const galat: string[] = [];
  page.on("pageerror", (e) => galat.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Ftambah-fitur");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/tambah-fitur", { timeout: 60_000 });
  await page.getByRole("form", { name: "Pasang Pesanan katering" }).getByRole("button", { name: "Pasang" }).click();
  await page.goto("/app/mod/katering-pesanan");
  await page.getByText("Tambah pesanan", { exact: true }).click();
  const kosong = page.getByTestId("mod-pilihan-kosong").filter({ hasText: "pelanggan" });
  await expect(kosong).toContainText("Belum ada pelanggan tercatat");
  await expect(kosong.getByRole("link", { name: "Tambah pelanggan" })).toHaveAttribute("href", "/app/pelanggan");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await kosong.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/mod-kosong-layar/mod-kosong-${lebar}-${skema === "light" ? "terang" : "gelap"}.png` });
    }
  }
  expect(galat).toEqual([]);
});
