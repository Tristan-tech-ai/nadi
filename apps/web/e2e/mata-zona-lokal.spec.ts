import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { DENAH } from "../src/lib/mata/toko-sintetis";

// Q-45, Q-46, Q-47, LOKAL saja (temuan rekaman video v2): label jenis zona sesuai jenisnya, zona Pintu yang baru disimpan langsung
// dikenali bagian Hitung kunjungan tanpa muat ulang, dan hasil hitung tetap tampil (dengan kalimat) bila belum ada kunjungan lengkap.
// Jalankan seperti e2e/alur-jeda.spec.ts (E2E_BASE_URL, E2E_LOKAL_URL, E2E_LOKAL_KUNCI). Butuh ffmpeg di PATH.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "mata-v2");
const LAYAR = "test-results/mata-zona-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("Mata: label jenis zona, zona Pintu baru langsung dikenali, hasil hitung tanpa kunjungan lengkap", async ({ page }, info) => {
  test.setTimeout(420_000);
  const email = `mata-zona-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Toko Uji Zona", p_industri: "toko" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const tanpaPintu = DENAH.zona.filter((z) => z.jenis !== "pintu").map((z) => ({ nama: z.nama, jenis: z.jenis, poligon: z.poligon }));
  expect((await sb.rpc("save_vision_zones", { p_zones: tanpaPintu })).error).toBeNull();
  expect((await sb.rpc("set_vision_notice", { p_on: true })).error).toBeNull();

  const galat: string[] = [];
  page.on("pageerror", (e) => galat.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Fmata");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/mata", { timeout: 60_000 });

  const panel = page.getByTestId("hitung-kunjungan");
  await expect(panel.getByTestId("kunjungan-perlu-pintu")).toBeVisible();
  const zona = (nama: string) => page.getByTestId("zona-mata").and(page.locator(`[data-nama="${nama}"]`));
  // Q-45: jenis selain meja dan antrean tidak lagi tertulis Rak.
  await expect(zona("Kasir")).toContainText("Kasir");
  await expect(zona("Kasir")).not.toContainText("Rak");
  await expect(zona("Balik meja")).toContainText("Pos kerja");
  await expect(zona("Lorong A")).toContainText("Lorong");

  // Gambar zona Pintu di cuplikan video, simpan.
  await page.getByLabel("Pilih berkas video").setInputFiles(join(KORPUS, "pendek.webm"));
  const layar = page.getByRole("img", { name: /Cuplikan kamera/ });
  await expect(layar).toBeVisible();
  const k = (await layar.boundingBox())!;
  for (const [x, y] of [[0.01, 0.85], [0.21, 0.85], [0.21, 0.99], [0.01, 0.99]]) await page.mouse.click(k.x + x * k.width, k.y + y * k.height);
  await page.getByLabel("Nama zona").fill("Pintu depan");
  await page.getByLabel("Jenis").selectOption("pintu");
  await page.getByRole("button", { name: "Tambah zona" }).click();
  await page.getByRole("button", { name: "Simpan zona" }).click();
  await expect(zona("Pintu depan")).toContainText("Pintu");
  await expect(zona("Pintu depan")).not.toContainText("Rak");
  // Q-46: tanpa page.reload, bagian Hitung kunjungan mengenali zona Pintu.
  await expect(panel.getByTestId("kunjungan-perlu-pintu")).toHaveCount(0, { timeout: 20_000 });
  await expect(panel.getByTestId("kunjungan-berkas")).toHaveCount(1);

  // Q-47: rekaman 1,2 detik pertama belum berisi orang yang masuk lalu keluar.
  const pendek = info.outputPath("awal.webm");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", join(KORPUS, "pendek.webm"), "-t", "1.2", "-c:v", "libvpx-vp9", "-b:v", "1M", "-an", pendek]);
  await panel.getByTestId("kunjungan-berkas").setInputFiles(pendek);
  await expect(panel.getByTestId("kunjungan-kosong")).toContainText("Belum ada orang yang masuk lalu keluar", { timeout: 240_000 });
  await expect(panel.getByTestId("kunjungan-pintu")).toBeVisible();
  await expect(panel.getByTestId("kunjungan-layar")).toBeVisible();

  mkdirSync(LAYAR, { recursive: true });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `mata ${lebar} tanpa gulir samping`).toBe(true);
      await panel.getByTestId("kunjungan-kosong").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${LAYAR}/mata-zona-${lebar}-${skema === "light" ? "terang" : "gelap"}.png` });
    }
  }
  expect(galat).toEqual([]);
});
