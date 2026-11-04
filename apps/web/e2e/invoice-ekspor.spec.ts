import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// B-EKSIM1: pemilik menerbitkan invoice ekspor USD (kurs + sumber kurs dicatat), daftar menampilkan kurs dan packing list, dokumen
// cetak berbahasa Inggris (Commercial invoice + Packing list) dengan total yang sama dengan database; batal membalik.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

async function periksa(page: Page, nama: string, el?: Locator) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      if (el) await el.evaluate((x) => x.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${w} ${skema}`).toEqual([]);
      const lebar = await page.evaluate(() => document.documentElement.scrollWidth);
      if (nama !== "ekspor-cetak") expect(lebar, `${nama} ${w} tanpa gulir datar`).toBeLessThanOrEqual(w);
      await (el ?? page).screenshot({ path: test.info().outputPath(`${nama}-${w}-${skema}.png`), fullPage: !el });
    }
  }
}

test("invoice ekspor USD: kurs tercatat, packing list, cetak bahasa Inggris", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(180_000);
  const pembeli = `Harbour Roasters ${Date.now()}`;
  await page.goto("/masuk?next=/app/ekspor");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((x) => x.pathname === "/app/ekspor");
  await expect(page.getByTestId("tanpa-peb")).toContainText("Nadi tidak mengisi");

  const form = page.getByTestId("form-ekspor");
  await form.getByLabel("Alamat usahamu (eksportir)").fill("Jl. Raya Kintamani 12, Bangli, Bali");
  await form.getByLabel("Nama pembeli").fill(pembeli);
  await form.getByLabel("Negara tujuan").fill("Australia");
  await form.getByLabel("Alamat pembeli").fill("18 Wharf Street, Fremantle WA 6160");
  await form.getByLabel("Incoterms 2020").selectOption("FOB");
  await form.getByLabel("Tempat Incoterms").fill("Benoa");
  await form.getByLabel("Pelabuhan muat").fill("Benoa");
  await form.getByLabel("Pelabuhan tujuan").fill("Fremantle");
  await form.getByLabel("Kurs (Rp per USD)").fill("16.287,50");
  await form.getByLabel("Sumber kurs").fill("KMK kurs pajak minggu ini (uji)");
  const b1 = form.getByTestId("baris-ekspor").nth(0);
  await b1.getByLabel("Uraian (bahasa Inggris)").fill("Arabica green beans grade 1");
  await b1.getByLabel("Kode HS").fill("0901.11.10");
  await b1.getByLabel("Jumlah").fill("1200");
  await b1.getByLabel("Satuan").fill("kg");
  await b1.getByLabel("Harga USD").fill("7.35");
  await b1.getByLabel("Berat bersih kg").fill("1200");
  await b1.getByLabel("Berat kotor kg").fill("1224,5");
  await b1.getByLabel("Koli").fill("20");
  await form.getByRole("button", { name: "Tambah barang" }).click();
  const b2 = form.getByTestId("baris-ekspor").nth(1);
  await b2.getByLabel("Uraian (bahasa Inggris)").fill("Roasted beans sample");
  await b2.getByLabel("Jumlah").fill("3");
  await b2.getByLabel("Satuan").fill("bag");
  await b2.getByLabel("Harga USD").fill("0,35");
  await b2.getByLabel("Berat bersih kg").fill("3");
  await b2.getByLabel("Berat kotor kg").fill("3.2");
  await expect(form.getByTestId("total-ekspor")).toContainText("USD 8,821.05");
  await expect(form.getByTestId("total-ekspor")).toContainText("Rp143.672.852");
  await expect(form.getByTestId("total-ekspor")).toContainText("21 koli, bersih 1.203,000 kg, kotor 1.227,700 kg");
  await periksa(page, "ekspor-form", form);

  await form.getByRole("button", { name: "Terbitkan invoice ekspor" }).click();
  await expect(page.getByTestId("ekspor-terbit")).toContainText("USD 8,821.05");
  await expect(page.getByTestId("ekspor-terbit")).toContainText("Rp143.672.852");
  const baris = page.getByTestId("baris-daftar-ekspor").filter({ hasText: pembeli });
  await expect(baris).toHaveCount(1);
  await expect(baris.getByTestId("kurs-ekspor")).toContainText("Rp16.287,5");
  await expect(baris.getByTestId("kurs-ekspor")).toContainText("KMK kurs pajak minggu ini (uji)");
  await expect(baris).toContainText("21 koli");
  const nomor = await baris.getAttribute("data-nomor");
  expect(nomor).toMatch(/^\d{3}\/EXP\/[IVX]+\/\d{4}$/);
  await periksa(page, "ekspor-daftar", baris);

  const href = await baris.getByTestId("cetak-ekspor").getAttribute("href");
  await page.goto(href!);
  const inv = page.getByTestId("lembar-invoice-ekspor");
  await expect(inv.getByRole("heading", { level: 1 })).toHaveText("Commercial invoice");
  await expect(inv).toContainText(`No. ${nomor}`);
  await expect(inv).toContainText(pembeli);
  await expect(inv).toContainText("FOB Benoa (Incoterms 2020)");
  await expect(inv.getByTestId("total-usd-cetak")).toHaveText("USD 8,821.05");
  await expect(inv.getByTestId("kurs-cetak")).toContainText("IDR 143,672,852 at Rp16,287.5 per USD");
  await expect(inv).toContainText("PEB");
  await expect(page.locator('[lang="en"]').first()).toBeVisible();
  const pl = page.getByTestId("lembar-packing-list");
  await expect(pl.getByRole("heading", { level: 1 })).toHaveText("Packing list");
  await expect(pl.getByTestId("total-packing")).toContainText("21");
  await expect(pl.getByTestId("total-packing")).toContainText("1,203.000");
  await expect(pl.getByTestId("total-packing")).toContainText("1,227.700");
  await periksa(page, "ekspor-cetak");
  await page.emulateMedia({ media: "print", colorScheme: "light" });
  await page.pdf({ path: info.outputPath("invoice-ekspor.pdf"), format: "A4" }).catch(() => undefined);
  await page.emulateMedia({ media: "screen" });

  // Batal: jurnal dibalik, lembar cetak menyebut batal.
  await page.goto("/app/ekspor");
  const b = page.getByTestId("baris-daftar-ekspor").filter({ hasText: pembeli });
  await b.getByText("Batalkan invoice ini").click();
  await b.getByLabel("Alasan").fill("Uji e2e: pembeli menunda pengapalan");
  await b.getByRole("button", { name: "Batalkan" }).click();
  // Setelah revalidasi baris berubah jadi Batal dan formulir batal hilang bersama pesannya: periksa keadaan sesudahnya.
  await expect(b).toContainText("Dibatalkan:");
  await page.reload();
  await expect(page.getByTestId("baris-daftar-ekspor").filter({ hasText: pembeli })).toContainText("Uji e2e: pembeli menunda pengapalan");
  await page.goto(href!);
  await expect(page.getByTestId("ekspor-batal")).toHaveCount(2);
});
