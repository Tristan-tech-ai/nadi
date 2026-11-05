import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// U-12: lencana usulan menunggu di sidebar berubah langsung (Realtime) tanpa muat ulang. Akun pemilik B; usulan uji ditolak di akhir.
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

test("lencana usulan menunggu bertambah dan berkurang tanpa muat ulang", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/masuk?next=${encodeURIComponent("/app/invoice")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/invoice");
  await page.waitForLoadState("networkidle");
  const lencana = page.getByTestId("disematkan").locator("a[href='/app'] [data-lencana]");
  const awal = Number((await lencana.count()) ? await lencana.getAttribute("data-lencana") : 0);

  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  // Pastikan sesi supabase-js memakai usaha aktif yang sama dengan peramban (klaim pid dari JWT akun yang sama).
  const r = await sb.rpc("usul_onboarding", { p_butir: [{ aksi: "onboarding.izin", judul: "Uji lencana live", bidang: { jenis: "cuti", otomatis: false, maks_hari: 0, butuh_bukti: false } }], p_kunci: randomUUID() });
  expect(r.error).toBeNull();
  const baru = (await sb.from("usulan").select("id").eq("judul", "Uji lencana live").eq("status", "menunggu").order("dibuat_at", { ascending: false }).limit(1)).data?.[0];
  expect(baru).toBeTruthy();
  try {
    await expect(page.getByTestId("disematkan").locator("a[href='/app'] [data-lencana]")).toHaveAttribute("data-lencana", String(awal + 1), { timeout: 8000 });
  } finally {
    expect((await sb.rpc("putuskan_usulan", { p_usulan: baru!.id, p_setuju: false })).error).toBeNull();
  }
  if (awal === 0) await expect(page.getByTestId("disematkan").locator("a[href='/app'] [data-lencana]")).toHaveCount(0, { timeout: 8000 });
  else await expect(page.getByTestId("disematkan").locator("a[href='/app'] [data-lencana]")).toHaveAttribute("data-lencana", String(awal), { timeout: 8000 });
});
