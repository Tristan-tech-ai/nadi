import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CONTOH_TEKS_NADI } from "../src/lib/onboarding/prompt";

// W-04: pemilik (akun A) menempel Teks Nadi contoh (hasil chat AI) di /app/siapkan: pratinjau per baris, baris gaji ditolak,
// 12 usulan masuk Feed bertanda dari AI milikmu. Usulan uji ditolak lewat RPC di akhir supaya Feed Warung Uji A tidak menumpuk.
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
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("onboarding AI: tempel Teks Nadi, pratinjau, 12 usulan di Feed", async ({ page }) => {
  test.setTimeout(120_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const mulai = new Date(Date.now() - 5000).toISOString();

  await page.goto(`/masuk?next=${encodeURIComponent("/app/siapkan")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/siapkan");

  const f = page.getByRole("form", { name: "Tempel hasil dari AI" });
  await f.getByLabel("Tempel hasil dari AI").fill(`${CONTOH_TEKS_NADI}\n- Budi Santoso | kasir | gaji Rp4.500.000`);
  const pratinjau = page.getByTestId("pratinjau-teks-nadi");
  await expect(pratinjau.locator("[data-dikenali=tidak]")).toHaveCount(1);
  await expect(pratinjau.locator("[data-dikenali=tidak]")).toContainText("Gaji diisi sendiri");
  await expect(f).toContainText("12 usulan dari 14 baris dikenali, 1 baris ditolak.");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await f.getByRole("button", { name: "Jadikan 12 usulan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "12 usulan masuk Feed" })).toBeVisible({ timeout: 20_000 });
  const baru = (await sb.from("usulan").select("id, aksi, status").eq("sumber", "ai_milikmu").gte("dibuat_at", mulai)).data ?? [];
  expect(baru.length).toBe(12);
  expect(baru.filter((u) => u.aksi === "orang.impor").length).toBe(8);

  await page.goto("/app");
  await expect(page.getByText("Tambah Sari Dewi sebagai kasir, pelayan").first()).toBeVisible();

  for (const u of baru) expect((await sb.rpc("putuskan_usulan", { p_usulan: u.id, p_setuju: false })).error).toBeNull();
});
