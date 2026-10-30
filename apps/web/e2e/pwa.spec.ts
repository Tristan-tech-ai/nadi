import { expect, test } from "@playwright/test";

test("manifest PWA lengkap dengan share target ke Lempar", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.lang).toBe("id");
  expect(m.display).toBe("standalone");
  expect(m.icons.some((i: { sizes: string; purpose?: string }) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  expect(m.share_target.action).toBe("/app/lempar/terima");
  expect(m.share_target.params.files[0].name).toBe("berkas");
  for (const i of m.icons) expect((await request.get(i.src)).status(), i.src).toBe(200);
});

test("service worker disajikan tanpa cache dan halaman luring tampil", async ({ request, page }) => {
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["cache-control"]).toContain("no-store");
  await page.goto("/luring");
  await expect(page.getByRole("heading", { name: "Sinyal sedang hilang" })).toBeVisible();
});

test("Chromium menilai Nadi bisa dipasang (tanpa galat installability)", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "desktop", "CDP hanya di Chromium desktop");
  await page.goto("/luring");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors.map((e: { errorId: string }) => e.errorId)).toEqual([]);
});
