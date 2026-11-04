import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-04: pemilik (akun A) menjalankan alur pembelian di layar, angkanya sama dengan tes SQL siklus_beli:
// - PO 10 gula @1.200 + ongkos 20.000 (32.000), terima barang (stok masuk 12.000);
// - tagihan pemasok 33.000 dari penerimaan (selisih Rp1.000 dari PO), bayar sebagian 10.000;
// - retur 2 gula @1.200 (nota debit 2.400), bayar sisa 20.600, tagihan lunas.
// Tiap jalan menambah satu produk "Gula Beli <tanda>" di Warung Uji A; tagihan uji berakhir lunas.
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

test("siklus pembelian: PO, terima barang, tagihan cocok PO, bayar sebagian, retur, lunas", async ({ page }) => {
  test.setTimeout(180_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const pemasok = `Pemasok Beli ${tanda}`;
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const produk = await sb.rpc("simpan_produk", { p: { kode: `GB${tanda}`, nama: `Gula Beli ${tanda}`, harga_jual: 2500 } });
  expect(produk.error).toBeNull();

  await page.goto(`/masuk?next=${encodeURIComponent("/app/beli")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/beli");

  const f = page.getByRole("form", { name: "Permintaan atau pesanan pembelian baru" });
  await f.getByLabel("Pemasok", { exact: true }).fill(pemasok);
  await f.getByLabel("Produk baris 1").selectOption({ label: `Gula Beli ${tanda}` });
  await expect(f.getByLabel("Uraian baris 1")).toHaveValue(`Gula Beli ${tanda}`);
  await f.getByLabel("Jumlah baris 1").fill("10");
  await f.getByLabel("Harga satuan baris 1").fill("1.200");
  await f.getByRole("button", { name: "Tambah baris" }).click();
  await f.getByLabel("Uraian baris 2").fill("Ongkos kirim");
  await f.getByLabel("Harga satuan baris 2").fill("20.000");
  await f.getByRole("button", { name: "Terbitkan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "/PO/" })).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  const dok = (jenis: string) => page.locator(`[data-testid=baris-dokumen-beli][data-jenis=${jenis}][data-pemasok="${pemasok}"]`);
  await dok("pesanan_beli").getByRole("button", { name: "Terima barang" }).click();
  await expect(dok("penerimaan")).toBeVisible();
  await expect.poll(async () => (await sb.from("stok").select("jumlah, nilai").eq("produk_id", produk.data as string)).data?.[0], { timeout: 20_000 })
    .toMatchObject({ jumlah: 10, nilai: 12000 });

  const tg = dok("penerimaan").getByRole("form", { name: "Catat tagihan pemasok untuk penerimaan ini" });
  await tg.getByLabel("Nomor tagihan pemasok").fill(`INV-${tanda}`);
  await tg.getByLabel("Total tagihan").fill("33.000");
  await tg.getByRole("button", { name: "Catat tagihan" }).click();
  const tagihan = async () => (await sb.from("tagihan_beli").select("id, total, terbayar, dikurangi, selisih, status").eq("pemasok", pemasok)).data?.[0];
  await expect.poll(tagihan, { timeout: 20_000 }).toMatchObject({ total: 33000, selisih: 1000, status: "terbuka" });

  await page.reload();
  const baris = page.locator(`[data-testid=baris-tagihan-beli][data-pemasok="${pemasok}"]`);
  await expect(baris).toContainText("Rp1.000");
  await baris.getByLabel("Jumlah dibayar", { exact: true }).fill("10.000");
  await baris.getByRole("button", { name: "Catat pembayaran" }).click();
  await expect.poll(tagihan, { timeout: 20_000 }).toMatchObject({ terbayar: 10000 });

  await page.reload();
  await baris.getByText("Retur ke pemasok (nota debit)").click();
  await baris.getByLabel("Jumlah retur").fill("2");
  await baris.getByLabel("Alasan retur").fill("Dua bungkus sobek");
  await baris.getByRole("button", { name: "Catat retur" }).click();
  await expect.poll(tagihan, { timeout: 20_000 }).toMatchObject({ dikurangi: 2400 });
  await expect.poll(async () => (await sb.from("stok").select("jumlah, nilai").eq("produk_id", produk.data as string)).data?.[0], { timeout: 20_000 })
    .toMatchObject({ jumlah: 8, nilai: 9600 });

  await page.reload();
  await expect(baris.getByLabel("Jumlah dibayar", { exact: true })).toHaveValue("20600");
  await baris.getByRole("button", { name: "Catat pembayaran" }).click();
  await expect.poll(tagihan, { timeout: 20_000 }).toMatchObject({ terbayar: 30600, status: "lunas" });
  await page.reload();
  await expect(baris).toHaveCount(0);
});
