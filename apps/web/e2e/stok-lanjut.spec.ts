import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-02B: pemilik (akun A) membuat produk dengan harga grosir dan satu varian di layar Barang, mengisi lokasi rak, melihat laporan
// stok per gudang, lalu harga grosir terisi sendiri di formulir invoice saat jumlah mencapai tingkatnya (invoice tidak diterbitkan,
// jadi stok uji tidak berkurang). Tiap jalan menambah dua produk "Gula Grosir <tanda>" di Warung Uji A.
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

test("stok lanjutan: harga grosir, varian, lokasi rak, laporan per gudang, harga grosir di invoice", async ({ page }) => {
  test.setTimeout(150_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const nama = `Gula Grosir ${tanda}`;
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();

  await page.goto(`/masuk?next=${encodeURIComponent("/app/barang")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/barang");

  const f = page.getByRole("form", { name: "Tambah produk" });
  await f.getByLabel("Nama produk", { exact: true }).fill(nama);
  await f.getByLabel("Kode", { exact: true }).fill(`GG${tanda}`);
  await f.getByLabel("Harga jual", { exact: true }).fill("15.000");
  await f.getByLabel("Harga grosir (opsional)").fill("10:14.000, 50:13.500");
  await f.getByRole("button", { name: "Simpan produk" }).click();
  const baris = (kode: string) => page.locator(`[data-testid=baris-produk][data-kode="${kode}"]`);
  await expect(baris(`GG${tanda}`).getByTestId("grosir")).toContainText("mulai 10");
  const induk = (await sb.from("produk").select("id").eq("kode", `GG${tanda}`).single()).data!.id as string;

  const f2 = page.getByRole("form", { name: "Tambah produk" });
  await f2.getByLabel("Nama produk", { exact: true }).fill(`${nama} 5 kg`);
  await f2.getByLabel("Kode", { exact: true }).fill(`GG${tanda}-5`);
  await f2.getByLabel("Harga jual", { exact: true }).fill("72.000");
  await f2.getByLabel("Varian dari (opsional)").selectOption({ label: `GG${tanda} ${nama}` });
  await f2.getByLabel("Ciri varian").fill("ukuran: 5 kg");
  await f2.getByRole("button", { name: "Simpan produk" }).click();
  await expect(baris(`GG${tanda}-5`).getByTestId("varian")).toContainText("ukuran 5 kg");
  await expect.poll(async () => (await sb.from("produk").select("induk_id, atribut").eq("kode", `GG${tanda}-5`).single()).data, { timeout: 20_000 })
    .toMatchObject({ induk_id: induk, atribut: { ukuran: "5 kg" } });

  const gudang = (await sb.from("gudang").select("id, nama").eq("utama", true).single()).data!;
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
  expect((await sb.rpc("stok_masuk", { p_produk: induk, p_gudang: gudang.id, p_jumlah: 10, p_nilai: 120000, p_tanggal: hari, p_akun: "1-100",
    p_keterangan: "Stok uji e2e", p_batch: null, p_kunci: crypto.randomUUID() })).error).toBeNull();

  await page.goto(`/app/barang?produk=${induk}`);
  const lokasi = page.getByRole("form", { name: `Lokasi rak ${gudang.nama}` });
  await lokasi.getByLabel(`Lokasi rak (${gudang.nama})`).fill("Rak Uji 3");
  await lokasi.getByRole("button", { name: "Simpan lokasi" }).click();
  await expect.poll(async () => (await sb.from("stok").select("lokasi").eq("produk_id", induk).eq("gudang_id", gudang.id).single()).data?.lokasi, { timeout: 20_000 }).toBe("Rak Uji 3");
  await page.reload();
  await expect(page.locator(`[data-testid=laporan-gudang][data-gudang="${gudang.nama}"]`)).toContainText("Rak Uji 3");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await page.goto("/app/invoice");
  const inv = page.locator("[data-testid=baris-invoice]").first();
  await inv.getByLabel("Produk baris 1").selectOption({ label: nama });
  await expect(inv.getByLabel("Harga satuan baris 1")).toHaveValue("15000");
  await inv.getByLabel("Jumlah baris 1").fill("12");
  await expect(inv.getByLabel("Harga satuan baris 1")).toHaveValue("14000");
  await inv.getByLabel("Jumlah baris 1").fill("60");
  await expect(inv.getByLabel("Harga satuan baris 1")).toHaveValue("13500");
});
