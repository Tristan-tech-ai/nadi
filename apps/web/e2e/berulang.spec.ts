import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// W-07A: pemilik (akun B, usaha "Uji Berulang E2E") membuat tagihan sewa bulanan mulai hari ini; invoice periode pertama langsung terbit,
// tampil di halaman tagihan publik /i/<kode>, jadwal menunjukkan 1 kali terbit dan periode berikutnya, lalu dijeda.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Berulang E2E";

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

test("tagihan berulang: periode pertama terbit, muncul di /i, jadwal dijeda", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: USAHA, p_industri: "toko" });
      expect(error).toBeNull();
      pid = data as string;
    }
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const pelanggan = `Rina kamar ${Date.now().toString(36).toUpperCase()}`;

    await page.goto(`/masuk?next=${encodeURIComponent("/app/invoice")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/invoice");
    await page.waitForLoadState("networkidle");

    const f = page.getByRole("form", { name: "Tagihan berulang" });
    await f.getByLabel("Nama pelanggan").fill(pelanggan);
    await f.getByLabel("Nomor WhatsApp (opsional)").fill("0812-3456-7011");
    await f.getByLabel("Uraian").fill("Sewa kamar 3");
    await f.getByLabel("Harga per periode (Rp)").fill("750.000");
    await f.getByLabel("Ulangi tiap").selectOption("1");
    await f.getByRole("button", { name: "Simpan tagihan berulang" }).click();
    await expect(f.getByRole("status")).toHaveText("Tagihan berulang tersimpan. 1 invoice terbit.", { timeout: 40_000 });
    const j = page.getByTestId("berulang").filter({ hasText: pelanggan });
    await expect(j).toHaveAttribute("data-status", "aktif");
    await expect(j).toContainText("1 kali terbit");
    await expect(j).toContainText("berikutnya");

    const { data: inv } = await sb.from("invoice").select("kode_verifikasi, total, pelanggan_hp, catatan").eq("pelanggan", pelanggan);
    expect(inv).toHaveLength(1);
    expect(inv![0]).toMatchObject({ total: 750000, pelanggan_hp: "6281234567011" });
    expect(inv![0].catatan).toMatch(/^Tagihan periode \d{2}-\d{2}-\d{4}\.$/);
    // Tombol terbitkan tidak menggandakan periode yang sama.
    await page.getByRole("button", { name: "Terbitkan yang jatuh tempo sekarang" }).click();
    await expect(page.getByRole("form", { name: "Terbitkan yang jatuh tempo sekarang" }).getByRole("status")).toHaveText("Belum ada yang jatuh tempo.", { timeout: 40_000 });
    expect((await sb.from("invoice").select("id").eq("pelanggan", pelanggan)).data).toHaveLength(1);
    await periksaUi(page, "invoice-berulang");

    await j.getByRole("button", { name: "Jeda" }).click();
    await expect(page.getByTestId("berulang").filter({ hasText: pelanggan })).toHaveAttribute("data-status", "jeda", { timeout: 20_000 });

    await page.goto(`/i/${inv![0].kode_verifikasi}`);
    await expect(page.getByTestId("total-tagihan")).toContainText("750.000");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
