import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-11: pemilik (akun A, usaha aktif) mengisi jabatan + atasan lalu promosi (riwayat), memberi SP1 lalu SP2 (berurutan), membuat
// daftar periksa onboarding, dan pengumuman; staf masuk, melihat data kerjanya sendiri dan SP-nya, lalu menandai pengumuman dibaca;
// pemilik melihat 1 orang sudah membaca. Orang uji dinonaktifkan di akhir.
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

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("HR administrasi: jabatan + atasan + promosi, SP berurutan, daftar periksa, pengumuman dibaca staf", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const manajer = `Manajer Hr ${tanda}`;
  const staf = `Kasir Hr ${tanda}`;
  const judul = `Libur toko ${tanda}`;
  await page.goto("/masuk?next=/app/orang");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/orang/);
  const kode = (await page.getByTestId("kode-usaha").textContent())!.trim();
  for (const n of [manajer, staf]) {
    await page.getByLabel("Nama orang").fill(n);
    await page.getByRole("button", { name: "Tambah" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: n })).toBeVisible();
  }
  const baris = page.getByRole("listitem").filter({ hasText: staf });
  await baris.getByPlaceholder("PIN 6 angka").fill("246810");
  await baris.getByRole("button", { name: "Buat akun staf" }).click();
  const id = (await baris.getByTestId("info-akun").textContent())!.match(/ID (S\d{3})/)![1];

  try {
    await page.goto("/app/orang/kerja");
    const fp = page.getByRole("form", { name: "Ubah jabatan dan atasan" });
    await fp.getByLabel("Orang", { exact: true }).selectOption({ label: manajer });
    await fp.getByLabel("Jabatan", { exact: true }).fill("Manajer toko");
    await fp.getByRole("button", { name: "Simpan jabatan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "riwayat" })).toBeVisible();
    await page.reload();
    await fp.getByLabel("Orang", { exact: true }).selectOption({ label: staf });
    await fp.getByLabel("Jabatan", { exact: true }).fill("Kasir");
    await fp.getByLabel("Level", { exact: true }).fill("S1");
    await fp.getByLabel("Atasan langsung").selectOption({ label: manajer });
    await fp.getByLabel("Status kerja").selectOption("pkwt");
    await fp.getByLabel("Kontrak sampai (PKWT)").fill("2027-12-31");
    await fp.getByRole("button", { name: "Simpan jabatan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "riwayat" })).toBeVisible();
    await page.reload();
    await fp.getByLabel("Orang", { exact: true }).selectOption({ label: staf });
    await fp.getByLabel("Jabatan", { exact: true }).fill("Kepala kasir");
    await fp.getByLabel("Level", { exact: true }).fill("S2");
    await fp.getByLabel("Atasan langsung").selectOption({ label: manajer });
    await fp.getByLabel("Status kerja").selectOption("pkwt");
    await fp.getByLabel("Kontrak sampai (PKWT)").fill("2027-12-31");
    await fp.getByLabel("Jenis perubahan").selectOption("promosi");
    await fp.getByRole("button", { name: "Simpan jabatan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "riwayat" })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("riwayat-kerja")).toContainText(`${staf}: Promosi, Kepala kasir (S2)`);
    // Bagan: staf di bawah manajer.
    await expect(page.getByTestId("bagan").getByRole("listitem").filter({ hasText: manajer }).getByRole("list")).toContainText(staf);

    const fs = page.getByRole("form", { name: "Beri surat peringatan" });
    for (const [i, teks] of [[1, "Terlambat 5 kali dalam sebulan"], [2, "Terlambat lagi dalam masa SP1"]] as const) {
      await fs.getByLabel("Orang", { exact: true }).selectOption({ label: staf });
      await fs.getByLabel("Pelanggaran", { exact: true }).fill(teks);
      await fs.getByRole("button", { name: "Catat surat peringatan" }).click();
      await expect(page.getByRole("status").filter({ hasText: `SP${i} tercatat` })).toBeVisible();
      await page.reload();
    }
    await expect(page.getByTestId("daftar-sp").locator(`li[data-orang="${staf}"]`).first()).toContainText("SP2");

    const fm = page.getByRole("form", { name: "Mulai daftar periksa" });
    await fm.getByLabel("Orang", { exact: true }).selectOption({ label: staf });
    await fm.getByRole("button", { name: "Buat daftar periksa" }).click();
    await expect(page.getByRole("status").filter({ hasText: "6 butir dibuat" })).toBeVisible();
    await page.reload();
    const dp = page.locator(`[data-testid="daftar-periksa"][data-orang="${staf}"]`);
    await dp.getByRole("button", { name: "Perjanjian kerja ditandatangani" }).click();
    await expect(dp).toContainText("1 dari 6 selesai");
    await periksaUi(page, "hr-kerja");

    await page.goto("/app/pengumuman");
    const fpg = page.getByRole("form", { name: "Tulis pengumuman" });
    await fpg.getByLabel("Judul", { exact: true }).fill(judul);
    await fpg.getByLabel("Isi", { exact: true }).fill("Toko tutup sehari. Shift digeser ke besok.");
    await fpg.getByRole("button", { name: "Umumkan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pengumuman tampil" })).toBeVisible();
    await page.reload();
    await expect(page.locator(`li[data-judul="${judul}"]`)).toContainText("0 dari");

    const s = await (await browser.newContext()).newPage();
    await s.goto("/masuk/staf");
    await s.getByLabel("Kode usaha").fill(kode);
    await s.getByLabel("ID kamu").fill(id);
    await s.getByLabel("PIN").fill("246810");
    await s.getByRole("button", { name: "Masuk" }).click();
    await expect(s.getByTestId("peran")).toContainText("staf");
    await expect(s.getByTestId("pengumuman-baru")).toContainText("belum kamu baca");
    await s.getByTestId("pengumuman-baru").getByRole("link").click();
    await s.waitForURL(/\/app\/pengumuman/);
    await expect(s.getByTestId("kerjaku")).toContainText("Kepala kasir (S2)");
    await expect(s.getByTestId("sp-saya").getByRole("listitem")).toHaveCount(2);
    await periksaUi(s, "hr-staf");
    const p = s.locator(`li[data-judul="${judul}"]`);
    await p.getByRole("button", { name: `Tandai sudah dibaca: ${judul}` }).click();
    await expect(p).toContainText("Sudah kamu baca.");
    await s.context().close();

    await page.reload();
    await expect(page.locator(`li[data-judul="${judul}"]`)).toContainText("1 dari");
  } finally {
    // Orang uji ditandai nonaktif agar tidak ikut gaji dan bagan berikutnya.
    const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
    await sb.from("orang").update({ status: "nonaktif" }).in("nama", [manajer, staf]);
  }
});
