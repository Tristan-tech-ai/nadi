import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F2-03: lowongan bertopi Pelayan otomatis berisi pertanyaan; tamu melamar di HP lalu merekam jawaban pertanyaan 1
// dengan mikrofon palsu Chromium (nada uji), memutarnya, mengirimnya lewat slot anon, dan jawaban tercatat berstatus masuk.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const CV = join(__dirname, "..", "..", "..", "fixtures", "korpus", "cv", "cv-01.pdf");

test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("wawancara suara: tamu merekam dan mengirim jawaban pertanyaan 1 setelah melamar", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  expect((await sb.rpc("pasang_paket", { p_kode: "fnb" })).error).toBeNull();
  await page.goto("/masuk?next=/app/orang");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/orang/);
  const judul = `Pelayan wawancara ${Date.now()}`;
  const kartu = page.getByTestId("kartu-lowongan");
  await kartu.getByLabel("Judul lowongan").fill(judul);
  await kartu.getByLabel("Topi (posisi)").selectOption({ label: "Pelayan" });
  await kartu.getByRole("button", { name: "Buat lowongan" }).click();
  const baris = kartu.getByTestId("daftar-lowongan").getByRole("listitem").filter({ hasText: judul });
  await expect(baris).toBeVisible();
  const tautan = (await baris.getByTestId("tautan-lamar").textContent())!.trim();

  const tamu = await (await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] })).newPage();
  const nama = `Pelamar Wawancara ${Date.now()}`;
  await tamu.goto(new URL(tautan).pathname);
  await tamu.getByLabel("Nama lengkap").fill(nama);
  await tamu.getByLabel("Nomor HP (WhatsApp)").fill(`0814${String(Date.now()).slice(-8)}`);
  await tamu.getByLabel(/CV: foto atau PDF/).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.concat([readFileSync(CV), Buffer.from(`\n%uji ${nama}\n`)]) });
  await tamu.getByRole("button", { name: "Kirim lamaran" }).click();
  await expect(tamu.getByTestId("lamaran-terkirim")).toBeVisible({ timeout: 60_000 });

  const wawancara = tamu.getByTestId("wawancara");
  await expect(wawancara).toBeVisible();
  await expect(wawancara.getByRole("listitem")).not.toHaveCount(0);
  await tamu.getByTestId("rekam-0").click();
  await expect(tamu.getByRole("timer")).toBeVisible();
  await tamu.waitForTimeout(3200);
  await tamu.getByTestId("berhenti-0").click();
  await expect(wawancara.locator("audio")).toHaveCount(1);
  await tamu.getByTestId("kirim-jawaban-0").click();
  await expect(tamu.getByTestId("jawaban-terkirim-0")).toBeVisible({ timeout: 30_000 });
  await expect(wawancara).toContainText("1 dari");

  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await tamu.setViewportSize({ width: lebar, height: tinggi });
      await tamu.emulateMedia({ colorScheme: skema });
      await tamu.waitForTimeout(400);
      const axe = await new AxeBuilder({ page: tamu }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await wawancara.screenshot({ path: test.info().outputPath(`wawancara-${lebar}-${skema}.png`) });
    }
  }
  await tamu.context().close();

  // Pemilik melihat jawaban berstatus masuk untuk lamaran ini (RLS: pemilik/admin perusahaan).
  const { data: la } = await sb.from("lamaran").select("id").eq("nama", nama).single();
  const { data: jw, error } = await sb.from("jawaban_wawancara").select("urutan, status, durasi_detik").eq("lamaran_id", la!.id);
  expect(error).toBeNull();
  expect(jw).toHaveLength(1);
  expect(jw![0].urutan).toBe(0);
  expect(jw![0].status).toBe("masuk");
  expect(Number(jw![0].durasi_detik)).toBeGreaterThan(2);
});
