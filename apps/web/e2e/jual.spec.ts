import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-03: pemilik (akun A) menjalankan alur penjualan di layar. Langkahnya:
// - penawaran 2 x jasa 50.000 (tanpa produk, stok tidak tersentuh), lalu jadikan pesanan;
// - uang muka 30.000, surat jalan, invoice 100% (sisa 70.000);
// - di Invoice: retur 1 baris (nota kredit 50.000, sisa 20.000), lalu lunas dipotong PPh 23 400.
// Cetak penawaran dan pro forma diperiksa. Semua dokumen uji berakhir lunas, jadi piutang uji tidak menumpuk.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("siklus penjualan: penawaran, pesanan, uang muka, surat jalan, invoice, retur, lunas dipotong PPh", async ({ page }) => {
  test.setTimeout(180_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const pelanggan = `Pelanggan Jual ${tanda}`;
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  await page.goto(`/masuk?next=${encodeURIComponent("/app/jual")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/jual");

  const f = page.getByRole("form", { name: "Penawaran atau pesanan baru" });
  await f.getByLabel("Pelanggan", { exact: true }).fill(pelanggan);
  await f.getByLabel("Uraian baris 1").fill("Jasa pasang rak");
  await f.getByLabel("Jumlah baris 1").fill("2");
  await f.getByLabel("Harga satuan baris 1").fill("50.000");
  await f.getByRole("button", { name: "Terbitkan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "/PNW/" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  const baris = (jenis: string) => page.locator(`[data-testid=baris-dokumen-jual][data-jenis=${jenis}][data-pelanggan="${pelanggan}"]`);
  const href = await baris("penawaran").getByRole("link", { name: "Cetak pro forma" }).getAttribute("href");
  await baris("penawaran").getByRole("button", { name: "Jadikan pesanan" }).click();
  await expect(baris("pesanan")).toBeVisible();
  await baris("pesanan").getByLabel("Uang muka", { exact: true }).fill("30.000");
  await baris("pesanan").getByRole("button", { name: "Catat uang muka" }).click();
  await expect(baris("pesanan")).toContainText("Rp30.000");
  await baris("pesanan").getByRole("button", { name: "Buat surat jalan" }).click();
  await expect(baris("surat_jalan")).toBeVisible();
  await baris("surat_jalan").getByRole("button", { name: "Buat invoice" }).click();
  await expect.poll(async () => (await sb.from("invoice").select("id, total, potong_piutang").eq("pelanggan", pelanggan)).data?.[0]?.potong_piutang, { timeout: 20_000 }).toBe(30000);

  const pro = await page.context().newPage();
  await pro.goto(href!);
  await expect(pro.getByTestId("lembar-jual")).toContainText("Pro forma invoice");
  await expect(pro.getByTestId("lembar-jual")).toContainText("Rp100.000");
  await pro.close();

  await page.goto("/app/invoice");
  const inv = page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan });
  await inv.getByText("Retur barang (nota kredit)").click();
  await inv.getByLabel("Jumlah retur").fill("1");
  await inv.getByLabel("Alasan retur").fill("Satu rak batal dipasang");
  await inv.getByRole("button", { name: "Catat retur" }).click();
  await expect.poll(async () => (await sb.from("invoice").select("potong_piutang").eq("pelanggan", pelanggan)).data?.[0]?.potong_piutang, { timeout: 20_000 }).toBe(80000);
  await page.reload();
  const inv2 = page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan });
  await inv2.getByLabel("Dipotong PPh pembeli (opsional)").fill("400");
  await inv2.getByRole("button", { name: "Tandai lunas" }).click();
  await expect.poll(async () => (await sb.from("invoice").select("status, pph_dipotong, pph_jenis").eq("pelanggan", pelanggan)).data?.[0], { timeout: 20_000 })
    .toMatchObject({ status: "lunas", pph_dipotong: 400, pph_jenis: "pph23" });
});
