import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// W-07D: kontraktor (akun B, usaha "Uji Proyek E2E") membuat proyek, mengisi RAB biaya, memasukkan tagihan material ke proyek dari
// daftar jurnal yang belum bertanda, mencatat jam kerja; laporan menunjukkan anggaran, realisasi, sisa, dan jam.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Proyek E2E";

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

test("proyek: RAB, tagihan material masuk proyek, jam kerja, laporan", async ({ page }) => {
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
    expect((await sb.rpc("ensure_chart")).error).toBeNull();
    const tanda = Date.now().toString(36).toUpperCase();
    const proyek = `Ruko ${tanda}`;
    const nota = `Semen ${tanda}`;
    const tukang = `Tukang ${tanda}`;
    expect((await sb.from("orang").insert({ perusahaan_id: pid, nama: tukang })).error).toBeNull();

    await page.goto(`/masuk?next=${encodeURIComponent("/app/proyek")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/proyek");
    await page.waitForLoadState("networkidle");
    // Q-56: perkiraan biaya jam kerja berdasar PP 35/2021 Pasal 31, jadi catatan UU 27/2026 tampil dan lolos axe di 390/1440 terang gelap.
    const catatan = page.getByTestId("catatan-uu-baru");
    await expect(catatan).toHaveCount(1);
    await expect(catatan.getByRole("link")).toHaveAttribute("href", /peraturan\.bpk\.go\.id\/Details\/359755/);
    for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: lebar, height: tinggi });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(300);
        const axe = await new AxeBuilder({ page }).include('[data-testid="catatan-uu-baru"]').analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `catatan proyek ${lebar} ${skema}`).toEqual([]);
        await page.screenshot({ path: test.info().outputPath(`catatan-proyek-${lebar}-${skema}.png`) });
      }
    }
    await page.emulateMedia({ colorScheme: "light" });

    const fb = page.getByRole("form", { name: "Proyek baru" });
    await fb.getByLabel("Nama proyek").fill(proyek);
    await fb.getByRole("button", { name: "Buat proyek" }).click();
    await expect(fb.getByRole("status")).toHaveText("Proyek dibuat.", { timeout: 30_000 });
    await page.getByRole("navigation", { name: "Pilih proyek" }).getByRole("link", { name: proyek }).click();
    await expect(page.getByTestId("laporan-proyek")).toContainText(proyek);

    const rab = page.getByRole("form", { name: "Anggaran (RAB)" });
    await rab.getByLabel("Akun").selectOption("6-900");
    await rab.getByLabel("Anggaran (Rp)").fill("10.000.000");
    await rab.getByRole("button", { name: "Simpan anggaran" }).click();
    await expect(rab.getByRole("status")).toHaveText("Anggaran tersimpan.", { timeout: 30_000 });

    // Tagihan material Rp4.000.000 dari pemasok (jurnal biaya), lalu dimasukkan ke proyek dari daftar jurnal.
    const { error: et } = await sb.rpc("buat_tagihan_beli", { p_pemasok: `TB Maju ${tanda}`, p_nomor: nota, p_tanggal: null, p_jatuh_tempo: null, p_total: 4000000,
      p_dokumen: null, p_akun: null, p_kunci: crypto.randomUUID() });
    expect(et).toBeNull();
    await page.reload();
    const baris = page.getByTestId("jurnal-belum").getByRole("listitem").filter({ hasText: `TB Maju ${tanda}` }).first();
    await baris.getByRole("button", { name: `Masukkan ke ${proyek}` }).click();
    await expect(page.getByTestId("ringkas-biaya")).toHaveText("Biaya Rp4.000.000 dari anggaran Rp10.000.000.", { timeout: 30_000 });

    const fj = page.getByRole("form", { name: "Jam kerja" });
    await fj.getByLabel("Pilih proyek").selectOption({ label: proyek });
    await fj.getByLabel("Orang").selectOption({ label: tukang });
    await fj.getByLabel("Jam", { exact: true }).fill("7,5");
    await fj.getByLabel("Catatan (opsional)").fill("Survei lokasi");
    await fj.getByRole("button", { name: "Catat jam" }).click();
    await expect(fj.getByRole("status")).toHaveText("Jam kerja tercatat.", { timeout: 30_000 });
    await expect(page.getByTestId("laporan-proyek")).toContainText("Total 7,5 jam.");
    await expect(page.getByTestId("jam-proyek")).toContainText(`${tukang}: 7,5 jam`);
    await periksaUi(page, "proyek");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
