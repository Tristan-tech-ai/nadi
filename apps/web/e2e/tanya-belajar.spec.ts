import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// T-01A: kalimat yang tidak dikenali pengurai ("cuan" = laba) dipelajari lewat model sekali. Jawaban pertama memakai model dan
// layar menulis bahwa Nadi sedang mempelajari format baru; aturan bayangan dibandingkan dengan model sampai cocok 2 kali, lalu
// aktif; sesudahnya kalimat yang sama dijawab tanpa AI (token 0). Usaha akun B "Uji Kinerja E2E" (bukan Toko Bu Sari).
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Kinerja E2E";
const KALIMAT = "Berapa cuan bulan ini?";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("belajar format tanya data: model sekali, bayangan 2 kali, lalu token 0", async ({ page }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
  const pid = ada?.[0]?.id as string;
  expect(pid).toBeTruthy();
  try {
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await page.goto(`/masuk?next=${encodeURIComponent("/app/tanya")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/tanya");
    // Pengaman: tes ini menulis aturan, jadi wajib di usaha uji. Usaha aktif akun B bisa tertukar bila spec akun B lain berjalan
    // bersamaan (6 Nov 2026 satu aturan sempat tercatat di Toko Bu Sari); jalankan spec ini sendirian.
    await expect(page.getByTestId("nama-perusahaan")).toHaveText(USAHA);

    const asal: { asal: string; token: number }[] = [];
    for (let i = 0; i < 5; i++) {
      await page.goto("/app/tanya");
      await page.waitForLoadState("networkidle");
      const f = page.getByRole("form", { name: "Tanya data" });
      await f.getByLabel("Pertanyaanmu").fill(KALIMAT);
      await expect(page.getByTestId("nama-perusahaan")).toHaveText(USAHA);
      await f.getByRole("button", { name: "Tanya", exact: true }).click();
      const jawab = page.getByTestId("tanya-jawaban");
      await expect(jawab).toContainText("Laba", { timeout: 60_000 });
      const a = jawab.getByTestId("tanya-asal");
      asal.push({ asal: (await a.getAttribute("data-asal"))!, token: Number(await a.getAttribute("data-token")) });
      if (asal.at(-1)!.asal === "model") await expect(a).toContainText("Nadi sedang mempelajari format baru.");
      if (i === 0) {
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
        await page.screenshot({ path: test.info().outputPath("tanya-belajar.png"), fullPage: true });
      }
      if (asal.at(-1)!.asal === "aturan") break;
    }
    console.log("TANYA_BELAJAR", JSON.stringify(asal));
    // Sebelum aktif: model dipakai (token > 0) paling banyak 3 kali (belajar + 2 bayangan); sesudahnya aturan, token 0.
    const akhir = asal.at(-1)!;
    expect(akhir).toEqual({ asal: "aturan", token: 0 });
    expect(asal.filter((x) => x.asal === "model").length).toBeLessThanOrEqual(3);
    for (const x of asal.filter((y) => y.asal === "model")) expect(x.token).toBeGreaterThan(0);
    await expect(page.getByTestId("tanya-asal")).toContainText("tanpa AI");
    const { data: aturan } = await sb.from("tanya_aturan").select("kata, niat, status, bayangan_cocok").eq("kata", "cuan");
    expect(aturan).toEqual([{ kata: "cuan", niat: "laba", status: "aktif", bayangan_cocok: 2 }]);
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
