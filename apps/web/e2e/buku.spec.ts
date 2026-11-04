import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// M-01: pemilik (akun A) membuka Laporan keuangan usaha aktifnya. Yang diperiksa:
// - neraca seimbang dan arus kas cocok dengan kas;
// - semua tab terbuka;
// - CSV terunduh dengan kepala kolom dan angka laba yang sama dengan layar;
// - kartu Uang usaha tampil di Feed.
// Saldo awal hanya diisi bila belum ada (data uji sintetis, sekali per usaha). Tutup buku diuji di tes SQL, bukan di sini,
// supaya bulan-bulan usaha uji tidak terkunci.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("laporan keuangan: neraca seimbang, arus kas cocok, CSV, dasbor uang di Feed", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/masuk?next=${encodeURIComponent("/app/buku")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/buku");
  await expect(page.getByRole("heading", { level: 1, name: "Laporan keuangan" })).toBeVisible();

  // Saldo awal sekali per usaha uji: kas 1.000.000 (selisih ke penyeimbang).
  const form = page.getByTestId("form-saldo-awal");
  if (await form.count()) {
    await form.getByLabel(/1-100/).fill("1.000.000");
    await form.getByRole("button", { name: "Simpan saldo awal" }).click();
    // revalidatePath merender ulang halaman: formulir diganti keterangan "sudah diisi".
  }
  await expect(page.getByTestId("saldo-awal-sudah")).toBeVisible();

  await expect(page.getByTestId("neraca-seimbang")).toHaveAttribute("data-seimbang", "ya");
  await periksaUi(page, "buku-neraca");

  await page.getByRole("link", { name: "Laba rugi" }).click();
  await page.waitForURL(/jenis=laba_rugi/);
  const labaLayar = (await page.getByTestId("laba-bersih").textContent()) ?? "";
  await page.getByRole("link", { name: "Arus kas" }).click();
  await page.waitForURL(/jenis=arus_kas/);
  await expect(page.getByTestId("arus-cocok")).toContainText("Cocok dengan saldo kas dan bank");
  await page.getByRole("link", { name: "Neraca saldo" }).click();
  await expect(page.getByTestId("lap-neraca-saldo")).toBeVisible();
  await page.getByRole("link", { name: "Umur tagihan" }).click();
  await expect(page.getByTestId("laporan")).toHaveAttribute("data-jenis", "umur_piutang");
  await page.getByRole("link", { name: "Buku besar" }).click();
  await page.getByLabel("Akun").selectOption("1-100");
  await page.getByRole("button", { name: "Tampilkan" }).click();
  await expect(page.getByTestId("lap-buku-besar")).toContainText("Saldo awal");
  await periksaUi(page, "buku-besar");

  // CSV laba rugi: kepala kolom dan angka laba sama dengan layar.
  const url = new URL(page.url());
  const csv = await page.request.get(`/app/buku/ekspor?jenis=laba_rugi&dari=${url.searchParams.get("dari")}&sampai=${url.searchParams.get("sampai")}`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const isi = await csv.text();
  expect(isi.startsWith("﻿Kode;Akun;Golongan;Nilai")).toBe(true);
  const angkaLaba = labaLayar.replace(/[^\d-]/g, "");
  expect(isi).toContain(`;Laba bersih;;${angkaLaba}`);

  await page.goto("/app");
  await expect(page.getByTestId("ringkasan-uang")).toBeVisible();
  await expect(page.getByTestId("ringkasan-uang").getByRole("link", { name: "Lihat laporan keuangan" })).toHaveAttribute("href", "/app/buku");
});
