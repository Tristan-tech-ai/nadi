import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-07E: pemilik melihat hak keuangan orang yang berhenti (gaji sampai tanggal efektif lewat susunSlip, sisa cuti bila jatah
// diatur, tanpa pesangon karena mengundurkan diri), mengisi uang pisah, mengajukan ke Feed, lalu menyetujui di Feed. Nadi tidak
// membayar: setelah disetujui, paket menyebut pembayaran tetap dilakukan pemilik.
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

test("hak berhenti: hitungan saran, uang pisah, usulan Feed untuk pemilik, tanpa membayar", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = (await sb.auth.getUser()).data.user?.app_metadata?.pid as string;
  const nama = `Staf Hak ${Date.now()}`;
  const { data: orang } = await sb.from("orang").insert({ perusahaan_id: pid, nama }).select("id").single();
  // Gaji besar supaya kartu ini berada di atas Feed (urut dampak rupiah).
  expect((await sb.from("orang_rahasia").upsert({ orang_id: orang!.id, perusahaan_id: pid, gaji: { pokok: 90_000_000, tunjangan_tetap: 10_000_000, ptkp: "TK/0" } }, { onConflict: "orang_id" })).error).toBeNull();
  const hari = new Date().toISOString().slice(0, 10);
  const efektif = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  expect((await sb.rpc("catat_berhenti", { p_orang: orang!.id, p_surat: hari, p_efektif: efektif, p_alasan: "mundur", p_kunci: crypto.randomUUID() })).error).toBeNull();
  const { data: kebijakan } = await sb.from("kebijakan_izin").select("jatah_tahunan").eq("perusahaan_id", pid).eq("jenis", "cuti").maybeSingle();

  await page.goto("/masuk?next=/app/serah-terima");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((x) => x.pathname === "/app/serah-terima");
  const paket = () => page.getByTestId("paket-serah").filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(nama) }) });
  const hak = paket().getByTestId("hak-berhenti");
  await expect(hak.getByTestId("rincian-hak")).toContainText(/hari kerja dari (25|21)/);
  await expect(hak.getByTestId("pesangon")).toContainText("tanpa pesangon");
  await expect(hak.getByTestId("pesangon")).toContainText("Pasal 50");
  if (kebijakan?.jatah_tahunan == null) await expect(hak).toContainText("Jatah cuti tahunan belum diatur");
  else await expect(hak.getByTestId("sisa-cuti")).toContainText(`jatah ${kebijakan.jatah_tahunan}`);
  const gajiSaran = await hak.getByLabel("Gaji terakhir (Rp)").inputValue();
  expect(Number(gajiSaran.replace(/\./g, ""))).toBeGreaterThan(0);
  await hak.getByLabel("Uang pisah (Rp, isian pemilik)").fill("5.000.000");
  await periksa(page, "hak-form", hak);
  await hak.getByTestId("ajukan-hak").click();
  await expect(hak.getByTestId("hak-terkirim")).toContainText("masuk Feed");
  await expect(hak.getByTestId("status-hak")).toHaveAttribute("data-status", "menunggu");
  await expect(paket().getByTestId("hak-berhenti").getByTestId("status-hak")).toContainText("menunggu di Feed");

  // Pemilik menyetujui di Feed: hanya mencatat keputusan.
  await page.goto("/app");
  const kartu = page.locator("article").filter({ hasText: `Bayar hak ${nama} yang berhenti` }).last();
  await expect(kartu).toBeVisible();
  await expect(kartu).toContainText("Tanpa pesangon");
  await expect(kartu).toContainText("pembayaran tetap kamu lakukan sendiri");
  await periksa(page, "hak-feed", kartu);
  await kartu.getByRole("button", { name: "Setujui" }).click();
  await expect(kartu).toHaveAttribute("data-tersimpan", "ya");

  await page.goto("/app/serah-terima");
  const status = paket().getByTestId("hak-berhenti").getByTestId("status-hak");
  await expect(status).toHaveAttribute("data-status", "diterima");
  await expect(status).toContainText("Bayar sendiri");
  await expect(paket().getByTestId("form-hak")).toHaveCount(0);
  await periksa(page, "hak-disetujui", paket().getByTestId("hak-berhenti"));
});
