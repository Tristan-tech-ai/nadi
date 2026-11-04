import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-07C: orang yang berhenti membuka /app/ilmu di HP-nya, merekam penjelasan butir ilmunya dengan mikrofon palsu Chromium
// (kalimat korpus s01), mengirimnya ke jalur serah/<berhenti>, dan pemilik melihat "direkam" di Serah terima.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const SUARA = join(__dirname, "..", "..", "..", "fixtures", "korpus", "suara", "s01.wav");
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${SUARA}`] } });

test("Rekam Ilmu: staf yang berhenti merekam penjelasan, pemilik melihat statusnya", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(240_000);
  // Data sintetis lewat pemilik akun A: orang + topi tunggal (butir ilmu), akun staf, paket berhenti.
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = (await sb.auth.getUser()).data.user?.app_metadata?.pid as string;
  const nama = `Staf Ilmu ${Date.now()}`;
  const { data: orang } = await sb.from("orang").insert({ perusahaan_id: pid, nama }).select("id").single();
  const { data: topi } = await sb.from("topi").insert({ perusahaan_id: pid, kode: `ilmu_${Date.now()}`, nama: `Barista Ilmu ${Date.now()}` }).select("id").single();
  expect((await sb.from("pakai_topi").insert({ perusahaan_id: pid, orang_id: orang!.id, topi_id: topi!.id })).error).toBeNull();
  expect((await sb.rpc("buat_akun_staf", { p_orang: orang!.id, p_pin: "135790" })).error).toBeNull();
  const hari = new Date().toISOString().slice(0, 10);
  const efektif = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  expect((await sb.rpc("catat_berhenti", { p_orang: orang!.id, p_surat: hari, p_efektif: efektif, p_alasan: "mundur", p_kunci: crypto.randomUUID() })).error).toBeNull();
  const { data: o } = await sb.from("orang").select("id_staf").eq("id", orang!.id).single();
  const { data: u } = await sb.from("perusahaan").select("kode").eq("id", pid).single();

  const staf = await (await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] })).newPage();
  await staf.goto("/masuk/staf");
  await staf.getByLabel("Kode usaha").fill(u!.kode);
  await staf.getByLabel("ID kamu").fill(o!.id_staf);
  await staf.getByLabel("PIN").fill("135790");
  await staf.getByRole("button", { name: "Masuk" }).click();
  await staf.waitForURL((x) => x.pathname === "/app");
  await staf.getByRole("link", { name: "Ilmu" }).click();
  await staf.waitForURL((x) => x.pathname === "/app/ilmu");
  await expect(staf.getByRole("heading", { level: 1, name: "Rekam ilmumu" })).toBeVisible();
  await expect(staf.getByTestId("batas-ilmu")).toContainText("5:00");
  const butir = staf.getByTestId("butir-ilmu").first();
  for (const skema of ["light", "dark"] as const) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      await staf.setViewportSize({ width: w, height: h });
      await staf.emulateMedia({ colorScheme: skema });
      await staf.waitForTimeout(400);
      const axe = await new AxeBuilder({ page: staf }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${w} ${skema}`).toEqual([]);
      await staf.screenshot({ path: test.info().outputPath(`rekam-ilmu-${w}-${skema}.png`), fullPage: true });
    }
  }
  await staf.setViewportSize({ width: 390, height: 844 });
  await butir.getByTestId("rekam-ilmu").click();
  await expect(butir.getByRole("timer")).toBeVisible();
  await staf.waitForTimeout(3500);
  await butir.getByTestId("berhenti-ilmu").click();
  await expect(butir.locator("audio")).toBeVisible();
  await butir.getByTestId("kirim-ilmu").click();
  await expect(butir.getByTestId("ilmu-terkirim")).toBeVisible({ timeout: 30_000 });

  // Pemilik melihat butir ilmu orang itu sudah direkam.
  await page.goto("/masuk?next=/app/serah-terima");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((x) => x.pathname === "/app/serah-terima");
  const paket = page.getByTestId("paket-serah").filter({ hasText: nama });
  await expect(paket.getByTestId("status-rekam").first()).toContainText(/direkam \d+:\d{2}/);

  // Pemilik: klip tampil; transkrip diisi lewat RPC (transkrip di perangkat sudah diuji di wawancara.spec), lalu Susun langkah
  // memanggil Edge Function langkah-ilmu dengan model ringan sungguhan, dan langkah bisa diedit pemilik.
  const panel = paket.getByTestId("ilmu-pemilik").first();
  await expect(panel.locator("audio")).toHaveCount(1);
  await expect(panel.getByTestId("transkrip-ilmu")).toBeVisible();
  const { data: bi } = await sb.from("serah_butir").select("id").eq("jenis", "ilmu").eq("berhenti_id",
    (await sb.from("berhenti").select("id").eq("orang_id", orang!.id).single()).data!.id).limit(1).single();
  expect((await sb.rpc("simpan_ilmu", { p_butir: bi!.id, p_transkrip: "Pertama nyalakan mesin espresso. Lalu tunggu lampu hijau sekitar sepuluh menit. Setelah itu giling kopi dua puluh gram dan seduh dua puluh lima detik.", p_langkah: null, p_sumber: "pemilik" })).error).toBeNull();
  await page.reload();
  await panel.getByTestId("susun-langkah").click();
  await expect(panel.getByTestId("langkah-ilmu").locator("li").first()).toBeVisible({ timeout: 60_000 });
  await expect(panel).toContainText("Langkah dirapikan Nadi dari rekaman; dengar klip aslinya bila ragu.");
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await panel.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `pemilik ${w} ${skema}`).toEqual([]);
      await panel.screenshot({ path: test.info().outputPath(`ilmu-pemilik-${w}-${skema}.png`) });
    }
  }
  await panel.getByText("Ubah langkah").click();
  await panel.getByTestId("edit-langkah").fill(["Nyalakan mesin espresso.", "Tunggu lampu hijau."].join("\n"));
  await panel.getByRole("button", { name: "Simpan langkah" }).click();
  await expect(panel.getByRole("status")).toContainText("Tersimpan.");
  const { data: akhir } = await sb.from("serah_butir").select("langkah, langkah_sumber").eq("id", bi!.id).single();
  expect(akhir?.langkah).toEqual(["Nyalakan mesin espresso.", "Tunggu lampu hijau."]);
  expect(akhir?.langkah_sumber).toBe("pemilik");
});
