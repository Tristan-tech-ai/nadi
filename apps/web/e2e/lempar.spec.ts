import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// Lempar Saja ujung ke ujung lewat layar: pilih berkas -> unggah -> dibaca AI -> usulan di Feed -> Setujui membuat data.
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
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus");
// Byte unik di ujung PNG (diabaikan pembaca gambar) agar setiap jalan benar-benar dibaca ulang, bukan dianggap berkas lama.
const unik = (jalur: string) => Buffer.concat([readFileSync(join(KORPUS, jalur)), Buffer.from(`\n${Date.now()}`)]);

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

test("lempar KTP dan nota, lalu setujui keduanya di Feed", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/masuk?next=/app/lempar");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/lempar/);

  await page.getByTestId("input-berkas").setInputFiles([
    { name: "ktp-01.png", mimeType: "image/png", buffer: unik("ktp/ktp-01.png") },
    { name: "nota-01.png", mimeType: "image/png", buffer: unik("nota/nota-01.png") },
  ]);
  const daftar = page.getByTestId("daftar-lempar");
  await expect(daftar.locator("li")).toHaveCount(2);
  await expect(daftar.locator('li[data-status="usulan"]')).toHaveCount(2, { timeout: 60_000 });
  await expect(daftar).toContainText("Tambah AGUS ASTUTI ke daftar orang");
  await expect(daftar).toContainText("Catat belanja Rp376.500 di UD Sumber Rejeki");

  await page.getByTestId("ke-feed").click();
  await page.waitForURL((u) => u.pathname === "/app");
  const kartuKtp = page.locator("article", { hasText: "Tambah AGUS ASTUTI ke daftar orang" }).first();
  await expect(kartuKtp).toContainText("Dari Lempar Saja");
  await kartuKtp.getByRole("button", { name: "Setujui" }).click();
  await expect(kartuKtp.getByTestId("hasil-putusan")).toContainText("Satu orang ditambahkan");

  const kartuNota = page.locator("article", { hasText: "Catat belanja Rp376.500" }).first();
  await kartuNota.getByRole("button", { name: "Setujui" }).click();
  await expect(kartuNota.getByTestId("hasil-putusan")).toContainText("Tersimpan dan dicatat");

  // Orang hasil KTP muncul di daftar orang.
  await page.goto("/app/orang");
  await expect(page.getByText("Agus Astuti").first()).toBeVisible();

  // Pemilik melihat ringkasan pemakaian AI: dua berkas tadi dibaca AI, token tercatat.
  await page.goto("/app/perusahaan");
  const hemat = page.getByTestId("hemat-ai");
  await expect(hemat).toContainText("Dibaca AI");
  await expect(page.getByTestId("ringkas-token")).toContainText(/Token terpakai \d/);
});

test("berkas yang tidak bisa dibaca ditolak dengan pesan jelas", async ({ page }) => {
  await page.goto("/masuk?next=/app/lempar");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/lempar/);
  await page.getByTestId("input-berkas").setInputFiles({ name: "catatan.txt", mimeType: "text/plain", buffer: Buffer.from("halo") });
  await expect(page.getByTestId("daftar-lempar")).toContainText("Jenis berkas ini belum bisa dibaca");
});
