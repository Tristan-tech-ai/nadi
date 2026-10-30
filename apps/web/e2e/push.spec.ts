import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test, type BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Web Push ujung ke ujung: berlangganan di Chromium, Edge Function mengirim lewat layanan push sungguhan, service worker menampilkannya.
function envUji(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(join(__dirname, "..", ".env.e2e.local"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    );
  } catch {
    return {};
  }
}
const E = envUji();

// Chrome menolak push di profil penyamaran ("Registration failed - permission denied"), padahal konteks bawaan Playwright
// adalah profil seperti itu. Jadi tes ini memakai profil persisten sekali pakai di Google Chrome (layanan push FCM sungguhan).

// Kedua tes memakai akun dan usaha yang sama; berurutan agar jumlah perangkat berlangganan tidak saling mengganggu.
test.describe.configure({ mode: "serial" });

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "dijalankan sekali (desktop) dan butuh .env.e2e.local");
});

test("nyalakan pemberitahuan lalu terima push uji", async ({ baseURL }) => {
  test.setTimeout(60_000);
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "nadi-push-")), {
    channel: "chrome",
    headless: true,
    baseURL,
    locale: "id-ID",
    viewport: { width: 1440, height: 900 },
  });
  await context.grantPermissions(["notifications"]);
  const page = await context.newPage();
  await page.goto("/masuk?next=/app/perusahaan");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/perusahaan/);

  const bagian = page.getByTestId("pemberitahuan");
  await expect(bagian).not.toHaveAttribute("data-keadaan", "memeriksa");
  if ((await bagian.getAttribute("data-keadaan")) === "menyala") {
    await page.getByRole("button", { name: "Matikan" }).click();
    await expect(bagian).toHaveAttribute("data-keadaan", "mati");
  }
  // Bersihkan pemberitahuan lama agar yang dihitung hanya kiriman tes ini.
  await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).forEach((n) => n.close()));

  await page.getByTestId("nyalakan-pemberitahuan").click();
  await expect(page.getByTestId("pesan-pemberitahuan")).toHaveText(/Pemberitahuan uji terkirim ke \d+ perangkat/, { timeout: 20_000 });
  await expect(bagian).toHaveAttribute("data-keadaan", "menyala");

  await expect
    .poll(async () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.title)), { timeout: 20_000 })
    .toContain("Pemberitahuan Nadi menyala");

  // Matikan lagi supaya akun uji tidak menimbun langganan.
  await page.getByRole("button", { name: "Matikan" }).click();
  await expect(bagian).toHaveAttribute("data-keadaan", "mati");
  await context.close();
});

// Usulan baru -> pg_cron (tiap menit, paling sering 5 menit sekali per usaha) -> pg_net -> Edge Function push -> FCM -> service worker.
test("usulan baru memunculkan pemberitahuan tanpa ada yang menekan tombol", async ({ baseURL }) => {
  test.setTimeout(9 * 60_000);
  const envLokal = Object.fromEntries(readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  const context: BrowserContext = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "nadi-push-")), { channel: "chrome", headless: true, baseURL, locale: "id-ID" });
  await context.grantPermissions(["notifications"]);
  const page = await context.newPage();
  await page.goto("/masuk?next=/app/perusahaan");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/perusahaan/);
  const bagian = page.getByTestId("pemberitahuan");
  await expect(bagian).not.toHaveAttribute("data-keadaan", "memeriksa");
  if ((await bagian.getAttribute("data-keadaan")) !== "menyala") {
    await page.getByTestId("nyalakan-pemberitahuan").click();
    await expect(bagian).toHaveAttribute("data-keadaan", "menyala", { timeout: 20_000 });
  }
  await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).forEach((n) => n.close()));

  // Usulan disisipkan langsung sebagai pemilik (kebijakan RLS usulan_tambah), seperti hasil baca berkas.
  const sb = createClient(envLokal.NEXT_PUBLIC_SUPABASE_URL, envLokal.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
  const { data: klaim } = await sb.auth.getClaims();
  const pid = (klaim?.claims.app_metadata as { pid: string }).pid;
  const judul = `Uji pemberitahuan ${Date.now()}`;
  const { error } = await sb.from("usulan").insert({ perusahaan_id: pid, sumber: "aturan", aksi: "berkas.tinjau", judul, payload: {} });
  expect(error).toBeNull();

  await expect
    .poll(async () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title} | ${n.body}`).join("\n")), { timeout: 7 * 60_000, intervals: [5000] })
    .toMatch(/usulan (baru )?menunggu keputusanmu/i);

  await page.getByRole("button", { name: "Matikan" }).click();
  await context.close();
});
