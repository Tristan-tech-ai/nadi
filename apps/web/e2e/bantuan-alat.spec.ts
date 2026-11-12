import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { formatRupiah } from "../src/lib/format";
import { susunSlip, type PetaAturan } from "../src/lib/gaji/susun";
import { hitungThr } from "../src/lib/gaji/thr";
import { totalBaris } from "../src/lib/invoice/tagihan";
import { susunSurat } from "../src/lib/surat/kalimat";

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
  await expect(page.getByTestId("kartu-alat")).toHaveCount(6);
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

test("Q-43: isian kalkulator yang diketik sebelum JavaScript siap tetap dipakai setelah hidrasi", async ({ page }) => {
  // Tahan semua chunk JS sampai isian selesai diketik, jadi pengetikan pasti terjadi sebelum hidrasi.
  let lepas = () => {};
  const tahan = new Promise<void>((r) => { lepas = r; });
  const jsNext = (u: URL) => u.pathname.startsWith("/_next/static/chunks/") && u.pathname.endsWith(".js");
  await page.route(jsNext, async (route) => { await tahan; await route.continue(); });
  await page.goto("/alat/thr", { waitUntil: "commit" });
  await page.getByLabel("Mulai bekerja").fill("2026-01-15");
  await page.getByLabel("Tanggal Hari Raya").fill("2026-07-20");
  await page.getByLabel("Gaji pokok sebulan").fill("3600000");
  lepas();
  await page.waitForLoadState("networkidle");
  await page.unroute(jsNext);
  await expect(page.getByTestId("hasil-thr")).toHaveText(formatRupiah(hitungThr({ mulai: "2026-01-15", hariRaya: "2026-07-20", pokok: 3_600_000 }).thr));
  // Isian lain diubah setelah hidrasi: nilai yang diketik sebelumnya tidak tertimpa nilai awal.
  await page.getByLabel("Tunjangan tetap sebulan").fill("400000");
  await expect(page.getByLabel("Gaji pokok sebulan")).toHaveValue("Rp3.600.000");
  await expect(page.getByTestId("hasil-thr")).toHaveText(formatRupiah(hitungThr({ mulai: "2026-01-15", hariRaya: "2026-07-20", pokok: 3_600_000, tunjanganTetap: 400_000 }).thr));
});

