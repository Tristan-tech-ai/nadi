import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { paketResmi } from "../src/lib/mod/katalog";

// X-18 laporan dari kerja, proyek, dan fitur tambahan, LOKAL saja: Wawasan meringkas catatan fitur tambahan, laporan dari koleksi
// mod menampilkan nama orang (bukan ID), CSV menetralkan isi yang mirip rumus, dan sumber kerja tampil. Jalankan seperti e2e/mod.spec.ts.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("laporan: ringkasan fitur tambahan, laporan koleksi mod dengan nama orang, CSV aman, sumber kerja", async ({ page }) => {
  test.setTimeout(240_000);
  const email = `laporan-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Kantor Laporan Uji", p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const orang = await sb.from("orang").insert({ perusahaan_id: usaha.data, nama: "Sari Laporan", jenis: ["karyawan"] }).select("id").single();
  const draf = await sb.rpc("mod_draf_simpan", { p_manifest: paketResmi("log-rapat")!.manifest, p_sumber: "resmi" });
  const mod = (draf.data as { id: string }).id;
  expect((await sb.rpc("mod_terapkan", { p_mod: mod })).error).toBeNull();
  for (const judul of ["Rapat awal klien", '=HYPERLINK("http://contoh.test","klik")']) {
    const r = await sb.rpc("mod_catatan_simpan", { p_mod: mod, p_koleksi: "catatan", p_data: { judul, jenis: "rapat_klien", waktu: "2026-11-20T10:00:00+08:00", ringkasan: "Ringkasan uji.", peserta: [orang.data!.id] } });
    expect(r.error, r.error?.message).toBeNull();
  }
  expect((await sb.rpc("buat_kerja", { p_judul: "Susun proposal laporan", p_topi: null, p_pelaksana: orang.data!.id, p_tenggat: null, p_kunci: null })).error).toBeNull();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Fwawasan");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/wawasan", { timeout: 60_000 });
  const ringkas = page.locator("[data-ws-mod='mod:log-rapat:catatan']");
  await expect(ringkas).toContainText("2 catatan", { timeout: 30_000 });

  await page.goto("/app/wawasan?sumber=mod%3Alog-rapat%3Acatatan");
  await expect(page.getByTestId("ws-baris")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Pratinjau laporan" })).toContainText("Sari Laporan");
  await expect(page.getByRole("region", { name: "Pratinjau laporan" })).not.toContainText(orang.data!.id);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);

  const csv = await (await page.request.get("/app/wawasan/ekspor?sumber=mod%3Alog-rapat%3Acatatan")).text();
  expect(csv).toContain("Sari Laporan");
  expect(csv).toContain(`"'=HYPERLINK(`);
  expect(csv).not.toMatch(/(^|;)=HYPERLINK/m);

  await page.goto("/app/wawasan?sumber=kerja");
  await expect(page.getByRole("region", { name: "Pratinjau laporan" })).toContainText("Susun proposal laporan", { timeout: 30_000 });
});
