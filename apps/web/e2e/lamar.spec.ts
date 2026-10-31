import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { tolakUsulanLama } from "./bersih";

// F2-01: pemilik membuat lowongan; tamu tanpa akun di HP (390 px) melamar dengan CV PDF korpus dalam < 2 menit;
// CV dibaca baca-berkas (pg_net, jalur token) dan usulan rekrut.pelamar muncul di Feed pemilik dalam 60 detik,
// dengan skor rubrik dari topi lowongan (F2-02).
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const CV = join(__dirname, "..", "..", "..", "fixtures", "korpus", "cv", "cv-01.pdf");

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("lamar tanpa akun: < 2 menit dari HP, CV menjadi usulan pelamar di Feed", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  // Topi Pelayan dari paket fnb (idempoten) agar lowongan punya rubrik.
  expect((await sb.rpc("pasang_paket", { p_kode: "fnb" })).error).toBeNull();
  await tolakUsulanLama(sb);
  await page.goto("/masuk?next=/app/orang");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/orang/);
  const judul = `Pelayan uji ${Date.now()}`;
  const kartu = page.getByTestId("kartu-lowongan");
  await kartu.getByLabel("Judul lowongan").fill(judul);
  await kartu.getByLabel("Topi (posisi)").selectOption({ label: "Pelayan" });
  await kartu.getByRole("button", { name: "Buat lowongan" }).click();
  const baris = kartu.getByTestId("daftar-lowongan").getByRole("listitem").filter({ hasText: judul });
  await expect(baris).toBeVisible();
  const tautan = (await baris.getByTestId("tautan-lamar").textContent())!.trim();

  // Tamu tanpa akun di HP. CV korpus diberi akhiran unik agar sha256 baru (berkas sama tidak diproses ulang).
  const tamu = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const nama = `Pelamar Uji ${Date.now()}`;
  const mulai = Date.now();
  await tamu.goto(new URL(tautan).pathname);
  await tamu.getByLabel("Nama lengkap").fill(nama);
  await tamu.getByLabel("Nomor HP (WhatsApp)").fill(`0813${String(Date.now()).slice(-8)}`);
  await tamu.getByLabel(/CV: foto atau PDF/).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.concat([readFileSync(CV), Buffer.from(`\n%uji ${nama}\n`)]) });
  await tamu.getByRole("button", { name: "Kirim lamaran" }).click();
  await expect(tamu.getByTestId("lamaran-terkirim")).toBeVisible({ timeout: 60_000 });
  const detik = (Date.now() - mulai) / 1000;
  expect(detik, `lamar selesai dalam ${detik} dtk`).toBeLessThan(120);
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await tamu.setViewportSize({ width: lebar, height: tinggi });
      await tamu.emulateMedia({ colorScheme: skema });
      await tamu.waitForTimeout(400);
      const axe = await new AxeBuilder({ page: tamu }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await tamu.screenshot({ path: test.info().outputPath(`lamar-${lebar}-${skema}.png`) });
    }
  }
  await tamu.context().close();

  // Usulan pelamar dari CV (nama di CV korpus: Wulan Astuti) untuk berkas lamaran ini, dalam 60 detik.
  let judulUsulan = "";
  for (let i = 0; i < 30 && !judulUsulan; i++) {
    const { data: la } = await sb.from("lamaran").select("berkas_id, status").eq("nama", nama).maybeSingle();
    if (la?.berkas_id) {
      const { data: u } = await sb.from("usulan").select("judul").eq("berkas_id", la.berkas_id).eq("aksi", "rekrut.pelamar").maybeSingle();
      judulUsulan = u?.judul ?? "";
    }
    if (!judulUsulan) await page.waitForTimeout(2000);
  }
  expect(judulUsulan).toContain("Wulan Astuti");
  await page.goto("/app");
  await expect(page.getByText(judulUsulan).first()).toBeVisible();
  // F2-02: kartu pelamar membawa skor rubrik topi Pelayan, tanpa atribut terlindungi.
  const kartuPelamar = page.locator("article").filter({ hasText: judulUsulan }).first();
  await expect(kartuPelamar.getByTestId("catatan-usulan")).toContainText(/Rubrik topi Pelayan: cocok \d dari \d \(skor \d+\)/);
  await expect(kartuPelamar.getByTestId("catatan-usulan")).toContainText("tidak dinilai");
});
