import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// L-03 mode coba: /demo membuka aplikasi Nadi yang sebenarnya (usaha contoh Toko Bu Sari) lewat sesi anonim, baca saja.
// Bila masuk anonim belum dinyalakan di Supabase, halaman berkata jujur dan tidak menampilkan tombol yang akan gagal.
// Penulisan ditolak database (pre-request baca saja, tes SQL supabase/tests/usaha_tamu.test.sql); di sini diuji dari layar.
const HALAMAN = ["/app", "/app/lempar", "/app/invoice", "/app/orang", "/app/gaji", "/app/buku", "/app/kerja", "/app/mata", "/app/perusahaan", "/app/menu", "/app/siapkan", "/app/tanya"];

test("mode coba: /demo masuk ke aplikasi sungguhan, semua layar terbuka, perubahan tidak tersimpan", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali");
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  const blok = page.getByTestId("coba-aplikasi");
  await expect(blok.getByRole("heading", { level: 1, name: "Coba Nadi tanpa daftar" })).toBeVisible();
  for (const skema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: skema });
    await page.waitForTimeout(350);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `demo ${skema}`).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`demo-390-${skema}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
  const tombol = blok.getByRole("button", { name: "Buka usaha contoh" });
  if (!(await tombol.count())) {
    await expect(page.getByTestId("coba-belum")).toContainText("sedang disiapkan");
    test.info().annotations.push({ type: "catatan", description: "masuk anonim belum dinyalakan; alur di dalam aplikasi dilewati" });
    return;
  }

  await tombol.click();
  await page.waitForURL((u) => u.pathname === "/app");
  await expect(page.getByTestId("pita-coba")).toContainText("perubahan tidak disimpan");
  await expect(page.getByTestId("nama-perusahaan")).toHaveText("Toko Bu Sari");
  for (const jalur of HALAMAN) {
    const r = await page.goto(jalur);
    expect(r?.status(), jalur).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 }).first(), jalur).toBeVisible();
    await expect(page.getByText("Application error"), jalur).toHaveCount(0);
    await expect(page.getByTestId("pita-coba"), jalur).toBeVisible();
  }
  for (const lebar of [390, 1440]) {
    await page.setViewportSize({ width: lebar, height: 900 });
    await page.goto("/app");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: test.info().outputPath(`coba-app-${lebar}.png`) });
  }

  // Menambah orang ditolak dan tidak muncul.
  await page.goto("/app/orang");
  const nama = `Coba Tamu ${Date.now()}`;
  await page.getByLabel("Nama orang").fill(nama);
  await page.getByRole("button", { name: "Tambah orang" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.reload();
  await expect(page.getByText(nama)).toHaveCount(0);

  // Keluar dari mode coba kembali ke /demo dan sesi hilang.
  await page.getByTestId("pita-coba").getByRole("button", { name: "Keluar dari mode coba" }).click();
  await page.waitForURL((u) => u.pathname === "/demo");
  await page.goto("/app");
  await page.waitForURL((u) => u.pathname === "/masuk");
});
