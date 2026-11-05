import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-20: alur sederhana. Pemilik (akun B, usaha "Uji Kinerja E2E", akun B sudah di batas 20 usaha) membuat formulir kerusakan dan alur
// "jika tingkat = parah, buat kartu Feed", mengisi formulir dua kali (ringan lalu parah), dan hanya kiriman parah yang menjadi kartu.
// Webhook tidak dipakai di e2e supaya tidak ada kiriman ke luar; antreannya diuji di supabase/tests/alur.test.sql.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Kinerja E2E";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("alur: formulir kerusakan parah menjadi kartu Feed, yang ringan tidak", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    const pid = ada?.[0]?.id as string;
    expect(pid).toBeTruthy();
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const tanda = Date.now().toString(36).toUpperCase();
    const formulir = `Kerusakan ${tanda}`;

    await page.goto(`/masuk?next=${encodeURIComponent("/app/alur")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/alur");
    await page.waitForLoadState("networkidle");

    const ff = page.getByRole("form", { name: "Formulir baru" });
    await ff.getByLabel("Nama formulir").fill(formulir);
    await ff.getByLabel("Isian (satu per baris)").fill("*Alat\n*Tingkat: pilih ringan, parah");
    await ff.getByRole("button", { name: "Buat formulir" }).click();
    await expect(ff.getByRole("status")).toHaveText("Formulir dibuat.", { timeout: 30_000 });

    const fa = page.getByRole("form", { name: "Alur baru" });
    await fa.getByLabel("Nama alur").fill(`Parah ${tanda}`);
    await fa.getByLabel("Ketika").selectOption({ label: `Formulir ${formulir} dikirim` });
    await fa.getByLabel("Isian syarat 1").fill("tingkat");
    await fa.getByLabel("Pembanding syarat 1").selectOption("=");
    await fa.getByLabel("Nilai syarat 1").fill("parah");
    await fa.getByLabel("Judul kartu Feed").fill(`Rusak parah ${tanda}: {alat}`);
    await fa.getByRole("button", { name: "Buat alur" }).click();
    await expect(fa.getByRole("status")).toHaveText("Alur dibuat dan langsung aktif.", { timeout: 30_000 });
    await expect(fa.getByTestId("rahasia-alur")).toHaveCount(0);

    const isi = page.getByRole("form", { name: formulir });
    for (const tingkat of ["ringan", "parah"]) {
      await isi.getByLabel("Alat", { exact: true }).fill(`Oven ${tingkat}`);
      await isi.getByLabel("Tingkat", { exact: true }).selectOption(tingkat);
      await isi.getByRole("button", { name: "Kirim" }).click();
      await expect(isi.getByRole("status")).toHaveText("Terkirim.", { timeout: 30_000 });
      await page.reload();
    }
    const kartu = page.getByTestId("alur").filter({ hasText: `Parah ${tanda}` });
    await expect(kartu.getByTestId("alur-jalan")).toContainText("1 jalan, 0 dibatasi, 0 gagal");
    await periksaUi(page, "alur");

    await page.goto("/app");
    await expect(page.getByText(`Rusak parah ${tanda}: Oven parah`)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(`Rusak parah ${tanda}: Oven ringan`)).toHaveCount(0);

    // Matikan alur: kiriman berikutnya tidak menjadi kartu.
    await page.goto("/app/alur");
    await kartu.getByRole("button", { name: /^Matikan/ }).click();
    await expect(page.getByTestId("alur").filter({ hasText: `Parah ${tanda}` })).toHaveAttribute("data-aktif", "false", { timeout: 30_000 });
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