test("alat gratis bahasa Inggris (L-08): teks en, angka sama dengan rumus aplikasi, tautan versi en", async ({ page }) => {
  test.skip(!E.NEXT_PUBLIC_SUPABASE_URL, "butuh .env.local");
  await page.goto("/en/alat");
  await expect(page.getByRole("heading", { level: 1, name: "Free tools" })).toBeVisible();
  await expect(page.getByTestId("kartu-alat")).toHaveCount(6);
  await expect(page.getByTestId("kartu-alat").first()).toContainText("Take-home pay calculator");
  await expect(page.getByTestId("kartu-alat").first()).toHaveAttribute("href", "/en/alat/gaji");

  await page.goto("/en/alat/gaji");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Monthly base salary").fill("6.000.000");
  await page.getByLabel("Tax status (PTKP)").selectOption("K/1");
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const r = await fetch(`${E.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/aturan_bertanggal?select=kunci,nilai,terverifikasi,berlaku_dari&berlaku_dari=lte.${hari}&order=berlaku_dari.desc`,
    { headers: { apikey: E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}` } });
  const aturan: PetaAturan = {};
  for (const a of (await r.json()) as { kunci: string; nilai: unknown; terverifikasi: boolean }[]) if (!aturan[a.kunci]) aturan[a.kunci] = { nilai: a.nilai, terverifikasi: a.terverifikasi };
  const s = susunSlip({ pokok: 6_000_000, tunjangan_tetap: 0, ptkp: "K/1", risiko_jkk: "sangat_rendah" }, aturan, Math.min(11, Number(hari.slice(5, 7))));
  const bersih = s.komponen.filter((k) => k.jenis === "pendapatan").reduce((a, k) => a + k.nilai, 0) - s.komponen.filter((k) => k.jenis === "potongan").reduce((a, k) => a + k.nilai, 0);
  await expect(page.getByTestId("gaji-bersih")).toHaveText(formatRupiah(bersih));
  const kalkulator = page.getByTestId("kalkulator-gaji");
  await expect(kalkulator).toContainText("Take-home pay");
  await expect(kalkulator).toContainText("Base salary");
  await expect(kalkulator).not.toContainText("Gaji bersih yang diterima");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Free tools" })).toHaveAttribute("href", "/en/alat");
  await periksa(page, "alat-en-gaji");

  await page.goto("/en/alat/thr");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Start date").fill("2026-01-15");
  await page.getByLabel("Holiday date (Hari Raya)").fill("2026-07-20");
  await page.getByLabel("Monthly base salary").fill("3.600.000");
  await expect(page.getByTestId("hasil-thr")).toHaveText(formatRupiah(hitungThr({ mulai: "2026-01-15", hariRaya: "2026-07-20", pokok: 3_600_000 }).thr));
  await expect(page.getByTestId("kalkulator-thr")).toContainText("Less than 12 months: 6/12 x monthly wage.");

  await page.goto("/en/alat/invoice");
  await expect(page.getByTestId("total-invoice")).toHaveText(formatRupiah(totalBaris([{ uraian: "x", jumlah: 20, harga: 25_000 }])));
  await expect(page.getByTestId("pembuat-invoice")).toContainText("Bill to");

  await page.goto("/en/alat/dokumen");
  await expect(page.getByLabel("Document type")).toBeVisible();
  // Isi surat tetap bahasa Indonesia (dipakai di tempat kerja Indonesia) dan ditandai lang id.
  await expect(page.getByTestId("pratinjau-dokumen")).toHaveAttribute("lang", "id");

  // Isi halaman dan kaki halaman en menautkan versi en (menu atas yang tertutup juga memuatnya, tetapi tersembunyi).
  await page.goto("/en/bantuan");
  await expect(page.locator('a[href="/en/alat"]').filter({ visible: true })).toHaveCount(2);
  await expect(page.locator('a[href="/alat"]').filter({ visible: true })).toHaveCount(0);
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

test("pembuat invoice dan slip gaji: total sama dengan rumus invoice aplikasi, lembar cetak saja yang tercetak", async ({ page }) => {
  await page.goto("/alat/invoice");
  await page.waitForLoadState("networkidle");
  const p = page.getByTestId("pembuat-invoice");
  await p.getByLabel("Ditagihkan kepada").fill("Bu Made Katering");
  await p.getByRole("button", { name: "Tambah baris" }).click();
  const b2 = p.getByTestId("baris-invoice").nth(1);
  await b2.getByLabel("Uraian").fill("Es teh");
  await b2.getByLabel("Jumlah").fill("15");
  await b2.getByLabel("Harga").fill("5000");
  await expect(page.getByTestId("total-invoice")).toHaveText(formatRupiah(totalBaris([{ uraian: "a", jumlah: 20, harga: 25000 }, { uraian: "b", jumlah: 15, harga: 5000 }])));
  await periksa(page, "alat-invoice");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#lembar-cetak")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tambah baris" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  await page.goto("/alat/slip");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nama karyawan").fill("Komang Ayu");
  await expect(page.getByTestId("slip-cetak")).toContainText("Komang Ayu");
  await expect(page.getByTestId("gaji-bersih")).toBeVisible();
  await periksa(page, "alat-slip");
});

test("yang baru: catatan rilis bertanggal dengan tautan yang terbuka", async ({ page }) => {
  await page.goto("/baru");
  const butir = page.getByTestId("butir-rilis");
  expect(await butir.count()).toBeGreaterThanOrEqual(8);
  await periksa(page, "baru");
  await butir.first().getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Kaki halaman publik menautkan halaman depan baru.
  for (const h of ["/bantuan", "/alat", "/kamus", "/baru"]) await expect(page.locator(`footer a[href="${h}"]`).first()).toBeAttached();
});

test("templat dokumen: kalimat surat sama dengan Surat keluar aplikasi, enam jenis bisa dipilih", async ({ page }) => {
  await page.goto("/alat/dokumen");
  await page.waitForLoadState("networkidle");
  const f = page.getByTestId("pembuat-dokumen");
  await f.getByLabel("Nama usaha").fill("Bengkel Maju");
  await f.getByLabel("Nama karyawan").fill("Gede Wira");
  await f.getByLabel("Mulai bekerja").fill("2024-03-01");
  const harap = susunSurat("keterangan_kerja", { usaha: "Bengkel Maju", nama: "Gede Wira", mulai: "2024-03-01" });
  await expect(page.getByTestId("pratinjau-dokumen")).toContainText(harap.isi[0]);
  expect(await f.getByLabel("Jenis dokumen").locator("option").count()).toBe(6);
  await f.getByLabel("Jenis dokumen").selectOption({ label: "Surat peringatan" });
  await f.getByLabel("Pelanggaran").fill("terlambat masuk lima kali dalam sebulan");
  await expect(page.getByTestId("pratinjau-dokumen")).toContainText("Surat peringatan pertama");
  await expect(page.getByTestId("pratinjau-dokumen")).toContainText("terlambat masuk lima kali");
  await periksa(page, "alat-dokumen");
});

test("pusat bantuan bahasa Inggris: cari dan artikel", async ({ page }) => {
  await page.goto("/en/bantuan");
  await expect(page.getByRole("heading", { level: 1, name: "Help center" })).toBeVisible();
  await periksa(page, "bantuan-en");
  await page.getByLabel("Search help").fill("forgot password");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForURL(/\/en\/bantuan\?q=forgot/);
  await page.getByTestId("hasil-artikel").first().click();
  await expect(page).toHaveURL(/\/en\/bantuan\/artikel\/tidak-bisa-masuk/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cannot sign in or forgot your password");
  await expect(page.locator("html")).toHaveAttribute("lang", /en|id/);
});

/** Tunggu animasi berhingga (mis. kartu-masuk di gambar ponsel landing) selesai: axe mengukur warna yang masih setengah transparan
 *  sebagai kontras rendah (2 dari 3 jalan produksi gagal 12 Nov 2026). Animasi tak berhingga (denyut) dan animasi berbasis gulir diabaikan. */
async function tungguAnimasi(page: Page) {
  await page.waitForFunction(() => document.getAnimations().filter((a) => a.timeline === document.timeline && a.effect?.getComputedTiming().iterations !== Infinity).every((a) => a.playState !== "running"), null, { timeout: 10_000 });
}

test("navigasi halaman depan: panel Solusi dan Sumber belajar di desktop, satu lembar menu di HP", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("pemicu-solusi").click();
  const solusi = page.getByTestId("menu-solusi");
  await expect(solusi).toBeVisible();
  await expect(solusi.getByRole("link", { name: /Warung dan toko/ })).toHaveAttribute("href", "/untuk/warung");
  await tungguAnimasi(page);
  await page.screenshot({ path: test.info().outputPath("nav-solusi-1440.png") });
  const axe1 = await new AxeBuilder({ page }).analyze();
  expect(axe1.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByTestId("pemicu-sumber").click();
  const sumber = page.getByTestId("menu-sumber");
  await expect(sumber.getByRole("link", { name: /Pusat bantuan/ })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("nav-sumber-1440.png") });
  await sumber.getByRole("link", { name: /Kalkulator THR/ }).click();
  await page.waitForURL((u) => u.pathname === "/alat/thr");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.locator("#menu-fitur");
  await expect(menu.getByRole("link", { name: /Kamus istilah/ })).toBeVisible();
  await expect(menu.getByRole("link", { name: /Pembuat invoice/ })).toBeAttached();
  await tungguAnimasi(page);
  await page.screenshot({ path: test.info().outputPath("nav-hp-390.png"), fullPage: false });
  const axe2 = await new AxeBuilder({ page }).analyze();
  expect(axe2.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});
