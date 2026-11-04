import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-07D: pemilik membuat tautan wawancara keluar sekali pakai di Serah terima; orang yang berhenti membukanya tanpa akun,
// membaca "Jawabanmu tidak memengaruhi hakmu", menjawab sekali; tautan yang sama lalu menyebut sudah terkirim; pemilik membaca jawaban.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

async function periksa(page: Page, nama: string, el?: ReturnType<Page["locator"]>) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      if (el) await el.evaluate((x) => x.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${w} ${skema}`).toEqual([]);
      await (el ?? page).screenshot({ path: test.info().outputPath(`${nama}-${w}-${skema}.png`) });
    }
  }
}

test("wawancara keluar: tautan sekali pakai, jawaban hanya dibaca pemilik", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = (await sb.auth.getUser()).data.user?.app_metadata?.pid as string;
  const nama = `Staf Keluar ${Date.now()}`;
  const { data: orang } = await sb.from("orang").insert({ perusahaan_id: pid, nama }).select("id").single();
  const hari = new Date().toISOString().slice(0, 10);
  const efektif = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  expect((await sb.rpc("catat_berhenti", { p_orang: orang!.id, p_surat: hari, p_efektif: efektif, p_alasan: "mundur", p_kunci: crypto.randomUUID() })).error).toBeNull();

  await page.goto("/masuk?next=/app/serah-terima");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((x) => x.pathname === "/app/serah-terima");
  // Saring lewat judul paket: nama orang juga muncul di pilihan pengganti paket lain.
  const paket = () => page.getByTestId("paket-serah").filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(nama) }) });
  const bagian = paket().getByTestId("wawancara-keluar");
  await expect(bagian).toContainText("Belum dijawab.");
  await bagian.getByTestId("buat-tautan-keluar").click();
  const tautan = await bagian.getByTestId("tautan-keluar").inputValue();
  expect(tautan).toMatch(/\/keluar#nmw_[0-9a-f]{64}$/);
  await periksa(page, "keluar-pemilik", bagian);

  // Orang yang berhenti membuka tautan tanpa akun.
  const tamu = await (await browser.newContext()).newPage();
  await tamu.goto(new URL(tautan).pathname + new URL(tautan).hash);
  await expect(tamu.getByTestId("tidak-memengaruhi")).toContainText("Jawabanmu tidak memengaruhi hakmu");
  await expect(tamu.getByText(`Halo ${nama}.`)).toBeVisible();
  await periksa(tamu, "keluar-tamu");
  await tamu.getByLabel("Apa yang paling berat?").fill("Jadwal malam berturut-turut tanpa jeda.");
  await tamu.getByLabel("Satu hal yang sebaiknya diubah?").fill("Jadwal dibagikan seminggu sebelumnya.");
  await tamu.getByTestId("kirim-keluar").click();
  await expect(tamu.getByTestId("keluar-terkirim")).toContainText("Jawabanmu terkirim");
  await tamu.reload();
  await expect(tamu.getByTestId("keluar-terkirim")).toContainText("sudah terkirim");

  await page.reload();
  const jawaban = paket().getByTestId("jawaban-keluar");
  await expect(jawaban).toContainText("Jadwal malam berturut-turut tanpa jeda.");
  await expect(jawaban).toContainText("Jadwal dibagikan seminggu sebelumnya.");
  await periksa(page, "keluar-jawaban", jawaban);
});
