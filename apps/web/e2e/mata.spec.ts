import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F5-01: Mata di peramban. Pemilik (akun uji A, Warung Uji A) memakai video korpus (fixtures/korpus/mata/video.webm, 60 cuplikan
// x 2 detik, 3 zona meja). Model berjalan di worker peramban; akurasi status meja dihitung dari riwayat perubahan di layar terhadap
// jawaban.json dan harus >= 85%. Database hanya menerima perubahan status (mata_keadaan), tanpa gambar.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "mata");
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));
type Jawaban = { cuplikan: number; detik: number; status: Record<string, "kosong" | "terisi"> };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("Mata: video korpus, status meja benar >= 85%, hanya perubahan status yang tersimpan", async ({ page }) => {
  test.setTimeout(900_000);
  const zona = JSON.parse(readFileSync(join(KORPUS, "zona.json"), "utf8")) as { id: string; nama: string; jenis: string; poligon: [number, number][] }[];
  const jawaban = JSON.parse(readFileSync(join(KORPUS, "jawaban.json"), "utf8")) as Jawaban[];
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const simpan = await sb.rpc("simpan_zona_mata", { p_zona: zona.map((z) => ({ nama: z.nama, jenis: z.jenis, poligon: z.poligon })) });
  expect(simpan.error).toBeNull();

  await page.goto("/masuk?next=/app/mata");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/mata");
  await expect(page.getByTestId("mata-kosong")).toBeVisible();
  await expect(page.getByTestId("zona-mata")).toHaveCount(3);

  await page.getByTestId("pilih-video").setInputFiles(join(KORPUS, "video.webm"));
  const layar = page.getByTestId("layar-mata");
  await expect(layar).toBeVisible();

  // Editor zona: tiga klik + nama membentuk zona baru; dihapus lagi supaya korpus tetap 3 zona.
  const kotak = (await layar.boundingBox())!;
  for (const [x, y] of [[0.05, 0.05], [0.2, 0.05], [0.2, 0.2]]) await layar.click({ position: { x: kotak.width * x, y: kotak.height * y } });
  await page.getByLabel("Nama zona").fill("Zona coba");
  await page.getByRole("button", { name: "Tambah zona" }).click();
  await expect(page.getByTestId("zona-mata")).toHaveCount(4);
  await page.getByRole("button", { name: "Hapus zona Zona coba" }).click();
  await expect(page.getByTestId("zona-mata")).toHaveCount(3);
  await page.getByRole("button", { name: "Simpan zona" }).click();
  await expect(page.getByTestId("mata-status")).toContainText("3 zona siap dipantau");

  await page.getByTestId("mulai-pantau").click();
  await expect(page.getByTestId("mata-status")).toContainText("Video selesai dipantau.", { timeout: 840_000 });

  // Status per cuplikan direkonstruksi dari riwayat perubahan (detik video) lalu dibandingkan dengan jawaban.
  const riwayat = await page.getByTestId("riwayat-mata").locator("li").evaluateAll((li) =>
    li.map((x) => ({ detik: Number(x.getAttribute("data-detik")), zona: x.getAttribute("data-zona")!, status: x.getAttribute("data-status")! })));
  let benar = 0;
  let total = 0;
  for (const j of jawaban) {
    const t = j.detik + 1;
    for (const z of zona) {
      const akhir = riwayat.filter((r) => r.zona === z.nama && r.detik <= t).sort((a, b) => b.detik - a.detik)[0];
      if ((akhir?.status ?? "kosong") === j.status[z.id]) benar++;
      total++;
    }
  }
  console.log(`akurasi Mata di peramban: ${((benar / total) * 100).toFixed(1)}% (${benar}/${total}), ${riwayat.length} perubahan`);
  expect(benar / total).toBeGreaterThanOrEqual(0.85);

  const keadaan = await sb.rpc("mata_keadaan");
  expect(keadaan.error).toBeNull();
  const tersimpan = keadaan.data as { nama: string; status: string | null }[];
  for (const z of zona) {
    const layarStatus = await page.getByTestId("zona-mata").filter({ hasText: z.nama }).getAttribute("data-status");
    expect(tersimpan.find((x) => x.nama === z.nama)?.status ?? "", z.nama).toBe(layarStatus);
  }

  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(lebar);
      await page.screenshot({ path: foto(`mata-${lebar}-${skema}.png`), fullPage: true });
    }
  }
});
