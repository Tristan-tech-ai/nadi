import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// L-01: halaman publik. Setiap halaman punya satu tujuan (ajakan ke /demo atau /daftar), ilustrasi tidak lepas dari bingkainya
// (temuan L-01: .gambar-baca tanpa position relative membuat gambar harga/panduan melayang menutupi judul), fitur yang tampil di
// film demo memutar rekaman layar Nadi asli, dan semuanya lolos axe tanpa gulir samping di 390/1440 terang/gelap.
const FITUR = ["lempar", "feed", "absen", "gaji", "tagihan", "jadwal", "mata", "rekrut", "pajak"];
const KLIP = ["lempar", "feed", "tagihan", "gaji", "mata"];
const INFO = ["/harga", "/panduan", "/keamanan", "/tentang"];
const HALAMAN = ["/", "/en", ...FITUR.map((f) => `/fitur/${f}`), ...INFO, "/en/harga", "/en/keamanan"];

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali, desktop mengatur ukuran sendiri");
});

test("ilustrasi tetap di dalam bingkainya, ajakan akhir, axe, tanpa gulir samping", async ({ browser }) => {
  test.setTimeout(600_000);
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: skema, reducedMotion: "reduce", locale: "id-ID" });
      const page = await ctx.newPage();
      for (const jalur of HALAMAN) {
        const label = `${jalur} ${w} ${skema}`;
        await page.goto(jalur, { waitUntil: "networkidle" });
        // Isi pertama setiap bingkai ilustrasi harus berpusat di dalam bingkai itu.
        const lepas = await page.evaluate(() => [...document.querySelectorAll(".gambar-baca, .visual-fitur")].flatMap((b) => {
          const r = b.getBoundingClientRect();
          const c = b.firstElementChild?.getBoundingClientRect();
          if (!c || !r.width) return [];
          const x = c.left + c.width / 2;
          const y = c.top + c.height / 2;
          return x < r.left || x > r.right || y < r.top || y > r.bottom ? [`${b.className} ${Math.round(r.top)}`] : [];
        }));
        expect(lepas, label).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), label).toBe(true);
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id), label).toEqual([]);
        if (INFO.includes(jalur)) {
          const a = page.getByTestId("ajakan-akhir");
          await expect(a.locator('a[href="/demo"]'), label).toBeVisible();
          await expect(a.locator('a[href="/daftar"]'), label).toBeVisible();
        }
        if (w === 1440 && skema === "light") await page.screenshot({ path: test.info().outputPath(`${jalur.replace(/\//g, "_") || "_"}-1440.png`), fullPage: true });
      }
      await ctx.close();
    }
  }
});

test("rekaman layar asli: film di landing, potongan per fitur, gerak dikurangi tidak memutar sendiri", async ({ browser, request }) => {
  test.setTimeout(180_000);
  for (const n of ["nadi-demo", ...KLIP]) {
    for (const ext of ["mp4", "jpg"]) {
      const r = await request.head(`/video/${n}.${ext}`);
      expect(r.status(), `${n}.${ext}`).toBe(200);
      expect(r.headers()["content-type"], `${n}.${ext}`).toContain(ext === "mp4" ? "video/mp4" : "image/jpeg");
    }
  }
  const biasa = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await biasa.newPage();
  await p.goto("/");
  const film = p.getByTestId("film-nadi").locator("video");
  await expect(film).toHaveAttribute("preload", "none");
  await expect(film).toHaveAttribute("controls", "");
  for (const f of FITUR) {
    await p.goto(`/fitur/${f}`);
    await expect(p.getByTestId("klip-nadi"), f).toHaveCount(KLIP.includes(f) ? 1 : 0);
  }
  await p.goto("/fitur/lempar");
  const klip = p.getByTestId("klip-nadi").locator("video");
  await klip.scrollIntoViewIfNeeded();
  await expect.poll(() => klip.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 20_000 }).toBeGreaterThan(0.5);
  await biasa.close();

  const diam = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const q = await diam.newPage();
  await q.goto("/fitur/lempar");
  const k2 = q.getByTestId("klip-nadi").locator("video");
  await k2.scrollIntoViewIfNeeded();
  await q.waitForTimeout(2500);
  expect(await k2.evaluate((v: HTMLVideoElement) => v.paused && v.currentTime === 0)).toBe(true);
  await diam.close();
});
