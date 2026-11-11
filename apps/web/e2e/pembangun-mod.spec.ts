import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// X-16 pembangun fitur tanpa JSON, LOKAL saja: pemilik menyusun fitur Jadwal piket (3 isian: teks, orang, tanggal; status Belum,
// Selesai) lewat formulir, rancangan belum lengkap dijelaskan dulu, draf tersimpan lolos pemeriksaan, diterapkan, lalu dipakai
// untuk mencatat satu piket. Jalankan seperti e2e/mod.spec.ts.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/pembangun-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("pembangun mod: susun 3 isian lewat formulir, terapkan, lalu pakai", async ({ page }) => {
  test.setTimeout(240_000);
  const email = `susun-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Toko Susun Fitur", p_industri: "toko" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  expect((await sb.from("orang").insert({ perusahaan_id: usaha.data, nama: "Sari Piket", jenis: ["karyawan"] })).error).toBeNull();

  const galat: string[] = [];
  page.on("pageerror", (e) => galat.push(e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") galat.push(m.text().slice(0, 200)); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Ftambah-fitur");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/tambah-fitur", { timeout: 60_000 });
  await page.getByRole("link", { name: "Susun lewat formulir, tanpa menulis JSON" }).click();
  await page.waitForURL((u) => u.pathname === "/app/tambah-fitur/buat");
  const form = page.getByRole("form", { name: "Susun fitur lewat formulir" });

  // Rancangan kosong dijelaskan dulu, tidak dikirim.
  await form.getByRole("button", { name: "Periksa dan simpan draf" }).click();
  await expect(page.getByTestId("masalah-rancangan")).toContainText("Nama fitur minimal 3 huruf.");

  await form.getByLabel("Nama fitur").fill("Jadwal piket");
  await form.getByLabel("Masuk ke ruang").selectOption({ label: "Tempat" });
  const bagian = page.getByTestId("bagian-1");
  await bagian.getByLabel("Nama bagian").fill("Piket");
  await bagian.getByLabel(/Tahap status/).fill("Belum, Selesai");
  await bagian.getByLabel("Isian 1", { exact: true }).fill("Nama tugas");
  await bagian.getByRole("button", { name: "Tambah isian di bagian 1" }).click();
  await bagian.getByLabel("Isian 2", { exact: true }).fill("Petugas");
  await bagian.getByLabel("Jenis isian 2").selectOption({ label: "Orang di usaha" });
  await bagian.getByRole("button", { name: "Tambah isian di bagian 1" }).click();
  await bagian.getByLabel("Isian 3", { exact: true }).fill("Tanggal");
  await bagian.getByLabel("Jenis isian 3").selectOption({ label: "Tanggal" });
  await page.getByText("Lihat isi fitur (manifest)").click();
  await expect(page.getByTestId("pratinjau-manifest")).toContainText('"kode": "jadwal-piket"');
  await expect(page.getByTestId("pratinjau-manifest")).toContainText('"penugasan": true');

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  mkdirSync(LAYAR, { recursive: true });
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: `${LAYAR}/susun-${lebar}-${skema === "light" ? "terang" : "gelap"}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });

  await form.getByRole("button", { name: "Periksa dan simpan draf" }).click();
  await expect(page.getByTestId("pembangun-tersimpan")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Buka draf di Tambah fitur" }).click();
  const draf = page.locator("[data-draf='jadwal-piket']");
  await expect(draf).toContainText("Buatan sendiri, fitur baru", { timeout: 20_000 });
  await draf.getByRole("button", { name: "Terapkan" }).click();
  await expect.poll(async () => (await sb.from("mod").select("status").eq("kode", "jadwal-piket").maybeSingle()).data?.status, { timeout: 20_000 }).toBe("aktif");

  // Dipakai: catat satu piket lalu tandai selesai.
  await page.goto("/app/mod/jadwal-piket");
  const tambah = page.getByTestId("tambah-catatan");
  if (!(await tambah.evaluate((d) => (d as HTMLDetailsElement).open))) await tambah.locator("summary").click();
  const isi = tambah.getByRole("form", { name: "Simpan piket" });
  await isi.getByLabel("Nama tugas").fill("Sapu lantai depan");
  await isi.getByLabel("Petugas").selectOption({ label: "Sari Piket" });
  await isi.getByLabel("Tanggal").fill("2026-11-20");
  await isi.getByRole("button", { name: "Simpan piket" }).click();
  await expect(page.getByTestId("jumlah-catatan")).toContainText("1 catatan", { timeout: 20_000 });
  await expect(page.locator("[data-mod='jadwal-piket']")).toContainText("Sapu lantai depan");
  const rec = await sb.from("mod_record").select("status, ditugaskan").limit(1).single();
  expect(rec.data?.status).toBe("belum");
  expect(rec.data?.ditugaskan).toHaveLength(1);
  expect(galat).toEqual([]);
});
