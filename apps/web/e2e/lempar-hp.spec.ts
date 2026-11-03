import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// D-13: Lempar Saja di HP 390 px. Ukur waktu nota dilempar sampai usulan tampil, dan berapa ketukan/pindah layar sampai
// disetujui (baris UKUR untuk banding sebelum/sesudah). Keadaan luring dan galat + Coba lagi diuji di tes terpisah.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = bacaEnv(".env.e2e.local");
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus");
const nota = () => ({ name: `nota-${Date.now()}.png`, mimeType: "image/png", buffer: Buffer.concat([readFileSync(join(KORPUS, "nota/nota-01.png")), Buffer.from(`\n${Date.now()}`)]) });
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

test.describe.configure({ mode: "serial" });
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

async function masukLempar(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/masuk?next=/app/lempar");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/lempar/);
}

test("lempar nota sampai disetujui di 390 px", async ({ page }) => {
  test.setTimeout(120_000);
  await masukLempar(page);
  const mulai = Date.now();
  await page.getByTestId("input-berkas").setInputFiles(nota());
  const baris = page.getByTestId("daftar-lempar").locator(":scope > li").first();
  await expect(baris).toHaveAttribute("data-status", "usulan", { timeout: 60_000 });
  const keUsulan = (Date.now() - mulai) / 1000;
  await page.screenshot({ path: foto("lempar-usulan-390.png") });
  let ketuk = 0;
  let pindah = 0;
  const kartuLokal = baris.getByTestId("usulan-lempar");
  if (await kartuLokal.count()) {
    // Tanpa gulir: tombol Setujui kartu di halaman Lempar sudah di layar.
    await expect(kartuLokal.getByRole("button", { name: "Setujui" })).toBeInViewport();
    await kartuLokal.getByRole("button", { name: "Setujui" }).click();
    ketuk++;
    await expect(kartuLokal.getByTestId("kartu-diputuskan")).toHaveAttribute("data-tersimpan", "ya");
  } else {
    await page.getByTestId("ke-feed").click();
    ketuk++;
    pindah++;
    await page.waitForURL((u) => u.pathname === "/app");
    const kartu = page.locator("article", { hasText: "Catat belanja Rp376.500" }).first();
    await kartu.getByRole("button", { name: "Setujui" }).click();
    ketuk++;
    await expect(kartu.getByTestId("hasil-putusan")).toContainText("Tersimpan");
  }
  const total = (Date.now() - mulai) / 1000;
  console.log(`UKUR lempar-hp: usulan tampil ${keUsulan.toFixed(1)} dtk, selesai ${total.toFixed(1)} dtk, ketuk ${ketuk}, pindah layar ${pindah}`);
  for (const skema of ["light", "dark"] as const) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${w} ${skema}`).toEqual([]);
      await page.screenshot({ path: foto(`lempar-selesai-${w}-${skema}.png`) });
    }
  }
});

test("luring: berkas ditahan, dikirim otomatis saat sinyal kembali", async ({ page }) => {
  test.setTimeout(120_000);
  await masukLempar(page);
  // Bendera luring peramban disimulasikan (navigator.onLine + peristiwa online): setOffline Playwright membuat setInputFiles macet.
  await page.evaluate(() => {
    const w = window as unknown as { __luring: boolean };
    w.__luring = true;
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => !w.__luring });
  });
  await page.getByTestId("input-berkas").setInputFiles(nota());
  const baris = page.getByTestId("daftar-lempar").locator(":scope > li").first();
  await expect(baris).toHaveAttribute("data-tahap", "luring");
  await expect(baris).toContainText("Sinyal hilang");
  await page.screenshot({ path: foto("lempar-luring-390.png") });
  await page.evaluate(() => {
    (window as unknown as { __luring: boolean }).__luring = false;
    window.dispatchEvent(new Event("online"));
  });
  await expect(baris).toHaveAttribute("data-status", "usulan", { timeout: 60_000 });
  // Bersihkan: tolak usulan uji ini lewat tombol biasa.
  await baris.getByTestId("usulan-lempar").getByRole("button", { name: "Tolak" }).click();
  await expect(baris.getByTestId("kartu-diputuskan")).toHaveAttribute("data-tersimpan", "ya");
});

test("galat saat mendaftarkan berkas: pesan jelas lalu Coba lagi berhasil", async ({ page }) => {
  test.setTimeout(120_000);
  await masukLempar(page);
  let gagalkan = true;
  await page.route("**/rest/v1/rpc/lempar_berkas", (r) => (gagalkan ? ((gagalkan = false), r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: "galat uji", details: null, hint: null }) })) : r.continue()));
  await page.getByTestId("input-berkas").setInputFiles(nota());
  const baris = page.getByTestId("daftar-lempar").locator(":scope > li").first();
  await expect(baris).toHaveAttribute("data-status", "galat");
  await expect(baris).toContainText("Nadi gagal mendaftarkan berkas");
  await baris.getByTestId("coba-lagi").click();
  await expect(baris).toHaveAttribute("data-status", "usulan", { timeout: 60_000 });
  await baris.getByTestId("usulan-lempar").getByRole("button", { name: "Tolak" }).click();
  await expect(baris.getByTestId("kartu-diputuskan")).toHaveAttribute("data-tersimpan", "ya");
});
