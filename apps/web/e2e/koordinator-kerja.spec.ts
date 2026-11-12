import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";

// X-13B, LOKAL saja: staf dengan peran kustom kerja.kelola (koordinator) melihat formulir Tambah kerja dan papan pengelola di
// /app/kerja, memilih rekan dari daftar nama (RPC kelola_kerja_saya, bukan RLS orang), lalu membuat kerja untuk rekan; staf tanpa
// izin tetap melihat papan pribadinya saja. Jalankan seperti e2e/mod.spec.ts (E2E_BASE_URL, E2E_LOKAL_URL, E2E_LOKAL_KUNCI).
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/koordinator-layar";
const PIN = "246813";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

async function masukStaf(browser: Browser, kode: string, id: string): Promise<Page> {
  const p = await (await browser.newContext()).newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto("/masuk/staf");
  await p.getByLabel("Kode usaha").fill(kode);
  await p.getByLabel("ID kamu").fill(id);
  await p.getByLabel("PIN").fill(PIN);
  await p.getByRole("button", { name: "Masuk" }).click();
  await expect(p.getByTestId("peran")).toContainText("staf", { timeout: 60_000 });
  return p;
}

async function periksa(page: Page, nama: string) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  mkdirSync(LAYAR, { recursive: true });
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: `${LAYAR}/${nama}-${lebar}-${skema === "light" ? "terang" : "gelap"}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("koordinator kerja: peran kustom kerja.kelola membuka Tambah kerja dan papan pengelola, staf biasa tidak", async ({ browser }) => {
  test.setTimeout(300_000);
  const email = `koordinator-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: randomBytes(18).toString("base64url") })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Agensi Koordinator", p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const orang = await sb.from("orang").insert([
    { perusahaan_id: usaha.data, nama: "Rina Koordinator", jenis: ["karyawan"], status: "aktif" },
    { perusahaan_id: usaha.data, nama: "Budi Desain", jenis: ["karyawan"], status: "aktif" },
  ]).select("id, nama");
  expect(orang.error, orang.error?.message).toBeNull();
  const rina = orang.data!.find((o) => o.nama === "Rina Koordinator")!.id as string;
  const budi = orang.data!.find((o) => o.nama === "Budi Desain")!.id as string;
  for (const o of [rina, budi]) expect((await sb.rpc("buat_akun_staf", { p_orang: o, p_pin: PIN })).error).toBeNull();
  const idStaf = async (o: string) => (await sb.from("orang").select("id_staf, user_id").eq("id", o).single()).data!;
  const kode = (await sb.from("perusahaan").select("kode").eq("id", usaha.data).single()).data!.kode as string;
  const rinaAkun = await idStaf(rina);
  const budiAkun = await idStaf(budi);
  const peran = await sb.rpc("save_custom_role", { p_id: null, p_nama: "Koordinator kerja", p_izin: ["kerja.kelola"] });
  expect(peran.error, peran.error?.message).toBeNull();
  expect((await sb.rpc("assign_custom_role", { p_user: rinaAkun.user_id, p_role: peran.data })).error).toBeNull();

  // Staf tanpa izin: papan pribadi, tanpa formulir Tambah kerja.
  const staf = await masukStaf(browser, kode, budiAkun.id_staf as string);
  await staf.goto("/app/kerja");
  await expect(staf.getByTestId("kerja-aktif").or(staf.getByText("Belum ada kerja", { exact: false })).first()).toBeVisible({ timeout: 60_000 });
  await expect(staf.getByRole("button", { name: "Tambah kerja" })).toHaveCount(0);

  // Koordinator: formulir Tambah kerja dengan nama rekan, lalu kerja tampil di papan pengelola.
  const koor = await masukStaf(browser, kode, rinaAkun.id_staf as string);
  const galat: string[] = [];
  koor.on("pageerror", (e) => galat.push(e.message));
  await koor.goto("/app/kerja");
  await expect(koor.getByTestId("ringkasan-kerja")).toBeVisible({ timeout: 60_000 });
  await koor.getByRole("button", { name: "Tambah kerja" }).click();
  const form = koor.getByRole("form", { name: "Tambah kerja" });
  await form.getByLabel("Judul kerja").fill("Siapkan materi presentasi klien");
  await form.getByLabel("Pelaksana (boleh kosong)").selectOption({ label: "Budi Desain" });
  await form.getByRole("button", { name: "Simpan kerja" }).click();
  const kartu = koor.locator("[data-testid=kartu-kerja][data-judul='Siapkan materi presentasi klien']");
  await expect(kartu).toBeVisible({ timeout: 30_000 });
  // Nama pelaksana tampil di kartu (bukan hanya di pilihan tim), walau RLS orang menutup baris Budi untuk koordinator.
  await expect(kartu.locator("p").filter({ hasText: "Tanpa topi" })).toContainText("Budi Desain");
  // Koordinator boleh mengatur tim, tetapi mengubah poin tetap khusus pemilik/admin.
  await kartu.getByTestId("tim-checklist").locator("summary").click();
  await expect(kartu.getByRole("form").filter({ hasText: "Simpan tim" }).first()).toBeVisible();
  await expect(kartu.getByText("Ubah poin", { exact: true })).toHaveCount(0);
  await periksa(koor, "kerja-koordinator");
  expect(galat).toEqual([]);

  // Kerja yang dibuat koordinator tersimpan untuk Budi.
  const k = await sb.from("kerja").select("judul, pelaksana_id").eq("judul", "Siapkan materi presentasi klien").single();
  expect(k.data?.pelaksana_id).toBe(budi);
});
