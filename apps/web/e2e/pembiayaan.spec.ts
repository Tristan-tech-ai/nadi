import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-26: paket siap pembiayaan. Akun B, usaha contoh "Toko Bu Sari" (punya jurnal dan invoice; hanya dibaca). Angka paket sama dengan
// RPC laporan_keuangan dan umur_piutang dan dengan halaman Laporan keuangan (M-01) untuk rentang yang sama; PDF dibuat dari tampilan cetak.
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

test("paket pembiayaan: angka sama dengan laporan M-01, PDF dari tampilan cetak", async ({ page }) => {
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

    await page.goto(`/masuk?next=${encodeURIComponent("/app/buku")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/buku");
    await page.getByTestId("tautan-pembiayaan").click();
    await page.waitForURL((u) => u.pathname === "/app/buku/pembiayaan");
    const periode = page.getByTestId("periode");
    const dari = (await periode.getAttribute("data-dari"))!;
    const sampai = (await periode.getAttribute("data-sampai"))!;
    expect(dari).toMatch(/^\d{4}-\d{2}-01$/);

    const { data: lap } = await sb.rpc("laporan_keuangan", { p_dari: dari, p_sampai: sampai });
    const L = lap as { laba_rugi: { pendapatan: number; beban: number; laba: number }; arus_kas: { kas_akhir: number } };
    expect(L.laba_rugi.pendapatan, "usaha contoh punya pendapatan").toBeGreaterThan(0);
    const { data: um } = await sb.rpc("umur_piutang", { p_per: sampai });
    const U = um as { kelompok: { total: number } };
    await expect(page.getByTestId("pb-pendapatan")).toHaveText(rp(L.laba_rugi.pendapatan));
    await expect(page.getByTestId("pb-beban")).toHaveText(rp(L.laba_rugi.beban));
    await expect(page.getByTestId("pb-laba")).toContainText(rp(L.laba_rugi.laba));
    await expect(page.getByTestId("pb-kas")).toContainText(rp(L.arus_kas.kas_akhir));
    await expect(page.getByTestId("pb-umur-total")).toContainText(rp(U.kelompok.total));
    await expect(page.getByTestId("pb-baris-bulan")).toHaveCount(12);
    await expect(page.getByTestId("pb-baris-invoice")).toHaveCount(12);
    const { count } = await sb.from("invoice").select("id", { count: "exact", head: true }).gte("tanggal", dari).lte("tanggal", sampai).neq("status", "batal");
    const terbit = await page.getByTestId("pb-baris-invoice").evaluateAll((rs) => rs.reduce((s, r) => s + Number(r.children[1].textContent), 0));
    expect(terbit).toBe(count);
    await periksaUi(page, "pembiayaan");

    // Sama dengan halaman Laporan keuangan M-01 untuk rentang yang sama.
    const m01 = await page.context().newPage();
    await m01.goto(`/app/buku?jenis=laba_rugi&dari=${dari}&sampai=${sampai}`);
    await expect(m01.getByTestId("laba-bersih")).toContainText(rp(L.laba_rugi.laba));
    await m01.close();

    // PDF dari tampilan cetak: tombol dan tautan tersembunyi, berkas PDF sungguhan.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Cetak atau simpan PDF" })).toBeHidden();
    // Kepala dan navigasi bawah aplikasi tidak ikut tercetak (keduanya sticky dan akan menutupi baris tabel).
    await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeHidden();
    await expect(page.getByTestId("nama-perusahaan")).toBeHidden();
    const pdf = await page.pdf({ format: "A4", printBackground: true, path: test.info().outputPath("paket-pembiayaan.pdf") });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
