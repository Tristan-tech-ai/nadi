import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { KATALOG_RESMI } from "../src/lib/mod/katalog";

// X-14 katalog paket resmi, LOKAL saja: pemilik membuka rincian paket Armada di Tambah fitur lalu memasangnya dari halaman itu;
// sepuluh paket lain dipasang lewat RPC yang sama dengan tombol Pasang (draf sumber resmi lalu terapkan); isi contoh setiap
// paket disimpan lewat mod_catatan_simpan (database memeriksa ulang setiap nilai) dengan "@" diganti data usaha uji; lalu
// setiap fitur dibuka di /app/mod/<kode> dan isi contohnya tampil. Jalankan seperti e2e/mod.spec.ts.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/katalog-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

async function periksa(page: Page, nama: string, layar = false) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${nama} ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  if (!layar) return;
  mkdirSync(LAYAR, { recursive: true });
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: `${LAYAR}/${nama}-${lebar}-${skema === "light" ? "terang" : "gelap"}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("katalog resmi: 11 paket terpasang dengan isi contoh dan tampil", async ({ page }) => {
  test.setTimeout(420_000);
  const email = `katalog-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Usaha Katalog Uji", p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const orang = await sb.from("orang").insert({ perusahaan_id: usaha.data, nama: "Sari Katalog", jenis: ["karyawan"] }).select("id").single();
  expect(orang.error, orang.error?.message).toBeNull();
  const pelanggan = await sb.rpc("save_customer", { p_id: null, p_nama: "Hotel Uji Kuta", p_jenis: "perusahaan", p_induk: null, p_hp: "081234567890", p_email: null, p_kota: "Badung", p_segmen: null });
  expect(pelanggan.error, pelanggan.error?.message).toBeNull();

  const galat: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") galat.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => galat.push(e.message.slice(0, 300)));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Ftambah-fitur");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/tambah-fitur", { timeout: 60_000 });
  await expect(page.locator("[data-paket]")).toHaveCount(KATALOG_RESMI.length, { timeout: 60_000 });

  // Rincian dan pasang dari halaman paket.
  await page.getByRole("link", { name: "Lihat rincian Armada dan kendaraan" }).click();
  await page.waitForURL((u) => u.pathname === "/app/tambah-fitur/armada");
  await expect(page.getByTestId("rincian-armada")).toContainText("Jatuh tempo pajak tahunan");
  await expect(page.getByTestId("rincian-armada")).toContainText("Biaya per kendaraan");
  await periksa(page, "rincian-armada", true);
  await page.getByRole("form", { name: "Pasang Armada dan kendaraan" }).getByRole("button", { name: "Pasang" }).click();
  await expect(page.getByRole("link", { name: "Buka Armada dan kendaraan" })).toBeVisible({ timeout: 30_000 });

  // Sepuluh paket lain lewat RPC yang sama dengan tombol Pasang.
  for (const p of KATALOG_RESMI.filter((x) => x.manifest.kode !== "armada")) {
    const draf = await sb.rpc("mod_draf_simpan", { p_manifest: p.manifest, p_sumber: "resmi" });
    expect(draf.error, `${p.manifest.kode}: ${draf.error?.message}`).toBeNull();
    const terap = await sb.rpc("mod_terapkan", { p_mod: (draf.data as { id: string }).id });
    expect(terap.error, `${p.manifest.kode}: ${terap.error?.message}`).toBeNull();
  }
  const { data: mods } = await sb.from("mod").select("id, kode, status");
  expect((mods ?? []).filter((m) => m.status === "aktif").map((m) => m.kode).sort()).toEqual(KATALOG_RESMI.map((p) => p.manifest.kode).sort());

  // Isi contoh setiap paket; "@" diganti orang, pelanggan, atau catatan koleksi rujukan yang baru dibuat.
  for (const p of KATALOG_RESMI) {
    const modId = (mods ?? []).find((m) => m.kode === p.manifest.kode)!.id as string;
    const terakhir: Record<string, string> = {};
    for (const c of p.isi_contoh) {
      const k = p.manifest.koleksi.find((x) => x.kode === c.koleksi)!;
      const data = Object.fromEntries(Object.entries(c.data).map(([kunci, v]) => {
        const b = k.bidang.find((x) => x.kode === kunci)!;
        const ganti = (x: unknown) => (x !== "@" ? x : b.tipe === "orang" ? orang.data!.id : b.tipe === "pelanggan" ? pelanggan.data : b.tipe === "rujukan" ? terakhir[b.koleksi!] : x);
        return [kunci, Array.isArray(v) ? v.map(ganti) : ganti(v)];
      }));
      const r = await sb.rpc("mod_catatan_simpan", { p_mod: modId, p_koleksi: c.koleksi, p_data: data });
      expect(r.error, `${p.manifest.kode}.${c.koleksi}: ${r.error?.message}`).toBeNull();
      terakhir[c.koleksi] = (r.data as { id: string }).id;
    }
  }

  // Setiap fitur terbuka dengan isi contohnya, tanpa pelanggaran aksesibilitas serius.
  for (const p of KATALOG_RESMI) {
    const c = p.isi_contoh[0];
    const k = p.manifest.koleksi.find((x) => x.kode === c.koleksi)!;
    await page.goto(`/app/mod/${p.manifest.kode}?k=${c.koleksi}&v=daftar`);
    await expect(page.locator(`[data-mod='${p.manifest.kode}']`)).toContainText(String(c.data[k.judul]), { timeout: 30_000 });
    await periksa(page, `mod-${p.manifest.kode}`, p.manifest.kode === "kalender-konten");
  }
  await page.goto("/app/tambah-fitur");
  await expect(page.locator("[data-paket][data-terpasang=aktif]")).toHaveCount(KATALOG_RESMI.length);
  await page.goto("/bantuan/artikel/paket-armada");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Paket Armada dan kendaraan");
  expect(galat).toEqual([]);
});
