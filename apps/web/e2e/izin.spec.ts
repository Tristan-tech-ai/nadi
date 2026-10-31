import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// F1-03: pemilik mengatur aturan sakit; staf mengajukan sakit 1 hari dengan bukti (disetujui otomatis) dan 3 hari (masuk Feed);
// pemilik menyetujui dari Feed; staf melihat statusnya berubah.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = bacaEnv(".env.e2e.local");

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

const tanggal = (tambahHari: number) => {
  const d = new Date(Date.now() + 8 * 3600_000 + tambahHari * 86_400_000);
  return d.toISOString().slice(0, 10);
};

test("izin: otopilot menyetujui sesuai aturan, sisanya masuk Feed dan diputuskan pemilik", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await page.goto("/masuk?next=/app/perusahaan");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/perusahaan");
  const buka = page.getByRole("listitem").filter({ hasText: "Warung Uji A" }).getByRole("button", { name: "Buka" });
  if (await buka.isVisible()) {
    await buka.click();
    await page.waitForURL((u) => u.pathname === "/app");
    await page.goto("/app/perusahaan");
  }

  // Aturan sakit: otomatis sampai 1 hari, wajib bukti, tanpa batas orang bersamaan.
  const sakit = page.getByTestId("kebijakan-sakit");
  await sakit.getByLabel("Setujui otomatis").check();
  await sakit.getByLabel("Paling lama (hari)").fill("1");
  await sakit.getByLabel("Orang izin bersamaan, paling banyak").fill("");
  await sakit.getByLabel("Wajib ada bukti").check();
  await sakit.getByRole("button", { name: "Simpan" }).click();
  await expect(sakit.getByText("Tersimpan. Kebijakan sakit")).toBeVisible();
  await page.getByTestId("aturan-izin").scrollIntoViewIfNeeded();
  await periksaUi(page, "kebijakan-izin");

  // Staf baru.
  await page.goto("/app/orang");
  const kode = (await page.getByTestId("kode-usaha").textContent())!.trim();
  const nama = `Staf Izin ${Date.now()}`;
  await page.getByLabel("Nama orang").fill(nama);
  await page.getByRole("button", { name: "Tambah" }).click();
  const baris = page.getByRole("listitem").filter({ hasText: nama });
  await baris.getByPlaceholder("PIN 6 angka").fill("135790");
  await baris.getByRole("button", { name: "Buat akun staf" }).click();
  const id = (await baris.getByTestId("info-akun").textContent())!.match(/ID (S\d{3})/)![1];

  const staf = await (await browser.newContext()).newPage();
  await staf.goto("/masuk/staf");
  await staf.getByLabel("Kode usaha").fill(kode);
  await staf.getByLabel("ID kamu").fill(id);
  await staf.getByLabel("PIN").fill("135790");
  await staf.getByRole("button", { name: "Masuk" }).click();
  await expect(staf.getByTestId("peran")).toContainText("staf");
  await staf.getByRole("link", { name: "Izin" }).click();
  await expect(staf.getByTestId("form-izin")).toBeVisible();
  await expect(staf.getByTestId("izin-kosong")).toBeVisible();
  await periksaUi(staf, "izin-staf-kosong");

  // Sakit 1 hari dengan bukti: disetujui otomatis.
  await staf.getByLabel("Sakit").check({ force: true });
  await staf.getByLabel("Mulai").fill(tanggal(1));
  await staf.getByLabel("Sampai").fill(tanggal(1));
  await expect(staf.getByTestId("lama-izin")).toContainText("1 hari");
  await staf.getByLabel("Alasan (boleh kosong)").fill("Demam");
  await staf.getByLabel(/Bukti/).setInputFiles({ name: "surat-dokter.png", mimeType: "image/png", buffer: Buffer.from(`surat uji ${nama}`) });
  await staf.getByRole("button", { name: "Ajukan" }).click();
  await expect(staf.getByTestId("hasil-izin")).toContainText("Disetujui otomatis: sakit 1 hari dengan bukti, sesuai kebijakan sakit.");

  // Sakit 3 hari: lebih dari batas, masuk Feed.
  await staf.getByLabel("Mulai").fill(tanggal(10));
  await staf.getByLabel("Sampai").fill(tanggal(12));
  await expect(staf.getByTestId("lama-izin")).toContainText("3 hari");
  await staf.getByLabel(/Bukti/).setInputFiles({ name: "surat-dokter-2.png", mimeType: "image/png", buffer: Buffer.from(`surat uji 2 ${nama}`) });
  await staf.getByRole("button", { name: "Ajukan" }).click();
  await expect(staf.getByTestId("hasil-izin")).toContainText("3 hari, lebih dari batas otomatis 1 hari");
  await staf.reload();
  await expect(staf.getByTestId("daftar-izin").getByRole("listitem")).toHaveCount(2);
  await periksaUi(staf, "izin-staf");

  // Pemilik memutuskan di Feed.
  await page.goto("/app");
  // Disaring dengan judul saja: setelah diputuskan, tombol Setujui diganti cap hasil, jadi penyaring tombol akan kehilangan kartunya.
  const kartu = page.locator("article").filter({ hasText: `Setujui sakit ${nama} 3 hari` }).last();
  await expect(kartu).toBeVisible();
  await expect(kartu).toContainText("lebih dari batas otomatis 1 hari");
  await kartu.getByRole("button", { name: "Setujui" }).click();
  await expect(kartu.getByTestId("hasil-putusan")).toBeVisible();

  await staf.reload();
  const item = staf.getByTestId("daftar-izin").getByRole("listitem").filter({ hasText: "3 hari" });
  await expect(item).toContainText("Disetujui pemilik.");

  // F1-06: pemilik membatalkan persetujuan otomatis 1 hari dari kartu Keputusan otomatis; pengajuan kembali menunggu.
  await page.goto("/app/perusahaan");
  const keputusan = page.getByTestId("daftar-keputusan").getByRole("listitem").filter({ hasText: "Disetujui otomatis: sakit 1 hari dengan bukti" }).first();
  await keputusan.getByRole("button", { name: "Batalkan" }).click();
  await keputusan.getByLabel("Alasan membatalkan").fill("Hari itu ada pesanan besar");
  await keputusan.getByRole("button", { name: "Batalkan keputusan" }).click();
  // Halaman dirender ulang: tombol diganti cap Dibatalkan dan alasan batal.
  await expect(page.getByText("Alasan batal: Hari itu ada pesanan besar").first()).toBeVisible();
  await expect(page.getByTestId("keputusan-otomatis")).toContainText("biasanya");
  await staf.reload();
  await expect(staf.getByTestId("daftar-izin").getByRole("listitem").filter({ hasText: "1 hari" })).toContainText("Persetujuan otomatis dibatalkan: Hari itu ada pesanan besar");
  await staf.context().close();
});
