import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { KATALOG_RESMI } from "../src/lib/mod/katalog";

// X-17 versi, ekspor, impor, LOKAL saja: usaha A punya fitur buatan sendiri dengan dua versi, mengembalikannya ke versi 1
// lewat Tambah fitur, lalu mengunduh berkas fiturnya; usaha B mengimpor berkas itu (jadi draf sumber Impor) dan menerapkannya.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/mod-versi-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

async function akun(nama: string) {
  const email = `versi-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: nama, p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  return { sb, email, sandi };
}

async function masuk(browser: Browser, email: string, sandi: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Ftambah-fitur");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/tambah-fitur", { timeout: 60_000 });
  return page;
}

test("versi fitur: kembalikan ke versi 1, unduh berkas, impor di usaha lain", async ({ browser }) => {
  test.setTimeout(300_000);
  const dasar = KATALOG_RESMI.find((p) => p.manifest.kode === "log-rapat")!.manifest;
  const v1 = { ...dasar, kode: "rapat-kantor", nama: "Rapat kantor", versi: "1.0.0" };
  const v2 = { ...v1, nama: "Rapat kantor dan klien", versi: "1.1.0" };
  const a = await akun("Kantor Versi A");
  for (const m of [v1, v2]) {
    const d = await a.sb.rpc("mod_draf_simpan", { p_manifest: m, p_sumber: "sendiri" });
    expect(d.error, d.error?.message).toBeNull();
    expect((await a.sb.rpc("mod_terapkan", { p_mod: (d.data as { id: string }).id })).error).toBeNull();
  }

  const pa = await masuk(browser, a.email, a.sandi);
  const riwayat = pa.getByTestId("riwayat-rapat-kantor");
  await riwayat.locator("summary").click();
  await expect(riwayat.locator("[data-versi='2']")).toContainText("(aktif)");
  const axe = await new AxeBuilder({ page: pa }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  mkdirSync(LAYAR, { recursive: true });
  await riwayat.scrollIntoViewIfNeeded();
  await pa.screenshot({ path: `${LAYAR}/riwayat-1440.png` });
  await riwayat.getByRole("button", { name: "Kembalikan ke versi 1" }).click();
  await expect.poll(async () => (await a.sb.from("mod").select("versi_aktif, nama, manifest").eq("kode", "rapat-kantor").single()).data?.versi_aktif, { timeout: 20_000 }).toBe(1);
  expect((await a.sb.from("mod").select("manifest").eq("kode", "rapat-kantor").single()).data?.manifest.nama).toBe("Rapat kantor");

  // Unduh berkas fitur (sesi pemilik A) dan pastikan isinya tanpa data usaha.
  const unduh = await pa.request.get("/app/tambah-fitur/ekspor?kode=rapat-kantor");
  expect(unduh.status()).toBe(200);
  expect(unduh.headers()["content-disposition"]).toContain('filename="nadi-fitur-rapat-kantor-v1.json"');
  const teks = await unduh.text();
  expect(JSON.parse(teks)).toMatchObject({ format: "nadi-mod", versi_format: 1, versi_fitur: 1, manifest: { kode: "rapat-kantor", nama: "Rapat kantor" } });
  expect(teks).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  expect((await pa.request.get("/app/tambah-fitur/ekspor?kode=tidak-ada")).status()).toBe(404);
  const jalur = `${LAYAR}/nadi-fitur-rapat-kantor-v1.json`;
  writeFileSync(jalur, teks);

  // Usaha B mengimpor berkas itu.
  const b = await akun("Kantor Versi B");
  expect((await b.sb.from("mod").select("id")).data ?? []).toHaveLength(0);
  const pb = await masuk(browser, b.email, b.sandi);
  const form = pb.getByRole("form", { name: "Simpan fitur buatan sendiri" });
  await form.getByLabel(/Impor berkas fitur/).setInputFiles(jalur);
  await form.getByRole("button", { name: "Periksa dan simpan draf" }).click();
  const draf = pb.locator("[data-draf='rapat-kantor']");
  await expect(draf).toContainText("Impor, fitur baru", { timeout: 20_000 });
  await draf.getByRole("button", { name: "Terapkan" }).click();
  await expect.poll(async () => (await b.sb.from("mod").select("status, sumber, versi_aktif").eq("kode", "rapat-kantor").maybeSingle()).data, { timeout: 20_000 })
    .toMatchObject({ status: "aktif", sumber: "impor", versi_aktif: 1 });
  // Berkas rusak ditolak dengan pesan jelas.
  writeFileSync(`${LAYAR}/rusak.json`, '{"format": "nadi-mod", "versi_format": 9, "manifest": {}}');
  await pb.goto("/app/tambah-fitur");
  await pb.getByRole("form", { name: "Simpan fitur buatan sendiri" }).getByLabel(/Impor berkas fitur/).setInputFiles(`${LAYAR}/rusak.json`);
  await pb.getByRole("form", { name: "Simpan fitur buatan sendiri" }).getByRole("button", { name: "Periksa dan simpan draf" }).click();
  await expect(pb.getByRole("form", { name: "Simpan fitur buatan sendiri" }).getByRole("alert")).toContainText("Versi berkas fitur tidak dikenal", { timeout: 20_000 });
});
