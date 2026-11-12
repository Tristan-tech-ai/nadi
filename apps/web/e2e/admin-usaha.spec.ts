import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// ADMIN-01: pemilik (akun A, usaha aktifnya) menjadikan akun B admin dari halaman Orang dengan centang paham hak admin, B tampil
// di daftar admin, lalu dicabut lewat konfirmasi dua langkah dan tampil Dicabut. Dijalankan di cloud lewat uat-produksi.yml.
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
  test.skip(info.project.name !== "desktop", "sekali (desktop), lebar 390 dan 1440 dicek di dalam tes");
  test.skip(!E.E2E_EMAIL_A || !E.E2E_EMAIL_B, "butuh akun uji A dan B");
});

test("admin usaha: pemilik menambah admin dengan centang paham, lalu mencabut dengan konfirmasi", async ({ page }) => {
  test.setTimeout(180_000);
  const b = E.E2E_EMAIL_B.toLowerCase();
  await page.goto(`/masuk?next=${encodeURIComponent("/app/orang")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/orang");
  const bagian = page.getByTestId("admin-usaha");
  await expect(bagian.getByRole("heading", { name: "Admin usaha" })).toBeVisible();

  const form = bagian.getByTestId("form-tambah-admin");
  await form.getByLabel("Email akun Nadi calon admin").fill(E.E2E_EMAIL_B);
  await form.getByRole("button", { name: "Jadikan admin" }).click();
  // Centang paham wajib: peramban menahan kiriman tanpa centang, jadi daftar belum memuat B sebagai admin aktif.
  await expect(bagian.locator(`[data-admin="${b}"] >> text=Cabut admin`)).toHaveCount(0);
  await form.getByLabel("Aku paham admin bisa melihat gaji dan menyetujui usulan.").check();
  await form.getByRole("button", { name: "Jadikan admin" }).click();
  await expect(form.getByRole("status")).toContainText("admin usaha ini");
  const baris = bagian.locator(`[data-admin="${b}"]`);
  await expect(baris.getByRole("button", { name: `Cabut admin ${b}` })).toBeVisible();

  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).include('[data-testid="admin-usaha"]').analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`admin-usaha-${lebar}-${skema}.png`) });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });

  await baris.getByRole("button", { name: `Cabut admin ${b}` }).click();
  const konfirmasi = baris.getByTestId("konfirmasi-cabut-admin");
  await expect(konfirmasi).toContainText(`Cabut akses admin ${b}?`);
  await konfirmasi.getByRole("button", { name: "Batal" }).click();
  await expect(baris.getByRole("button", { name: `Cabut admin ${b}` })).toBeVisible();
  await baris.getByRole("button", { name: `Cabut admin ${b}` }).click();
  await baris.getByTestId("konfirmasi-cabut-admin").getByRole("button", { name: "Ya, cabut" }).click();
  await expect(baris).toContainText("Dicabut");

  // Database setuju dengan layar: B tercatat admin tidak aktif di usaha A.
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const { data } = await sb.rpc("list_admins");
  expect((data as { email: string; aktif: boolean }[]).find((a) => a.email.toLowerCase() === b)?.aktif).toBe(false);
});
