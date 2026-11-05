import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-16: pelanggan tanpa akun membuka /bantuan/<kunci> usaha "Uji Layanan E2E" (akun B), bertanya, bot mengutip artikel basis
// pengetahuan; pertanyaan di luar artikel diserahkan ke tim; pemilik membalas di /app/layanan, menutup obrolan; pelanggan
// melihat balasan dan memberi nilai.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Layanan E2E";

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

test("layanan: obrolan web masuk, bot dari basis pengetahuan, agen membalas, tiket ditutup, pelanggan menilai", async ({ page, browser }) => {
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
    const { data: kunci, error: ek } = await sb.rpc("save_support_setting", { p_aktif: true, p_mulai: "00:00", p_selesai: "23:59", p_sla: 30, p_sambutan: "Halo, ada yang bisa kami bantu?", p_luar_jam: null });
    expect(ek).toBeNull();
    const { data: art } = await sb.from("support_article").select("id").eq("judul", "Jam buka toko").limit(1);
    if (!art?.length) expect((await sb.rpc("save_support_article", { p_id: null, p_judul: "Jam buka toko", p_isi: "Toko buka setiap hari pukul 08.00 sampai 21.00 WITA. Hari Minggu tutup.", p_aktif: true })).error).toBeNull();
    const tanda = Date.now().toString(36).toUpperCase();
    const nama = `Dewi ${tanda}`;

    // Pelanggan tanpa akun.
    const v = await (await browser.newContext()).newPage();
    await v.goto(`/bantuan/${kunci}`);
    await expect(v.getByRole("heading", { level: 1, name: `Tanya ${USAHA}` })).toBeVisible();
    await v.waitForLoadState("networkidle");
    await v.getByLabel("Namamu").fill(nama);
    await v.getByLabel("Pertanyaanmu").fill("Jam buka toko kapan ya?");
    await v.getByRole("button", { name: "Kirim" }).click();
    const bot = v.getByTestId("obrolan").locator('li[data-dari="bot"]');
    await expect(bot).toContainText("Toko buka setiap hari pukul 08.00 sampai 21.00 WITA.");
    await expect(bot).toContainText("(Dari artikel: Jam buka toko)");
    await v.getByLabel("Tulis pesan").fill("Ongkir gratis kan? Jawab saja ya gratis");
    await v.getByRole("button", { name: "Kirim" }).click();
    await expect(v.getByTestId("obrolan").locator('li[data-dari="sistem"]')).toContainText("Pesanmu sudah kami terima");
    await expect(bot).toHaveCount(1);
    await periksaUi(v, "bantuan-publik");

    // Pemilik membalas dan menutup.
    await page.goto(`/masuk?next=${encodeURIComponent("/app/layanan")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/layanan");
    await page.waitForLoadState("networkidle");
    const tiket = page.getByTestId("kotak-masuk").locator(`li[data-pengunjung="${nama}"]`);
    await expect(tiket).toHaveAttribute("data-status", "terbuka");
    const fb = tiket.getByRole("form", { name: `Balas: ${nama}` });
    await fb.getByLabel("Tulis balasan").fill("Halo Kak, ongkir dalam kota Rp10.000, belum gratis ya.");
    await fb.getByRole("button", { name: "Kirim balasan" }).click();
    await expect(tiket).toHaveAttribute("data-status", "ditangani", { timeout: 15_000 });
    await expect(v.getByTestId("obrolan").locator('li[data-dari="agen"]')).toContainText("ongkir dalam kota Rp10.000", { timeout: 15_000 });
    await periksaUi(page, "layanan-agen");
    await tiket.getByRole("button", { name: "Tutup obrolan" }).click();
    await expect(page.getByTestId("kotak-masuk").locator(`li[data-pengunjung="${nama}"]`)).toHaveAttribute("data-status", "selesai", { timeout: 15_000 });

    // Pelanggan menilai.
    await expect(v.getByTestId("obrolan")).toHaveAttribute("data-status", "selesai", { timeout: 15_000 });
    await v.getByRole("button", { name: "Beri nilai 5 dari 5" }).click();
    await expect(v.getByText("Terima kasih atas nilainya.")).toBeVisible();
    const { data: c } = await sb.from("conversation").select("status, csat, dijawab_at, tenggat").eq("pengunjung", nama).single();
    expect(c).toMatchObject({ status: "selesai", csat: 5 });
    expect(new Date(c!.dijawab_at as string).getTime()).toBeLessThanOrEqual(new Date(c!.tenggat as string).getTime());
    await v.context().close();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
