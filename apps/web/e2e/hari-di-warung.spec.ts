import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// DONE-01: satu hari di warung, ujung ke ujung, direkam video. Pemilik (akun uji A, Warung Uji A) membuka Feed pagi, menagih
// pelanggan lewat invoice yang dibuka pelanggan tanpa akun lalu ditandai lunas, memantau meja dengan Mata dari rekaman,
// melihat Peta usaha bergerak langsung, membaca alur nyata, dan menutup hari di Gaji. Pengunjung membuka usaha contoh dan panduan.
// Video disimpan ke E2E_VIDEO_DIR (bila diisi) atau folder hasil tes.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "mata");

test.use({ video: { mode: "on", size: { width: 1280, height: 800 } }, viewport: { width: 1280, height: 800 } });
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("satu hari di warung", async ({ page, browser }, info) => {
  test.setTimeout(900_000);
  const jam = Date.now().toString(36).slice(-5);
  const pelanggan = `Bu Sari ${jam}`;

  await test.step("pengunjung membuka usaha contoh dan panduan", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: "Coba usaha contoh" }).first().click();
    await expect(page.getByTestId("feed-demo")).toBeVisible();
    await expect(page.getByTestId("peta-usaha").getByTestId("peta-hidup")).toHaveAttribute("data-hidup", "ya", { timeout: 20_000 });
    await page.goto("/panduan");
    await expect(page.getByTestId("panduan-peran")).toHaveCount(4);
  });

  await test.step("pagi: pemilik masuk dan membuka Feed", async () => {
    await page.goto("/masuk?next=/app");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app");
    await expect(page.getByRole("heading", { name: "Hari ini" })).toBeVisible();
    await expect(page.getByTestId("nama-perusahaan")).toHaveText("Warung Uji A");
  });

  await test.step("siang: menagih pesanan arisan, pelanggan membuka tagihan, lalu lunas", async () => {
    await page.goto("/app/invoice");
    if (await page.getByTestId("bayar-belum").count()) {
      const bayar = page.getByRole("form", { name: "Tujuan bayar" });
      await bayar.getByLabel("Rekening transfer (opsional)").fill("BCA 1234567890 a.n. Warung Uji A");
      await bayar.getByRole("button", { name: "Simpan tujuan bayar" }).click();
    }
    const f = page.getByRole("form", { name: "Invoice baru" });
    await f.getByLabel("Pelanggan", { exact: true }).fill(pelanggan);
    await f.getByLabel("Uraian baris 1").fill("Nasi kotak arisan");
    await f.getByLabel("Jumlah baris 1").fill("30");
    await f.getByLabel("Harga satuan baris 1").fill("25.000");
    await expect(f.getByTestId("total-invoice")).toHaveText("Total Rp750.000");
    await f.getByRole("button", { name: "Terbitkan invoice" }).click();
    await expect(page.getByRole("form", { name: "Invoice baru" }).getByRole("status")).toContainText("Terbit:");
    const baris = page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan });
    const href = await baris.getByRole("link", { name: "Lihat halaman tagihan" }).getAttribute("href");
    const pel = await (await browser.newContext()).newPage();
    await pel.goto(href!);
    await expect(pel.getByTestId("total-tagihan")).toHaveText("Rp750.000");
    await baris.getByRole("button", { name: "Tandai lunas" }).click();
    await expect(page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan })).toContainText("lewat QRIS");
    await pel.reload();
    await expect(pel.getByTestId("tagihan-lunas")).toContainText("Sudah lunas");
    await pel.context().close();
  });

  await test.step("sore: Mata memantau meja dari rekaman", async () => {
    const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
    const zona = JSON.parse(readFileSync(join(KORPUS, "zona.json"), "utf8")) as { nama: string; jenis: string; poligon: [number, number][] }[];
    expect((await sb.rpc("simpan_zona_mata", { p_zona: zona.map((z) => ({ nama: z.nama, jenis: z.jenis, poligon: z.poligon })) })).error).toBeNull();
    await page.goto("/app/mata");
    await expect(page.getByTestId("zona-mata")).toHaveCount(3);
    await page.getByTestId("pilih-video").setInputFiles(join(KORPUS, "video.webm"));
    await page.getByTestId("mulai-pantau").click();
    await expect(page.getByTestId("mata-status")).toContainText("Video selesai dipantau.", { timeout: 600_000 });
    expect(await page.getByTestId("riwayat-mata").locator("li").count()).toBeGreaterThan(3);
  });

  await test.step("Peta usaha bergerak langsung", async () => {
    await page.goto("/app/peta-usaha");
    const peta = page.getByTestId("peta-usaha");
    await expect(peta.getByTestId("peta-hidup")).toHaveAttribute("data-hidup", "ya", { timeout: 20_000 });
    await expect(peta.getByTestId("peta-zona")).toHaveCount(3);
  });

  await test.step("malam: membaca alur nyata dan membuka gaji", async () => {
    await page.goto("/app/perusahaan");
    await expect(page.getByTestId("alur-nyata")).toBeVisible();
    await expect(page.getByTestId("alur-invoice").getByTestId("alur-ringkas")).toContainText("invoice");
    await page.goto("/app/gaji");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  const video = page.video();
  await page.close();
  if (video) {
    const dir = process.env.E2E_VIDEO_DIR ?? info.outputPath();
    mkdirSync(dir, { recursive: true });
    await video.saveAs(join(dir, "satu-hari-di-warung.webm"));
  }
});
