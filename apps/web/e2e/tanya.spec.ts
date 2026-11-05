import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-22: tanya data. Akun B, usaha contoh "Toko Bu Sari" (hanya dibaca). Jawaban "untung bulan ini" sama dengan laba di halaman
// sumbernya (Laporan keuangan M-01) lewat tautan jawaban; pertanyaan sebab ditolak; tombol contoh bekerja.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Toko Bu Sari";

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

const rp = (n: number) => `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Math.abs(n))}`;

test("tanya data: jawaban sama dengan halaman sumber, pertanyaan sebab ditolak", async ({ page }) => {
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

    await page.goto(`/masuk?next=${encodeURIComponent("/app/tanya")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/tanya");
    await page.waitForLoadState("networkidle");

    const f = page.getByRole("form", { name: "Tanya data" });
    await f.getByLabel("Pertanyaanmu").fill("Untung bulan ini berapa?");
    await f.getByRole("button", { name: "Tanya", exact: true }).click();
    const jawab = page.getByTestId("tanya-jawaban");
    await expect(jawab).toContainText("Laba", { timeout: 30_000 });
    const href = (await jawab.getByTestId("tanya-sumber").getAttribute("href"))!;
    const u = new URL(href, "http://x");
    const { data: lap } = await sb.rpc("laporan_keuangan", { p_dari: u.searchParams.get("dari"), p_sampai: u.searchParams.get("sampai") });
    const laba = (lap as { laba_rugi: { laba: number } }).laba_rugi.laba;
    await expect(jawab.getByTestId("tanya-nilai")).toContainText(rp(laba));
    await periksaUi(page, "tanya");
    await jawab.getByTestId("tanya-sumber").click();
    await page.waitForURL((x) => x.pathname === "/app/buku");
    await expect(page.getByTestId("laba-bersih")).toContainText(rp(laba));

    await page.goto("/app/tanya");
    await page.waitForLoadState("networkidle");
    await page.getByRole("form", { name: "Tanya data" }).getByLabel("Pertanyaanmu").fill("Kenapa penjualan turun?");
    await page.getByRole("button", { name: "Tanya", exact: true }).click();
    await expect(page.getByTestId("tanya-tidak-bisa")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Tagihan yang lewat jatuh tempo" }).click();
    await expect(page.getByTestId("tanya-jawaban")).toContainText("Tagihan lewat jatuh tempo", { timeout: 30_000 });
    await expect(page.getByTestId("tanya-sumber")).toHaveAttribute("href", /jenis=umur_piutang/);
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
