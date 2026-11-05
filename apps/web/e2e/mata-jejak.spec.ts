import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// V-12: video CCTV demo (docs/promo/aset-demo/cctv-toko.mp4, 12 pengunjung) diputar di Mata akun A. Layar perangkat menggambar
// zona, garis lintasan, dan nomor anonim; penghitung masuk/keluar bertambah saat jejak lewat pintu. Hitungan masuk dan kunjungan
// dibandingkan dengan cctv-jawaban.json (toleransi 1). Rekap yang dikirim tetap hanya jumlah per jam.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const ASET = join(__dirname, "..", "..", "..", "docs", "promo", "aset-demo");
const kotak = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// Denah kamera atas video demo (koordinat 0..1 dari 1280x720, docs/promo/aset-demo/buat.py).
const ZONA = [
  { nama: "Pintu", jenis: "pintu", poligon: kotak(0.41, 0.84, 0.56, 1.0) },
  { nama: "Lorong", jenis: "lorong", poligon: kotak(0.3, 0.15, 0.39, 0.85) },
  { nama: "Kasir", jenis: "kasir", poligon: kotak(0.72, 0.76, 0.93, 0.9) },
  { nama: "Balik meja", jenis: "kerja", poligon: kotak(0.74, 0.54, 0.9, 0.65) },
];

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("Mata: jejak bernomor, garis, hitungan pintu, dan zona menyala dari video CCTV demo", async ({ page }) => {
  test.setTimeout(600_000);
  const benar = (JSON.parse(readFileSync(join(ASET, "cctv-jawaban.json"), "utf8")) as { kunjungan: unknown[] }).kunjungan.length;
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  expect((await sb.rpc("save_vision_zones", { p_zones: ZONA })).error).toBeNull();
  expect((await sb.rpc("set_vision_notice", { p_on: false })).error).toBeNull();

  await page.goto("/masuk?next=/app/mata");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/mata");
  const panel = page.getByTestId("hitung-kunjungan");
  await panel.getByTestId("kunjungan-papan").check();
  await panel.getByTestId("kunjungan-berkas").setInputFiles(join(ASET, "cctv-toko.mp4"));

  // Di tengah rekaman: layar tampil, ada orang terlihat dan hitungan masuk sudah bertambah.
  const layar = panel.getByTestId("kunjungan-layar");
  await expect(layar).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => Number(await panel.getByTestId("kunjungan-pintu").getAttribute("data-masuk")), { timeout: 240_000 }).toBeGreaterThanOrEqual(3);
  await layar.screenshot({ path: test.info().outputPath("layar-tengah.png") });
  // Piksel kunyit (zona menyala) atau warna jejak muncul di kanvas: bukan sekadar video mentah.
  const berwarna = await layar.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 140 && d[i + 1] < 200 && d[i + 2] < 90) n++;
    return n;
  });
  expect(berwarna, "zona menyala atau jejak kunyit tergambar").toBeGreaterThan(50);

  await expect(panel.getByTestId("kunjungan-terkirim")).toBeVisible({ timeout: 480_000 });
  const masuk = Number(await panel.getByTestId("kunjungan-pintu").getAttribute("data-masuk"));
  const keluar = Number(await panel.getByTestId("kunjungan-pintu").getAttribute("data-keluar"));
  const kunjungan = Number(await panel.getByTestId("kunjungan-hasil").getAttribute("data-kunjungan"));
  console.log(`MATA_JEJAK masuk ${masuk} keluar ${keluar} kunjungan ${kunjungan} benar ${benar}`);
  expect(Math.abs(masuk - benar)).toBeLessThanOrEqual(1);
  expect(Math.abs(kunjungan - benar)).toBeLessThanOrEqual(1);
  await layar.screenshot({ path: test.info().outputPath("layar-akhir.png") });

  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).include('[data-testid="hitung-kunjungan"]').analyze();
      expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id), `${w} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await panel.screenshot({ path: test.info().outputPath(`mata-${w}-${skema}.png`) });
    }
  }
});
