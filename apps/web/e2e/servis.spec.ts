import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// W-07B: bengkel (akun B, usaha "Uji Servis E2E") menerima motor, memajukan tahap sampai selesai, menagih, pelanggan mengambil;
// pelanggan membuka halaman status tanpa akun dan melihat semua tahap + tautan tagihan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Servis E2E";

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

test("order servis: terima, dikerjakan, selesai, tagih, diambil; status publik", async ({ page, browser }) => {
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
    const item = `Honda Beat DK ${Date.now().toString().slice(-4)} AB`;

    await page.goto(`/masuk?next=${encodeURIComponent("/app/servis")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/servis");
    await page.waitForLoadState("networkidle");

    const f = page.getByRole("form", { name: "Terima barang" });
    await f.getByLabel("Nama pelanggan").fill("Andi");
    await f.getByLabel("Nomor WhatsApp (opsional)").fill("0812-9999-0001");
    await f.getByLabel("Barang atau kendaraan").fill(item);
    await f.getByLabel("Keluhan atau permintaan").fill("Ganti oli, rem bunyi");
    await f.getByLabel("Perkiraan biaya (Rp, opsional)").fill("120.000");
    await f.getByRole("button", { name: "Terima dan buat tiket" }).click();
    await expect(f.getByRole("status")).toContainText("dibuat", { timeout: 30_000 });
    const o = page.getByTestId("order-servis").filter({ hasText: item });
    await expect(o).toHaveAttribute("data-status", "diterima");
    await periksaUi(page, "servis");

    await o.getByRole("button", { name: "Mulai dikerjakan" }).click();
    await expect(o).toHaveAttribute("data-status", "dikerjakan", { timeout: 30_000 });
    await o.getByRole("button", { name: "Tandai selesai" }).click();
    await expect(o).toHaveAttribute("data-status", "selesai", { timeout: 30_000 });
    const wa = decodeURIComponent((await o.getByTestId("kirim-wa").getAttribute("href"))!.split("text=")[1]);
    expect(wa).toContain(`(${item}) di ${USAHA}: selesai, siap diambil. Cek status kapan saja: `);
    await o.getByLabel("Jumlah tagihan (Rp)").fill("120.000");
    await o.getByRole("button", { name: "Buat invoice" }).click();
    await expect(o.getByRole("link", { name: /^Lihat tagihan / })).toBeVisible({ timeout: 30_000 });
    const statusUrl = (await o.getByTestId("status-publik").getAttribute("href"))!;
    await o.getByRole("button", { name: "Sudah diambil" }).click();
    await expect(page.getByTestId("order-servis").filter({ hasText: item })).toHaveAttribute("data-status", "diambil", { timeout: 30_000 });

    const tamu = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await tamu.goto(statusUrl);
    await expect(tamu.getByTestId("servis-status")).toHaveAttribute("data-status", "diambil");
    await expect(tamu.getByRole("list", { name: "Tahap order" })).toContainText("Sudah: Selesai, siap diambil");
    await expect(tamu.getByText("0812")).toHaveCount(0);
    await tamu.getByTestId("servis-tagihan").click();
    await expect(tamu.getByTestId("total-tagihan")).toContainText("120.000");
    await tamu.goBack();
    await periksaUi(tamu, "servis-publik");
    await tamu.context().close();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
