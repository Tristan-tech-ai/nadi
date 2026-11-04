import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// M-02: pemilik (akun A) menambah produk baru (kode unik per jalan), mencatat stok masuk 10 pcs senilai 50.000, menerbitkan invoice
// 3 pcs dengan memilih produk (uraian dan harga terisi sendiri), lalu melihat stok tinggal 7 dan kartu stok berisi baris keluar.
// Invoice dibatalkan di akhir: stok kembali 10 (data uji sintetis tidak menumpuk piutang).
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

test("produk, stok masuk, invoice berproduk mengurangi stok, batal mengembalikan", async ({ page }) => {
  test.setTimeout(150_000);
  const kode = `E2E-${Date.now().toString(36).toUpperCase()}`;
  const nama = `Gula uji ${kode}`;
  const pelanggan = `Pelanggan Stok ${kode}`;
  await page.goto(`/masuk?next=${encodeURIComponent("/app/barang")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/barang");

  const fp = page.getByRole("form", { name: "Tambah produk" });
  await fp.getByLabel("Nama produk").fill(nama);
  await fp.getByLabel("Kode", { exact: true }).fill(kode);
  await fp.getByLabel("Harga jual").fill("7.500");
  await fp.getByRole("button", { name: "Simpan produk" }).click();
  const baris = page.getByTestId("baris-produk").filter({ hasText: nama });
  await expect(baris).toBeVisible();

  const fm = page.getByRole("form", { name: "Stok masuk" });
  await fm.getByLabel("Produk").selectOption({ label: `${kode} ${nama}` });
  await fm.getByLabel("Jumlah").fill("10");
  await fm.getByLabel("Biaya total").fill("50.000");
  await fm.getByRole("button", { name: "Catat stok masuk" }).click();
  await expect(fm.getByRole("status")).toContainText("Stok masuk tercatat");
  await expect(baris.getByTestId("stok-produk")).toContainText("10");
  await periksaUi(page, "barang");

  await page.goto("/app/invoice");
  const fi = page.getByRole("form", { name: "Invoice baru" });
  await fi.getByLabel("Pelanggan", { exact: true }).fill(pelanggan);
  await fi.getByLabel("Produk baris 1").selectOption({ label: nama });
  await expect(fi.getByLabel("Uraian baris 1")).toHaveValue(nama);
  await fi.getByLabel("Jumlah baris 1").fill("3");
  await expect(fi.getByTestId("total-invoice")).toHaveText("Total Rp22.500");
  await fi.getByRole("button", { name: "Terbitkan invoice" }).click();
  await expect(page.getByRole("form", { name: "Invoice baru" }).getByRole("status")).toContainText("Terbit:");

  await page.goto("/app/barang");
  await expect(page.getByTestId("baris-produk").filter({ hasText: nama }).getByTestId("stok-produk")).toContainText("7");
  await page.getByRole("link", { name: nama }).click();
  await expect(page.getByTestId("kartu-stok")).toContainText("Keluar");
  await expect(page.getByTestId("kartu-stok")).toContainText("-3");

  await page.goto("/app/invoice");
  const inv = page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan });
  await inv.getByText("Batalkan invoice").click();
  await inv.getByLabel("Alasan").fill("Uji stok selesai");
  await inv.getByRole("button", { name: "Batalkan" }).click();
  // Teks "Batalkan invoice" sudah ada sebelum batal, jadi tunggu akibatnya: stok kembali 10.
  await expect.poll(async () => {
    await page.goto("/app/barang");
    return (await page.getByTestId("baris-produk").filter({ hasText: nama }).getByTestId("stok-produk").textContent())?.trim();
  }, { timeout: 30_000 }).toBe("10 pcs");
});
