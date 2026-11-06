import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { formatRupiah } from "../src/lib/format";
import { susunSlip, type PetaAturan } from "../src/lib/gaji/susun";
import { hitungThr } from "../src/lib/gaji/thr";

// L-04 pusat bantuan dan L-05 alat gratis (halaman depan setara Mekari, tanpa login). Hasil kalkulator dibandingkan dengan
// fungsi aplikasi yang sama dan aturan dari database yang sama, jadi angka publik tidak bisa diam-diam berbeda dari aplikasi.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = bacaEnv(".env.local");

async function periksa(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(350);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`) });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
}

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop", "sekali");
});

test("pusat bantuan: kategori, cari tanpa JavaScript, artikel tugas dan artikel layar", async ({ page }) => {
  await page.goto("/bantuan");
  await expect(page.getByRole("heading", { level: 1, name: "Pusat bantuan" })).toBeVisible();
  expect(await page.getByTestId("kategori-bantuan").count()).toBeGreaterThanOrEqual(10);
  await periksa(page, "bantuan");
  await page.getByLabel("Cari bantuan").fill("lupa kata sandi");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await page.waitForURL(/q=lupa/);
  await page.getByTestId("hasil-artikel").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tidak bisa masuk atau lupa kata sandi");
  expect(await page.getByTestId("langkah-artikel").locator("li").count()).toBeGreaterThanOrEqual(3);
  await page.goto("/bantuan/artikel/gaji");
  await expect(page.getByTestId("buka-layar")).toHaveAttribute("href", "/app/gaji");
  await periksa(page, "artikel-gaji");
  // Rute obrolan pelanggan /bantuan/<kunci> tetap jalan di samping pusat bantuan.
  await page.goto("/bantuan/000000000000000000");
  await expect(page.getByRole("main")).toBeVisible();
});

test("alat gratis: gaji bersih dan THR sama dengan hitungan aplikasi", async ({ page }) => {
  test.skip(!E.NEXT_PUBLIC_SUPABASE_URL, "butuh .env.local");
  await page.goto("/alat");
  await expect(page.getByTestId("kartu-alat")).toHaveCount(3);
  await page.goto("/alat/gaji");
  await expect(page.getByTestId("gaji-bersih")).toBeVisible();
  // Isian dikendalikan React: isi setelah hidrasi, lalu pastikan nilainya (temuan produksi: isian sebelum hidrasi hilang).
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Gaji pokok sebulan").fill("6.000.000");
  await page.getByLabel("Status pajak (PTKP)").selectOption("K/1");

  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const r = await fetch(`${E.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/aturan_bertanggal?select=kunci,nilai,terverifikasi,berlaku_dari&berlaku_dari=lte.${hari}&order=berlaku_dari.desc`,
    { headers: { apikey: E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}` } });
  const aturan: PetaAturan = {};
  for (const a of (await r.json()) as { kunci: string; nilai: unknown; terverifikasi: boolean }[]) if (!aturan[a.kunci]) aturan[a.kunci] = { nilai: a.nilai, terverifikasi: a.terverifikasi };
  const bulan = Math.min(11, Number(hari.slice(5, 7)));
  const s = susunSlip({ pokok: 6_000_000, tunjangan_tetap: 0, ptkp: "K/1", risiko_jkk: "sangat_rendah" }, aturan, bulan);
  const bersih = s.komponen.filter((k) => k.jenis === "pendapatan").reduce((a, k) => a + k.nilai, 0) - s.komponen.filter((k) => k.jenis === "potongan").reduce((a, k) => a + k.nilai, 0);
  await expect(page.getByTestId("gaji-bersih")).toHaveText(formatRupiah(bersih));
  expect(bersih).toBeLessThan(6_000_000);
  await periksa(page, "alat-gaji");

  await page.goto("/alat/thr");
  await page.waitForLoadState("networkidle");
  for (const [label, nilai] of [["Mulai bekerja", "2026-01-15"], ["Tanggal Hari Raya", "2026-07-20"]] as const) {
    await page.getByLabel(label).fill(nilai);
    await expect(page.getByLabel(label)).toHaveValue(nilai);
  }
  await page.getByLabel("Gaji pokok sebulan").fill("3.600.000");
  await expect(page.getByLabel("Gaji pokok sebulan")).toHaveValue("Rp3.600.000");
  await expect(page.getByTestId("hasil-thr")).toHaveText(formatRupiah(hitungThr({ mulai: "2026-01-15", hariRaya: "2026-07-20", pokok: 3_600_000 }).thr));
  await page.goto("/alat/pesangon");
  await expect(page.getByTestId("kalkulator-pesangon").or(page.getByText("belum diperiksa ke sumber resmi"))).toBeVisible();
  await periksa(page, "alat-pesangon");
});

test("kamus istilah: daftar, cari tanpa JavaScript, halaman istilah dengan tautan ke Nadi", async ({ page }) => {
  await page.goto("/kamus");
  expect(await page.getByTestId("kartu-istilah").count()).toBeGreaterThanOrEqual(40);
  await periksa(page, "kamus");
  await page.getByLabel("Cari istilah").fill("karyawan kontrak");
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  await page.waitForURL(/q=karyawan/);
  await page.getByTestId("kartu-istilah").filter({ hasText: "PKWT" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("PKWT");
  await expect(page.getByTestId("tautan-istilah").first()).toHaveAttribute("href", "/alat/pesangon");
  await periksa(page, "istilah-pkwt");
});
