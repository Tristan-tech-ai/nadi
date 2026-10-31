import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("beranda tampil, berbahasa Indonesia, tanpa pelanggaran aksesibilitas serius", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(2600); // nota demo selesai tercetak; axe membaca kontras saat masih memudar
  const hasil = await new AxeBuilder({ page }).analyze();
  const serius = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serius.map((v) => v.id)).toEqual([]);
});

test("area aplikasi mengalihkan tamu ke halaman masuk", async ({ page }) => {
  const res = await page.goto("/app");
  expect(page.url()).toContain("/masuk?next=%2Fapp");
  expect(res).not.toBeNull();
});

for (const jalur of ["/masuk", "/daftar"]) {
  test(`halaman ${jalur} tanpa pelanggaran aksesibilitas serius`, async ({ page }, info) => {
    await page.goto(jalur);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const hasil = await new AxeBuilder({ page }).analyze();
    expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: info.outputPath(`${jalur.slice(1)}-${info.project.name}.png`) });
  });
}

test("landing: demo nota bisa disetujui, axe bersih di 390 dan 1440 px terang dan gelap", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop), lebar diatur sendiri");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nadi yang merapikan");
  await expect(page.getByRole("link", { name: "Mulai dari satu nota" })).toHaveAttribute("href", "/daftar");
  const demo = page.locator("article", { hasText: "Catat belanja" });
  // ANTI-SLOP S12: judul tampilan paling banyak 3 baris di 390 px.
  await page.setViewportSize({ width: 390, height: 844 });
  const h1 = page.getByRole("heading", { level: 1 });
  const baris = await h1.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  expect(baris).toBeLessThanOrEqual(3);
  await page.setViewportSize({ width: 1440, height: 900 });
  await demo.getByRole("button", { name: "Setujui" }).click();
  await expect(demo).toContainText("Tercatat sebagai belanja 13 Okt 2026.");
  await demo.getByRole("button", { name: "Ulangi" }).click();
  await expect(page.locator("article", { hasText: "Catat belanja" }).getByRole("button", { name: "Tolak" })).toBeVisible();
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(2600); // nota selesai tercetak dan transisi warna selesai
      const hasil = await new AxeBuilder({ page }).analyze();
      expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: info.outputPath(`landing-${lebar}-${skema}.png`), fullPage: true });
    }
  }
});

test("coba usaha contoh dari landing: Feed demo tampil < 3 dtk, baca-saja, axe bersih", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop), lebar diatur sendiri");
  await page.goto("/");
  const mulai = Date.now();
  await page.getByRole("link", { name: "Coba usaha contoh tanpa daftar" }).click();
  // Cache Components menyimpan halaman sebelumnya (tersembunyi) saat pindah rute, jadi batasi ke Feed yang terlihat.
  const feed = page.getByTestId("feed-demo").filter({ visible: true });
  await expect(feed.locator("article")).toHaveCount(4);
  expect(Date.now() - mulai).toBeLessThan(3000);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Warung Makan Bu Ratna (contoh)");
  const kartu = feed.locator("article", { hasText: "Catat izin sakit Komang Ayu" });
  await kartu.getByRole("button", { name: "Setujui" }).click();
  await expect(kartu.getByTestId("hasil-demo")).toContainText("tidak disimpan");
  await page.getByRole("link", { name: "Toko grosir" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Toko Grosir Sinar Jaya (contoh)");
  await expect(feed.locator("article")).toHaveCount(3);
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const hasil = await new AxeBuilder({ page }).analyze();
      expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: info.outputPath(`demo-${lebar}-${skema}.png`), fullPage: true });
    }
  }
});
