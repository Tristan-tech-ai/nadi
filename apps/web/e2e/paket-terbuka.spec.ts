import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// W-06: akun B memilih "Lainnya, ceritakan usahamu" di Mulai, menulis cerita usaha kue rumahan; Nadi memasang paket produksi
// (aturan, tanpa model) dan mengusulkan topi baru di Feed; pemilik menyetujui dan topi terpasang. Usaha aktif B dikembalikan.
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
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL || !E.E2E_EMAIL_B, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("Lainnya, ceritakan usahamu: paket produksi dan topi baru lewat Feed", async ({ page }) => {
  test.setTimeout(150_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const awal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const { count } = await sb.from("perusahaan").select("id", { count: "exact", head: true });
  test.skip((count ?? 0) >= 15, "akun B sudah punya 15 usaha; batas 20 per akun");
  const nama = `Uji Paket Terbuka ${Date.now().toString(36)}`;
  try {
    await page.goto(`/masuk?next=${encodeURIComponent("/app/mulai")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/mulai");
    await page.getByLabel("Nama usaha").fill(nama);
    await expect(page.getByLabel("Ceritakan usahamu", { exact: true })).toHaveCount(0);
    await page.getByText("Lainnya, ceritakan usahamu").click();
    await page.getByLabel("Ceritakan usahamu", { exact: true }).fill("Saya jualan kue kering online lewat Instagram, dibantu dua orang yang memanggang dan satu kurir");
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? "")).map((v) => v.id), String(w)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`mulai-lainnya-${w}.png`), fullPage: true });
    }
    await page.getByRole("button", { name: "Siapkan usahaku" }).click();
    await page.waitForURL((u) => u.pathname === "/app");

    await sb.auth.refreshSession();
    const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
    const { data: p } = await sb.from("perusahaan").select("nama, industri, pengaturan").eq("id", pid!).single();
    expect(p).toMatchObject({ nama, industri: "produksi" });
    expect((p!.pengaturan as { cerita_usaha?: { paket: string } }).cerita_usaha?.paket).toBe("produksi");

    const kartu = page.locator("article").filter({ hasText: "Tambah topi:" }).first();
    await expect(kartu).toContainText("Pembuat kue");
    await expect(kartu).toContainText("tanpa AI");
    await kartu.getByRole("button", { name: "Setujui" }).click();
    await expect(kartu).toHaveAttribute("data-tersimpan", "ya");
    const { data: topi } = await sb.from("topi").select("kode, asal_paket").eq("perusahaan_id", pid!);
    const kode = (topi ?? []).map((t) => t.kode);
    expect(kode).toEqual(expect.arrayContaining(["operator_produksi", "pengemas", "pembuat_kue", "admin_online", "kurir"]));
    expect((topi ?? []).find((t) => t.kode === "pembuat_kue")?.asal_paket).toBeNull();
  } finally {
    if (awal) await sb.rpc("pindah_perusahaan", { p_perusahaan: awal });
  }
});
