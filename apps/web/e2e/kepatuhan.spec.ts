import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-25: pemilik (akun A) membuka kalender kepatuhan: tenggat pajak dan BPJS tampil dengan dasar pasal; izin usaha yang dicatat
// masuk kalender pada tanggal berlakunya. Izin uji dinonaktifkan di akhir.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

test("kalender kepatuhan: pajak, BPJS, dan izin usaha dengan tanggal berlaku", async ({ page }) => {
  test.setTimeout(120_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const nama = `PIRT uji ${tanda}`;
  const d = new Date(Date.now() + 8 * 3600_000 + 20 * 86_400_000).toISOString().slice(0, 10);
  await page.goto("/masuk?next=/app/kepatuhan");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/kepatuhan");
  try {
    const kal = page.getByTestId("kalender-kepatuhan");
    await expect(kal.locator('li[data-jenis="pajak"]').first()).toContainText("PMK 81/2024");
    await expect(kal.locator('li[data-jenis="bpjs"]').filter({ hasText: "BPJS Kesehatan" }).first()).toContainText("Perpres 82/2018 Pasal 39");
    await expect(kal.locator('li[data-jenis="bpjs"]').filter({ hasText: "BPJS Ketenagakerjaan" }).first()).toContainText("PP 44/2015 Pasal 21");
    const f = page.getByRole("form", { name: "Catat izin usaha" });
    await f.getByLabel("Jenis").selectOption("pirt");
    await f.getByLabel("Nama", { exact: true }).fill(nama);
    await f.getByLabel("Nomor (boleh kosong)").fill("P-IRT 2065101012345");
    await f.getByLabel("Berlaku sampai (boleh kosong)").fill(d);
    await f.getByRole("button", { name: "Simpan izin" }).click();
    await expect(page.getByTestId("daftar-izin-usaha")).toContainText(nama);
    await expect(kal.locator('li[data-jenis="izin"]').filter({ hasText: nama })).toContainText("berlaku sampai");
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: w, height: h });
        await page.emulateMedia({ colorScheme: skema });
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id), `${w} ${skema}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await page.screenshot({ path: test.info().outputPath(`kepatuhan-${w}-${skema}.png`), fullPage: true });
      }
    }
  } finally {
    const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
    const { data: iz } = await sb.from("izin_usaha").select("id").eq("nama", nama).maybeSingle();
    if (iz) await sb.rpc("simpan_izin_usaha", { p_id: iz.id, p_jenis: "pirt", p_nama: nama, p_nomor: null, p_berlaku_sampai: d, p_pengingat: 60, p_aktif: false });
  }
});
