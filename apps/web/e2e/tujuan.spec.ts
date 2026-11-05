import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// U-10: kartu usulan menyebut akibat dan tempat hasilnya sebelum disetujui, lalu menautkan ke tempat itu sesudahnya.
// Akun pemilik B: usulan uji aturan cuti memakai nilai yang sedang berlaku, jadi menyetujuinya tidak mengubah apa pun.
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

test("usulan menyebut tujuan sebelum disetujui dan menautkan hasilnya sesudahnya", async ({ page }) => {
  test.setTimeout(120_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const { data: k } = await sb.from("kebijakan_izin").select("otomatis, maks_hari_otomatis, butuh_bukti, jatah_tahunan").eq("jenis", "cuti").maybeSingle();
  const judul = `Uji tujuan ${Date.now().toString(36)}`;
  const r = await sb.rpc("usul_onboarding", { p_butir: [{ aksi: "onboarding.izin", judul, bidang: {
    jenis: "cuti", otomatis: k?.otomatis ?? false, maks_hari: k?.maks_hari_otomatis ?? 1, butuh_bukti: k?.butuh_bukti ?? false, jatah_tahunan: k?.jatah_tahunan ?? null } }], p_kunci: randomUUID() });
  expect(r.error).toBeNull();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/masuk?next=${encodeURIComponent("/app?urut=terbaru")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  const kartu = page.locator("article").filter({ hasText: judul });
  await expect(kartu.getByTestId("tujuan-usulan")).toContainText("Kalau disetujui: Aturan izin usaha diganti.");
  for (const skema of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: skema });
    await page.waitForTimeout(400);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), skema).toEqual([]);
    await kartu.screenshot({ path: test.info().outputPath(`tujuan-${skema}.png`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
  await kartu.getByRole("button", { name: "Setujui" }).click();
  const hasil = page.getByTestId("kartu-diputuskan").filter({ hasText: judul });
  await expect(hasil).toHaveAttribute("data-tersimpan", "ya", { timeout: 20_000 });
  await hasil.getByTestId("lihat-hasil").click();
  await page.waitForURL((u) => u.pathname === "/app/perusahaan");
  // Berkas yang tidak dikenali berkata jujur soal akibatnya.
  await page.goto("/app?jenis=lainnya");
  const tinjau = page.locator("article").filter({ hasText: "Tinjau berkas" }).first();
  if (await tinjau.count()) await expect(tinjau.getByTestId("tujuan-usulan")).toContainText("tidak ada data lain yang berubah");
});
