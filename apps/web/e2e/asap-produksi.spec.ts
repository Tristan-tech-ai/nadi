import { expect, test } from "@playwright/test";

// H-03: uji asap produksi harian tanpa manusia (.github/workflows/asap.yml). Hanya halaman publik dan alur tanpa akun, jadi
// tidak butuh rahasia. Gagal = issue berlabel asap di GitHub, lalu loop/next_task.py check menjadikannya tugas fix.
const HALAMAN: [string, RegExp][] = [
  ["/", /Nadi yang merapikan/],
  ["/en", /Nadi sorts it out/],
  ["/demo", /contoh/],
  ["/demo/toko", /contoh/],
  ["/harga", /Harga/],
  ["/keamanan", /Keamanan data/],
  ["/privasi", /Kebijakan privasi/],
  ["/syarat", /Syarat layanan/],
  ["/tentang", /Tentang Nadi/],
  ["/panduan", /./],
  ["/masuk", /./],
];

test.describe("asap produksi", () => {
  test.beforeEach(({ page }, info) => {
    void page;
    test.skip(info.project.name !== "desktop" || !process.env.E2E_BASE_URL, "hanya ke URL produksi, sekali");
  });

  for (const [jalur, judul] of HALAMAN) {
    test(`halaman ${jalur} terbuka tanpa galat`, async ({ page }) => {
      const galat: string[] = [];
      page.on("pageerror", (e) => galat.push(e.message));
      const r = await page.goto(jalur);
      expect(r?.status(), jalur).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(judul);
      expect(galat, `galat JS di ${jalur}`).toEqual([]);
    });
  }

  test("alur inti tanpa akun: nota demo disetujui, Feed usaha contoh tampil", async ({ page }) => {
    await page.goto("/");
    const demo = page.locator("article", { hasText: "Catat belanja" });
    await demo.getByRole("button", { name: "Setujui" }).click();
    await expect(demo).toContainText("Tercatat sebagai belanja");
    await page.goto("/demo");
    await expect(page.getByTestId("feed-demo").filter({ visible: true }).locator("article").first()).toBeVisible();
  });

  test("manifest PWA dan ikon tersedia", async ({ request }) => {
    const m = await request.get("/manifest.webmanifest");
    expect(m.status()).toBe(200);
    expect((await m.json()).icons.length).toBeGreaterThanOrEqual(3);
    expect((await request.get("/ikon/ikon-192.png")).status()).toBe(200);
  });

  // H-04: anggaran JavaScript per halaman publik (KB terkompresi yang diunduh di HP, termasuk prefetch tautan di layar pertama).
  // Ukuran 4 Nov 2026 + sekitar 15%; docs/quality/audit-js.md. ANGGARAN_JS_KALI memperkecil anggaran untuk uji merah sengaja.
  const ANGGARAN_KB: Record<string, number> = { "/": 190, "/en": 190, "/harga": 180, "/keamanan": 180, "/panduan": 180, "/masuk": 176 };
  for (const [jalur, kb] of Object.entries(ANGGARAN_KB)) {
    test(`anggaran JS ${jalur} <= ${kb} KB`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(jalur, { waitUntil: "networkidle" });
      const byte = await page.evaluate(() => performance.getEntriesByType("resource")
        .filter((r) => (r as PerformanceResourceTiming).initiatorType === "script" || r.name.endsWith(".js"))
        .reduce((s, r) => s + ((r as PerformanceResourceTiming).encodedBodySize || 0), 0));
      const batas = kb * Number(process.env.ANGGARAN_JS_KALI ?? 1);
      expect(Math.round(byte / 1024), `JS ${jalur} (KB)`).toBeLessThanOrEqual(batas);
    });
  }

  // Gerbang yang tidak pernah bisa gagal bukan gerbang: dijalankan merah sengaja lewat input workflow gagal_sengaja.
  test("merah sengaja (hanya bila ASAP_GAGAL_SENGAJA=1)", async () => {
    test.skip(process.env.ASAP_GAGAL_SENGAJA !== "1", "jalan normal");
    expect("gagal sengaja untuk membuktikan alur issue").toBe("lulus");
  });
});
