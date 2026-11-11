import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// X-12 proyek operasional, LOKAL saja: pemilik menulis template (kerja + checklist), membuat proyek berulang bulanan dari
// template dengan PIC dan tim, lalu melihat proyek, periode, dan kerjanya. Invoice dari proyek diuji di tes SQL.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/proyek-ops-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("proyek operasional: template, proyek berulang, periode, kerja dari template", async ({ page }) => {
  test.setTimeout(240_000);
  const email = `proyek-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Agensi Proyek Ops", p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  expect((await sb.from("orang").insert([{ perusahaan_id: usaha.data, nama: "Sari Ops", jenis: ["karyawan"] }, { perusahaan_id: usaha.data, nama: "Dewi Ops", jenis: ["karyawan"] }])).error).toBeNull();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Fproyek");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/proyek", { timeout: 60_000 });
  const ops = page.getByTestId("proyek-operasional");
  await expect(ops).toBeVisible({ timeout: 60_000 });

  await ops.getByText("Template proyek (0)").click();
  const ft = ops.getByRole("form", { name: "Simpan template proyek" });
  await ft.getByLabel("Nama template").fill("Konten bulanan");
  await ft.getByLabel(/Kerja \(satu per baris/).fill("Brief klien | 0 | Kumpulkan logo; Konfirmasi warna | 1\nPosting konten | 5 | Draf; Jadwal | 2");
  await ft.getByRole("button", { name: "Simpan template" }).click();
  await expect(ops.getByTestId("daftar-template")).toContainText("Posting konten", { timeout: 20_000 });

  if (!(await ops.getByTestId("buat-proyek-ops").evaluate((d) => (d as HTMLDetailsElement).open))) await ops.getByTestId("buat-proyek-ops").locator("summary").click();
  const fp = ops.getByRole("form", { name: "Buat proyek operasional" });
  await fp.getByLabel("Nama proyek").fill("Konten Hotel Bali");
  await fp.getByLabel("Tipe").selectOption("berulang");
  await fp.getByLabel("Pola (untuk berulang)").selectOption("bulanan");
  await fp.getByLabel("Template").selectOption({ label: "Konten bulanan" });
  await fp.getByLabel("PIC").selectOption({ label: "Sari Ops" });
  await fp.getByRole("group", { name: "Tim" }).getByLabel("Dewi Ops").check();
  await fp.getByRole("button", { name: "Buat proyek" }).click();
  await expect(ops.getByTestId("daftar-proyek-ops")).toContainText("Konten Hotel Bali", { timeout: 20_000 });
  const baris = ops.locator("[data-proyek='Konten Hotel Bali']");
  await expect(baris).toContainText("Berulang bulanan");
  await expect(baris).toContainText("2 kerja (0 selesai)");
  await expect(baris).toContainText("1 periode");

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  mkdirSync(LAYAR, { recursive: true });
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: `${LAYAR}/proyek-${lebar}-${skema === "light" ? "terang" : "gelap"}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/kerja");
  await expect(page.locator("[data-testid=kartu-kerja][data-judul='Posting konten']")).toBeVisible({ timeout: 30_000 });
});
