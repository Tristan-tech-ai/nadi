import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Permintaan Tristan 6 Nov 2026: di halaman sambung MCP pemilik bisa menyalin prompt lengkap untuk AI-nya, supaya AI itu yang
// memasang sambungan dan menyiapkan usaha. Tes hanya membaca (akun A, halaman Siapkan dan Usahamu) dan memeriksa isi papan klip.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = bacaEnv(".env.e2e.local");

test("salin prompt lengkap MCP: isi papan klip memuat alamat server, alat, halaman draf, dan batasan", async ({ page, context, baseURL }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/masuk?next=${encodeURIComponent("/app/siapkan")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/siapkan");

  const blok = page.getByTestId("prompt-lengkap");
  const alamat = (await page.getByTestId("alamat-mcp").textContent())!.trim();
  await blok.getByRole("button", { name: "Salin prompt lengkap untuk AI-mu" }).click();
  await expect(blok.getByRole("button", { name: "Tersalin" })).toBeVisible();
  const isi = await page.evaluate(() => navigator.clipboard.readText());
  expect(isi).toContain(`Alamat server MCP Nadi: ${alamat}`);
  for (const kata of ["siapa_saya", "nadi://skill", "tulis_draf", "baca_draf", "ubah_draf", "/app/siapkan/draf", "Terapkan", "memindahkan uang", "NIK", "tidak pernah tercentang otomatis"]) expect(isi, kata).toContain(kata);
  await blok.getByText("Lihat isi prompt lengkap").click();
  await expect(page.getByTestId("isi-prompt-lengkap")).toHaveText(isi);

  for (const [lebar, tinggi] of [[390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    await blok.scrollIntoViewIfNeeded();
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`), `${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`prompt-lengkap-${lebar}-${skema}.png`) });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });

  // Usahamu: tombol yang sama di bagian Asisten AI milikmu, isi sama persis.
  await page.goto("/app/perusahaan");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.getByTestId("prompt-lengkap-usahamu").getByRole("button", { name: "Salin prompt lengkap untuk AI-mu" }).click();
  await expect(page.getByTestId("prompt-lengkap-usahamu").getByRole("button", { name: "Tersalin" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(isi);
});
