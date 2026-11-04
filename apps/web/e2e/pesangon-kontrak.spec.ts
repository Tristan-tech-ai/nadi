import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F4-09B: kartu cadangan pesangon menghitung uang kompensasi PKWT (PP 35/2021 Pasal 16) untuk karyawan kontrak, dan iuran dana
// pensiun pengusaha (Pasal 58) yang diisi pemilik per orang mengurangi kekurangan orang itu.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

async function periksa(page: Page, nama: string, el: Locator) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await el.evaluate((x) => x.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${w} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${nama} ${w} tanpa gulir datar`).toBeLessThanOrEqual(w);
      await el.screenshot({ path: test.info().outputPath(`${nama}-${w}-${skema}.png`) });
    }
  }
}

const tgl = (d: Date) => d.toISOString().slice(0, 10);

test("cadangan pesangon: kompensasi PKWT dan iuran dana pensiun", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = (await sb.auth.getUser()).data.user?.app_metadata?.pid as string;
  const t = Date.now();
  const tetap = `Tetap Pensiun ${t}`;
  const kontrak = `Kontrak PKWT ${t}`;
  const sekarang = new Date();
  const mulaiKontrak = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - 9, Math.min(sekarang.getUTCDate(), 28)));
  const selesai = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() + 3, 1));
  const { data: orang, error } = await sb.from("orang").insert([
    { perusahaan_id: pid, nama: tetap, jenis: ["karyawan"], data: { mulai: "2022-09-01" } },
    { perusahaan_id: pid, nama: kontrak, jenis: ["karyawan"], data: { mulai: tgl(mulaiKontrak), kontrak_selesai: tgl(selesai) } },
  ]).select("id, nama");
  expect(error).toBeNull();
  const id = (n: string) => orang!.find((o) => o.nama === n)!.id as string;
  for (const n of [tetap, kontrak]) {
    expect((await sb.from("orang_rahasia").upsert({ orang_id: id(n), perusahaan_id: pid, gaji: { pokok: 3_500_000, tunjangan_tetap: 500_000, ptkp: "TK/0" } }, { onConflict: "orang_id" })).error).toBeNull();
  }

  try {
    await page.goto("/masuk?next=/app/gaji");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((x) => x.pathname === "/app/gaji");
    const kartu = page.getByTestId("cadangan-pesangon");
    await expect(kartu.getByTestId("catatan-kontrak")).toContainText("Pasal 16 ayat (6)");
    await kartu.getByText("Rincian per orang").click();
    const rincian = kartu.getByTestId("rincian-pesangon");
    const bk = rincian.getByRole("listitem").filter({ hasText: kontrak });
    await expect(bk).toContainText("Uang kompensasi PKWT: 9 / 12 x Rp4.000.000");
    await expect(bk).toContainText("Rp3.000.000");
    const bt = rincian.getByRole("listitem").filter({ hasText: tetap });
    await expect(bt).toContainText("5 bulan pesangon + 2 bulan penghargaan");
    await expect(bk.getByLabel(/Iuran dana pensiun/)).toHaveCount(0);
    await bt.getByLabel("Iuran dana pensiun dari usaha yang sudah dibayar (Rp)").fill("5.000.000");
    await bt.getByRole("button", { name: `Simpan iuran ${tetap}` }).click();
    await expect(bt.getByText("Iuran tersimpan.")).toBeVisible();
    await page.reload();
    await kartu.getByText("Rincian per orang").click();
    await expect(rincian.getByRole("listitem").filter({ hasText: tetap }).getByTestId("tertutup-pensiun")).toContainText("Rp5.000.000");
    await expect(kartu.getByTestId("total-tertutup-pensiun")).toBeVisible();
    await kartu.getByText("Dari mana angka ini?").click();
    await expect(kartu).toContainText("Pasal 58 ayat (1)");
    // Warung Uji A punya ratusan karyawan sisa uji: foto dua baris yang diuji dan ringkasan kartu; axe tetap memeriksa seluruh halaman.
    await periksa(page, "pesangon-tetap", rincian.getByRole("listitem").filter({ hasText: tetap }));
    await periksa(page, "pesangon-kontrak", bk);
    await periksa(page, "pesangon-ringkas", kartu.getByTestId("rentang-pesangon"));
  } finally {
    // Data uji dinonaktifkan (bukan dihapus) supaya kartu Warung Uji A tidak terus membesar.
    await sb.from("orang").update({ status: "nonaktif" }).in("id", orang!.map((o) => o.id));
  }
});
