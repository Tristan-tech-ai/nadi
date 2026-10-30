import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Akun uji sintetis (sudah terkonfirmasi) dari apps/web/.env.e2e.local, tidak ikut git. Tanpa berkas itu tes dilewati.
function envUji(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(join(__dirname, "..", ".env.e2e.local"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    );
  } catch {
    return {};
  }
}
const E = envUji();

test.describe.configure({ mode: "serial" });
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "alur akun dijalankan sekali (desktop) dan butuh .env.e2e.local");
});

async function masukSebagai(page: Page, email: string) {
  await page.goto("/masuk?next=/app");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app/);
}

const JUDUL_MULAI = "Usaha apa yang kamu jalankan?";

async function pastikanUsaha(page: Page, nama: string, industri = "Warung, kafe, restoran") {
  // /app bisa mengalihkan ke /app/mulai lewat streaming; tunggu salah satu keadaan akhir, bukan URL sesaat.
  await expect(page.getByTestId("peran").or(page.getByRole("heading", { name: JUDUL_MULAI }))).toBeVisible();
  if (await page.getByRole("heading", { name: JUDUL_MULAI }).isVisible()) {
    await page.getByLabel("Nama usaha").fill(nama);
    await page.getByLabel(industri).check();
    await page.getByRole("button", { name: "Siapkan usahaku" }).click();
    await page.waitForURL((u) => u.pathname === "/app");
  }
  await expect(page.getByTestId("nama-perusahaan")).toBeVisible();
}

function klaimDariCookie(cookies: { name: string; value: string }[]) {
  const potongan = cookies.filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name)).map((c) => c.value).join("");
  const json = JSON.parse(Buffer.from(potongan.replace(/^base64-/, ""), "base64").toString("utf8"));
  return JSON.parse(Buffer.from(json.access_token.split(".")[1], "base64url").toString("utf8"));
}

test("kata sandi salah memberi pesan yang jelas", async ({ page }) => {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill("salah-sekali-123");
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("tidak cocok");
});

test("daftar menolak kata sandi pendek sebelum menghubungi server", async ({ page }) => {
  await page.goto("/daftar");
  await page.getByLabel("Email").fill("baru@uji.nadi.local");
  await page.getByLabel("Kata sandi").fill("123");
  await page.getByRole("button", { name: "Buat akun" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("8 karakter");
});

test("pemilik A: masuk, siapkan usaha, klaim pid ada di JWT", async ({ page, context }) => {
  await masukSebagai(page, E.E2E_EMAIL_A);
  await pastikanUsaha(page, "Warung Uji A");
  await expect(page.getByTestId("peran")).toContainText("pemilik");
  const klaim = klaimDariCookie(await context.cookies());
  expect(klaim.app_metadata?.pid).toMatch(/^[0-9a-f-]{36}$/);
  expect(klaim.app_metadata?.prn).toBe("pemilik");
});

test("pemilik B tidak melihat usaha A", async ({ page }) => {
  await masukSebagai(page, E.E2E_EMAIL_B);
  await pastikanUsaha(page, "Toko Uji B", "Toko, grosir, minimarket");
  await page.goto("/app/perusahaan");
  await expect(page.getByRole("main").getByText("Toko Uji B")).toBeVisible();
  await expect(page.getByRole("main").getByText("Warung Uji A")).toHaveCount(0);
});

test("pemilik A pindah antar dua usaha, klaim ikut berganti", async ({ page, context }) => {
  await masukSebagai(page, E.E2E_EMAIL_A);
  await pastikanUsaha(page, "Warung Uji A");
  await page.goto("/app/perusahaan");
  if ((await page.getByRole("listitem").count()) < 2) {
    await page.goto("/app/mulai");
    await pastikanUsaha(page, "Cabang Uji A2");
    await page.goto("/app/perusahaan");
  }
  const sebelum = klaimDariCookie(await context.cookies()).app_metadata.pid;
  await page.getByRole("button", { name: "Buka" }).first().click();
  await page.waitForURL((u) => u.pathname === "/app");
  const sesudah = klaimDariCookie(await context.cookies()).app_metadata.pid;
  expect(sesudah).not.toBe(sebelum);
});

test("pemilik membuat akun staf; staf masuk tanpa email dan ditolak di halaman pengelola", async ({ page, browser }) => {
  await masukSebagai(page, E.E2E_EMAIL_A);
  await pastikanUsaha(page, "Warung Uji A");
  await page.goto("/app/orang");
  const kode = (await page.getByTestId("kode-usaha").textContent())!.trim();
  const nama = `Staf Uji ${Date.now()}`;
  await page.getByLabel("Nama orang").fill(nama);
  await page.getByRole("button", { name: "Tambah" }).click();
  const baris = page.getByRole("listitem").filter({ hasText: nama });
  await expect(baris).toBeVisible();
  await baris.getByPlaceholder("PIN 6 angka").fill("246810");
  await baris.getByRole("button", { name: "Buat akun staf" }).click();
  await expect(baris.getByTestId("info-akun")).toContainText(`kode ${kode}`);
  const id = (await baris.getByTestId("info-akun").textContent())!.match(/ID (S\d{3})/)![1];

  const staf = await (await browser.newContext()).newPage();
  await staf.goto("/masuk/staf");
  await staf.getByLabel("Kode usaha").fill(kode);
  await staf.getByLabel("ID kamu").fill(id);
  await staf.getByLabel("PIN").fill("246810");
  await staf.getByRole("button", { name: "Masuk" }).click();
  await expect(staf.getByTestId("peran")).toContainText("staf");
  await staf.goto("/app/orang");
  await expect(staf.getByTestId("ditolak")).toBeVisible();
});
