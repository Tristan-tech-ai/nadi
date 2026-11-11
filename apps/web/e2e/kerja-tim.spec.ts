import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// X-10 kerja tim, LOKAL saja (mode tanpa commit): pemilik membuat kerja, mengatur tim dua orang dengan porsi 60/40 dan PIC,
// menambah dua butir checklist, mencentang satu, dan melihat tim serta progres 1/2 di kartu. Jalankan seperti e2e/mod.spec.ts.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/kerja-tim-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("kerja tim: porsi, PIC, checklist, progres", async ({ page }) => {
  test.setTimeout(240_000);
  const email = `kerja-tim-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Agensi Kerja Tim", p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const orang = await sb.from("orang").insert([{ perusahaan_id: usaha.data, nama: "Sari Tim", jenis: ["karyawan"] }, { perusahaan_id: usaha.data, nama: "Budi Tim", jenis: ["karyawan"] }]).select("id, nama");
  expect(orang.error, orang.error?.message).toBeNull();
  const kerja = await sb.rpc("buat_kerja", { p_judul: "Desain katalog klien", p_topi: null, p_pelaksana: orang.data![0].id, p_tenggat: null, p_kunci: null });
  expect(kerja.error, kerja.error?.message).toBeNull();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Fkerja");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/kerja", { timeout: 60_000 });
  const kartu = page.locator("[data-testid=kartu-kerja][data-judul='Desain katalog klien']");
  await expect(kartu).toBeVisible({ timeout: 60_000 });

  await kartu.getByTestId("tim-checklist").locator("summary").click();
  const tim = kartu.getByRole("form", { name: "Tim untuk Desain katalog klien" });
  await tim.locator("[data-baris-tim='0'] input[type=number]").fill("60");
  await tim.getByRole("button", { name: "Tambah orang" }).click();
  await tim.locator("[data-baris-tim='1'] select").selectOption({ label: "Budi Tim" });
  await tim.locator("[data-baris-tim='1'] input[type=number]").fill("30");
  await expect(tim.getByTestId("jumlah-porsi")).toContainText("90%");
  await tim.getByRole("button", { name: "Simpan tim" }).click();
  await expect(tim.getByRole("alert")).toContainText("Jumlah porsi harus 100%");
  await tim.locator("[data-baris-tim='1'] input[type=number]").fill("40");
  await tim.getByRole("button", { name: "Simpan tim" }).click();
  await expect(kartu.getByTestId("tim-kerja")).toContainText("Sari Tim 60% (PIC), Budi Tim 40%", { timeout: 20_000 });

  if (!(await kartu.getByTestId("tim-checklist").evaluate((d) => (d as HTMLDetailsElement).open))) await kartu.getByTestId("tim-checklist").locator("summary").click();
  for (const b of ["Buat layout", "Cek di HP"]) {
    await kartu.getByLabel("Butir baru").fill(b);
    await kartu.getByRole("button", { name: "Tambah butir" }).click();
    await expect(kartu.getByTestId("checklist-kerja")).toContainText(b, { timeout: 20_000 });
  }
  await kartu.getByRole("button", { name: "Buat layout" }).click();
  await expect(kartu.getByTestId("progres-butir")).toContainText("1/2", { timeout: 20_000 });
  await expect(kartu.getByRole("button", { name: "Buat layout" })).toHaveAttribute("aria-pressed", "true");

  const hasil = await new AxeBuilder({ page }).analyze();
  expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  mkdirSync(LAYAR, { recursive: true });
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: `${LAYAR}/kerja-${lebar}-${skema === "light" ? "terang" : "gelap"}.png`, fullPage: true });
    }
  }
});
