import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-07: pemilik (akun B, usaha "Uji Produksi E2E") menulis resep roti di layar, membuat satu perintah kerja, mengambil bahan,
// lalu menyelesaikannya dengan jumlah jadi sebenarnya; stok bahan turun, roti masuk senilai biaya sebenarnya, layar menyebut selisih.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Produksi E2E";

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

test("produksi: resep, satu perintah kerja dari ambil bahan sampai selesai", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: USAHA, p_industri: "produksi" });
      expect(error).toBeNull();
      pid = data as string;
    }
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const tanda = Date.now().toString(36).toUpperCase();
    const buat = async (kode: string, nama: string, satuan: string, harga: number) => {
      const { data, error } = await sb.rpc("simpan_produk", { p: { kode: `${kode}${tanda}`, nama: `${nama} ${tanda}`, jenis: "barang", satuan, harga_jual: harga } });
      expect(error).toBeNull();
      return data as string;
    };
    const tepung = await buat("TP", "Tepung", "kg", 0);
    const gula = await buat("GL", "Gula", "kg", 0);
    const roti = await buat("RT", "Roti manis", "pcs", 3000);
    for (const [p, j, n] of [[tepung, 50, 500000], [gula, 10, 150000]] as const) {
      expect((await sb.rpc("stok_masuk", { p_produk: p, p_gudang: null, p_jumlah: j, p_nilai: n, p_tanggal: null, p_akun: "1-100",
        p_keterangan: "Stok uji produksi", p_batch: null, p_kunci: crypto.randomUUID() })).error).toBeNull();
    }
    const stok = async (p: string) => (await sb.from("stok").select("jumlah, nilai").eq("produk_id", p)).data?.reduce((s, r) => ({ jumlah: s.jumlah + Number(r.jumlah), nilai: s.nilai + Number(r.nilai) }), { jumlah: 0, nilai: 0 });

    await page.goto(`/masuk?next=${encodeURIComponent("/app/produksi")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/produksi");
    await page.waitForLoadState("networkidle");

    // Resep: 10 roti dari 1 kg tepung + 0,2 kg gula, tenaga dan overhead Rp20.000 per resep.
    const r = page.getByRole("form", { name: "Resep produksi (BoM)" });
    await r.getByLabel("Barang jadi").selectOption({ label: `Roti manis ${tanda}` });
    await r.getByLabel("Jumlah hasil per resep").fill("10");
    await r.getByLabel("Biaya tenaga dan overhead per resep (Rp)").fill("20.000");
    await r.getByLabel("Bahan 1", { exact: true }).selectOption({ label: `Tepung ${tanda}` });
    await r.getByLabel("Jumlah bahan 1").fill("1");
    await r.getByRole("button", { name: "Tambah bahan" }).click();
    await r.getByLabel("Bahan 2", { exact: true }).selectOption({ label: `Gula ${tanda}` });
    await r.getByLabel("Jumlah bahan 2").fill("0,2");
    await r.getByRole("button", { name: "Simpan resep" }).click();
    await expect(page.getByTestId("daftar-bom")).toContainText(`Roti manis ${tanda}`);

    // Perintah kerja 100 roti: butuh 10 kg tepung + 2 kg gula; standar (10.000 + 0,2 x 15.000 + 20.000) / 10 = 3.300.
    const f = page.getByRole("form", { name: "Perintah kerja baru" });
    await f.getByLabel("Barang jadi").selectOption({ label: `Roti manis ${tanda}` });
    await f.getByLabel("Jumlah yang dibuat").fill("100");
    await f.getByRole("button", { name: "Buat perintah kerja" }).click();
    const pk = page.getByTestId("pk").filter({ hasText: `Roti manis ${tanda}` }).first();
    await expect(pk).toHaveAttribute("data-status", "planned");
    await expect(pk).toContainText(`Tepung ${tanda} 10 kg`);
    await periksaUi(page, "produksi");
    await pk.getByRole("button", { name: "Ambil bahan" }).click();
    await expect(pk).toHaveAttribute("data-status", "running", { timeout: 20_000 });
    await expect.poll(async () => (await stok(tepung))?.jumlah, { timeout: 20_000 }).toBe(40);
    expect((await stok(gula))?.jumlah).toBe(8);
    await pk.getByLabel("Jumlah jadi sebenarnya").fill("98");
    await pk.getByRole("button", { name: "Selesai" }).click();
    await expect(pk).toHaveAttribute("data-status", "done", { timeout: 20_000 });
    // Biaya sebenarnya: bahan 100.000 + 30.000 + konversi 200.000 = 330.000; standar 3.300 x 98 = 323.400; selisih 6.600.
    await expect(pk.getByTestId("pk-biaya")).toContainText("Biaya Rp330.000");
    await expect(pk.getByTestId("pk-biaya")).toContainText("Selisih terhadap standar Rp6.600");
    await expect.poll(async () => await stok(roti), { timeout: 20_000 }).toEqual({ jumlah: 98, nilai: 330000 });
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
