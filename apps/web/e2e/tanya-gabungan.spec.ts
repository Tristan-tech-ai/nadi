import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// M-22B, LOKAL saja: pertanyaan gabungan "penjualan dan laba bulan ini" dijawab dua kali dengan periode yang sama, tanpa model;
// rentang bebas "tanggal 1 sampai 5" ikut terbaca. Jalankan seperti e2e/mod.spec.ts (E2E_BASE_URL, E2E_LOKAL_URL, E2E_LOKAL_KUNCI).
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("tanya data: pertanyaan gabungan menghasilkan dua jawaban", async ({ page }) => {
  test.setTimeout(180_000);
  const email = `tanya-gabung-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  expect((await sb.rpc("buat_perusahaan", { p_nama: "Toko Uji Tanya Gabung", p_industri: "toko" })).error).toBeNull();
  const galat: string[] = [];
  page.on("pageerror", (e) => galat.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/masuk?next=${encodeURIComponent("/app/tanya")}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/tanya", { timeout: 60_000 });
  await page.getByLabel("Pertanyaanmu").fill("Penjualan dan laba bulan ini berapa?");
  await page.getByRole("button", { name: "Tanya", exact: true }).click();
  const jawaban = page.getByTestId("tanya-jawaban");
  await expect(jawaban).toBeVisible({ timeout: 30_000 });
  await expect(jawaban.getByTestId("tanya-jawaban-lain")).toHaveCount(1);
  await expect(page.getByTestId("tanya-asal")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  expect(galat).toEqual([]);
});
