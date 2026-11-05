import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// U-07: Masuk dengan Google di /masuk dan /daftar. Bila penyedia Google belum dinyalakan di Supabase, halaman berkata jujur;
// bila sudah, tombol membawa ke Supabase authorize dengan redirect_to ke /auth/konfirmasi (Google sendiri tidak dibuka di tes).
test("masuk dengan Google: tombol atau penjelasan jujur, rute balik aman", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali");
  for (const [jalur, lebar] of [["/masuk?next=/app/gaji", 390], ["/daftar", 1440]] as const) {
    await page.setViewportSize({ width: lebar, height: 900 });
    await page.goto(jalur);
    const blok = page.getByTestId("masuk-google");
    await expect(blok).toBeVisible();
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400); // transisi warna tombol (<= 300 ms) selesai dulu
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes.slice(0, 2).map((n) => `${n.target.join(" ")} ${n.failureSummary?.split(String.fromCharCode(10))[1] ?? ""}`).join(" | ")}`), `${jalur} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`google-${lebar}-${skema}.png`) });
    }
    await page.emulateMedia({ colorScheme: "light" });
    if ((await blok.getAttribute("data-aktif")) === "tidak") {
      await expect(blok).toContainText("belum dinyalakan");
      await expect(blok.getByRole("button")).toHaveCount(0);
    } else {
      // Jangan sampai ke Google: hentikan di Supabase authorize dan periksa tujuan baliknya.
      await page.route(/accounts\.google\.com/, (r) => r.abort());
      const [req] = await Promise.all([
        page.waitForRequest((r) => r.url().includes("/auth/v1/authorize")),
        blok.getByRole("button", { name: "Masuk dengan Google" }).click(),
      ]);
      const u = new URL(req.url());
      expect(u.searchParams.get("provider")).toBe("google");
      expect(decodeURIComponent(u.searchParams.get("redirect_to") ?? "")).toMatch(/\/auth\/konfirmasi\?next=\/app/);
    }
  }
  // Rute balik: kode palsu tidak memberi sesi dan kembali ke /masuk dengan pesan.
  await page.goto("/auth/konfirmasi?code=palsu&next=/app/gaji");
  await page.waitForURL((u) => u.pathname === "/masuk" && u.searchParams.get("galat") === "tautan");
  // Tujuan luar ditolak jalurAman.
  await page.goto("/auth/konfirmasi?code=palsu&next=//contoh.invalid");
  await page.waitForURL((u) => u.pathname === "/masuk");
});
