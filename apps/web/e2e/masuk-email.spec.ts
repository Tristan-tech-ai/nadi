import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Masuk lewat email (tanpa sandi), lupa kata sandi, dan daftar ulang email yang sudah terdaftar (temuan log auth 6 Nov 2026:
// user_repeated_signup tanpa email, pengguna menunggu email yang tidak pernah datang). Tes tidak pernah membuat Supabase
// mengirim email sungguhan: email yang dipakai belum terdaftar (Supabase tidak mengirim apa pun) atau sudah terdaftar di
// jalur daftar (Supabase juga tidak mengirim), sehingga batas 2 email per jam proyek tidak terpakai.
function envUji(): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", ".env.e2e.local"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = envUji();
const TIDAK_ADA = `belum-terdaftar-${Date.now()}@nadi-uji.id`;

async function axeBersih(page: Page, nama: string) {
  for (const skema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: skema });
    await page.waitForTimeout(350);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${skema}`).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`${nama}-${skema}.png`), fullPage: true });
  }
  await page.emulateMedia({ colorScheme: "light" });
}

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali");
});

test("halaman masuk menawarkan lupa sandi dan masuk lewat email", async ({ page }) => {
  for (const lebar of [390, 1440]) {
    await page.setViewportSize({ width: lebar, height: 900 });
    await page.goto("/masuk?next=/app/gaji");
    await expect(page.getByRole("link", { name: "Lupa kata sandi?" })).toHaveAttribute("href", "/masuk/lupa");
    await expect(page.getByTestId("tautan-kode")).toHaveAttribute("href", "/masuk/kode?next=%2Fapp%2Fgaji");
    await axeBersih(page, `masuk-${lebar}`);
  }
  await page.goto("/masuk?galat=tautan");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Tautan di email sudah tidak berlaku");
});

test("masuk lewat email: email yang belum terdaftar diberi tahu, bukan disuruh menunggu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/masuk/kode?next=/app");
  await page.getByLabel("Email").fill("bukan-email");
  await page.getByRole("button", { name: "Kirim email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("alamat email yang lengkap");
  await page.getByLabel("Email").fill(TIDAK_ADA);
  await page.getByRole("button", { name: "Kirim email" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("belum punya akun Nadi");
  await expect(page.getByTestId("langkah-kode")).toHaveCount(0);
  await axeBersih(page, "kode-390");
});

test("lupa kata sandi: langkah kedua tampil, kirim ulang menunggu 60 detik, email bisa diganti", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/masuk/lupa");
  await page.getByLabel("Email").fill(TIDAK_ADA);
  await page.getByRole("button", { name: "Kirim email" }).click();
  const langkah = page.getByTestId("langkah-kode");
  await expect(langkah).toBeVisible();
  await expect(langkah.getByRole("status")).toContainText(TIDAK_ADA);
  const adaKode = (await langkah.getAttribute("data-ada-kode")) === "ya";
  // Isian kode hanya tampil bila templat email memuat kode (NADI_KODE_EMAIL=1); tanpa itu Nadi meminta membuka tautan.
  await expect(page.getByLabel("Kode dari email")).toHaveCount(adaKode ? 1 : 0);
  if (adaKode) {
    await page.getByLabel("Kode dari email").fill("12");
    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("6 sampai 10 angka");
  } else await expect(langkah.getByRole("status")).toContainText("Ketuk tautannya");
  await expect(page.getByRole("button", { name: /Kirim ulang dalam \d+ dtk/ })).toBeDisabled();
  await axeBersih(page, "lupa-390");
  await page.getByRole("button", { name: "Ganti email" }).click();
  await expect(page.getByLabel("Email")).toHaveValue(TIDAK_ADA);
});

test("kata sandi baru tanpa sesi atur ulang meminta email baru", async ({ page }) => {
  await page.goto("/masuk/sandi-baru");
  await page.getByLabel("Kata sandi baru").fill("sandibaru123");
  await page.getByRole("button", { name: "Simpan kata sandi" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Waktu atur ulang sudah habis");
  await expect(page.getByRole("main").getByRole("alert").getByRole("link", { name: "Atur ulang kata sandi" })).toHaveAttribute("href", "/masuk/lupa");
});

test("daftar dengan email yang sudah terdaftar diarahkan ke masuk, bukan cek email", async ({ page }) => {
  test.skip(!E.E2E_EMAIL_A, "butuh .env.e2e.local");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/daftar");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill("sandiacak-" + Date.now());
  await page.getByRole("button", { name: "Buat akun" }).click();
  const galat = page.getByRole("main").getByRole("alert");
  await expect(galat).toContainText("sudah punya akun");
  await expect(galat.getByRole("link", { name: "Lupa kata sandi?" })).toBeVisible();
  await expect(galat.getByRole("link", { name: "Masuk lewat email tanpa kata sandi" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("status")).toHaveCount(0);
  await axeBersih(page, "daftar-terdaftar-390");
});
