import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// U-13: Lihat rincian di kartu usulan menampilkan sebelum -> sesudah, yang ditambah, dan yang dilewati. Akun pemilik B;
// usulan uji ditolak di akhir sehingga tidak ada data yang berubah.
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
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B, "sekali (desktop), butuh .env.e2e.local");
});

test("rincian usulan: sebelum -> sesudah, ditambah, dilewati", async ({ page }) => {
  test.setTimeout(150_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const tanda = Date.now().toString(36);
  const { data: k } = await sb.from("kebijakan_izin").select("otomatis, maks_hari_otomatis").eq("jenis", "cuti").maybeSingle();
  // Orang sementara yang namanya huruf saja (nama dari AI tidak boleh berangka), dinonaktifkan lagi di akhir.
  const pid = (await sb.auth.getUser()).data.user?.app_metadata?.pid as string;
  const lama = `Lama Rincian ${tanda.replace(/\d/g, "")}`;
  const { data: oLama, error: eLama } = await sb.from("orang").insert({ perusahaan_id: pid, nama: lama }).select("id").single();
  expect(eLama).toBeNull();
  const baru = `Sari Rincian ${tanda.replace(/\d/g, "")}`;
  const judulIzin = `Uji rincian izin ${tanda}`;
  const judulOrang = `Uji rincian orang ${tanda}`;
  const r = await sb.rpc("usul_onboarding", { p_kunci: randomUUID(), p_butir: [
    { aksi: "onboarding.izin", judul: judulIzin, bidang: { jenis: "cuti", otomatis: !(k?.otomatis ?? false), maks_hari: 3, butuh_bukti: false } },
    { aksi: "orang.impor", judul: judulOrang, bidang: { baris: [{ id: "", nama: lama, jabatan: "kasir", telepon: "", mulai: "" }] } },
  ] });
  expect(r.error).toBeNull();
  const ids = ((await sb.from("usulan").select("id").in("judul", [judulIzin, judulOrang])).data ?? []).map((x) => x.id as string);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/masuk?next=${encodeURIComponent("/app?urut=terbaru")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app");

    const kIzin = page.locator("article").filter({ hasText: judulIzin });
    await kIzin.getByText("Lihat rincian").click();
    const ubah = kIzin.getByRole("region", { name: "Akan diubah" });
    await expect(ubah.locator("tr[data-berubah=ya]").filter({ hasText: "Disetujui otomatis" })).toBeVisible();
    await expect(ubah.locator("tr").filter({ hasText: "Otomatis sampai (hari)" })).toContainText("3");
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`), skema).toEqual([]);
      await kIzin.screenshot({ path: test.info().outputPath(`rincian-izin-${skema}.png`) });
    }
    await page.emulateMedia({ colorScheme: "light" });

    const kOrang = page.locator("article").filter({ hasText: judulOrang });
    await kOrang.getByText("Lihat rincian").click();
    await expect(kOrang.getByRole("region", { name: "Dilewati karena sudah ada" })).toContainText(lama);
    await kOrang.screenshot({ path: test.info().outputPath("rincian-orang.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await kIzin.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "390 tanpa gulir samping").toBe(true);
    await kIzin.screenshot({ path: test.info().outputPath("rincian-izin-390.png") });
    void baru;
  } finally {
    for (const id of ids) await sb.rpc("putuskan_usulan", { p_usulan: id, p_setuju: false });
    await sb.from("orang").update({ status: "nonaktif" }).eq("id", oLama!.id);
  }
});
