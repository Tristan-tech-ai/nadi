import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-19: kasir (akun B, usaha "Uji Kasir E2E") membuka shift, menjual saat peramban tanpa internet (penjualan masuk antrean HP),
// lalu internet kembali dan antrean terkirim sendiri; stok berkurang tepat, rekap harian cocok, struk publik terbuka, shift ditutup.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Kasir E2E";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("kasir: jual tanpa internet, antrean terkirim saat daring, stok dan rekap cocok", async ({ page, context }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: USAHA, p_industri: "toko" });
      expect(error).toBeNull();
      pid = data as string;
    }
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const tanda = Date.now().toString(36).toUpperCase();
    const nama = `Teh melati ${tanda}`;
    const { data: produk, error: ep } = await sb.rpc("simpan_produk", { p: { kode: `TEH${tanda}`, nama, jenis: "barang", satuan: "bks", harga_jual: 7500, boleh_minus: false, barcode: `899${tanda}` } });
    expect(ep).toBeNull();
    expect((await sb.rpc("stok_masuk", { p_produk: produk, p_gudang: null, p_jumlah: 20, p_nilai: 100000, p_tanggal: null, p_akun: "1-100",
      p_keterangan: "Stok uji kasir", p_batch: null, p_kunci: crypto.randomUUID() })).error).toBeNull();
    const stok = async () => (await sb.from("stok").select("jumlah").eq("produk_id", produk as string)).data?.reduce((s, r) => s + Number(r.jumlah), 0);
    expect(await stok()).toBe(20);
    const hari = () => new Intl.DateTimeFormat("en-CA").format(new Date());
    const awal = (await sb.rpc("pos_daily", { p_tanggal: hari() })).data as { transaksi: number; total: number };

    await page.goto(`/masuk?next=${encodeURIComponent("/app/kasir")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/kasir");
    await page.waitForLoadState("networkidle");
    const buka = page.getByRole("form", { name: "Buka shift" });
    if (await buka.isVisible()) {
      await buka.getByLabel("Kas awal di laci (Rp)").fill("100.000");
      await buka.getByRole("button", { name: "Buka shift" }).click();
    }
    await expect(page.getByTestId("kasir")).toBeVisible();
    await expect(page.getByRole("button", { name: `Tambah ${nama}` })).toBeVisible();
    await periksaUi(page, "kasir");

    // Tanpa internet: dua bungkus dari ketukan, satu dari barcode (Enter), bayar tunai.
    await context.setOffline(true);
    await expect(page.getByTestId("kasir-luring")).toBeVisible();
    await page.getByRole("button", { name: `Tambah ${nama}` }).click();
    await page.getByRole("button", { name: `Tambah ${nama}` }).click();
    await page.getByRole("textbox", { name: "Cari barang atau pindai barcode" }).fill(`899${tanda}`);
    await page.getByRole("textbox", { name: "Cari barang atau pindai barcode" }).press("Enter");
    await expect(page.getByTestId("kasir-total")).toHaveText("Rp22.500");
    await page.getByLabel("Uang diterima (Rp)").fill("20.000");
    await page.getByRole("button", { name: "Bayar", exact: true }).click();
    await expect(page.getByTestId("kasir-info")).toContainText("kurang dari total");
    await page.getByLabel("Uang diterima (Rp)").fill("50.000");
    await page.getByRole("button", { name: "Bayar", exact: true }).click();
    await expect(page.getByTestId("kasir-info")).toContainText("Kembalian Rp27.500");
    await expect(page.getByTestId("kasir-antre")).toHaveAttribute("data-jumlah", "1");
    // Kedua: QRIS satu bungkus, juga antre.
    await page.getByRole("button", { name: `Tambah ${nama}` }).click();
    await page.getByLabel("QRIS").check();
    await page.getByRole("button", { name: "Bayar", exact: true }).click();
    await expect(page.getByTestId("kasir-antre")).toHaveAttribute("data-jumlah", "2");
    expect(await stok()).toBe(20);
    await page.reload().catch(() => {});

    // Daring lagi: antrean terkirim sendiri.
    await context.setOffline(false);
    await page.goto("/app/kasir");
    await expect(page.getByTestId("kasir-antre")).toHaveCount(0, { timeout: 30_000 });
    await expect.poll(stok, { timeout: 20_000 }).toBe(16);
    const akhir = (await sb.rpc("pos_daily", { p_tanggal: hari() })).data as { transaksi: number; total: number };
    expect(akhir.transaksi - awal.transaksi).toBe(2);
    expect(akhir.total - awal.total).toBe(30000);
    const struk = page.getByTestId("kasir-struk");
    await expect(struk).toBeVisible();
    const href = (await struk.getAttribute("href"))!;
    expect(href).toMatch(/^\/struk\/[0-9A-F]{10}$/);
    await page.goto(href);
    await expect(page.getByTestId("struk-total")).toHaveText("Rp7.500");
    await expect(page.getByTestId("struk")).toContainText(nama);
    await periksaUi(page, "struk");

    await page.goto("/app/kasir");
    const tutup = page.getByRole("form", { name: "Tutup shift" });
    await tutup.getByLabel("Hasil hitung kas laci (Rp)").fill("122.500");
    await tutup.getByRole("button", { name: "Tutup shift" }).click();
    await expect(page.getByRole("form", { name: "Buka shift" })).toBeVisible();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
