import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// M-20B, LOKAL saja: pemilik membuat dua alur dari layar Alur, satu dengan jeda 0 (langsung) dan satu dengan jeda 2 jam; formulir
// dikirim dari layar; kartu alur jeda 0 langsung masuk Feed, alur berjeda menunggu (riwayat "menunggu jeda"), lalu alur berjeda
// dimatikan dan riwayatnya menjadi batal. Jalankan seperti e2e/mod.spec.ts (E2E_BASE_URL, E2E_LOKAL_URL, E2E_LOKAL_KUNCI).
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/alur-jeda-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("alur berjeda: jeda 0 langsung, jeda 2 jam menunggu, dimatikan membatalkan", async ({ page }) => {
  test.setTimeout(240_000);
  const email = `alur-jeda-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Toko Uji Jeda Layar", p_industri: "toko" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const fm = await sb.rpc("save_form", { p: { nama: "Permintaan pengingat", bidang: [{ kunci: "hal", label: "Hal", jenis: "teks", wajib: true }] } });
  expect(fm.error, fm.error?.message).toBeNull();

  const galat: string[] = [];
  page.on("pageerror", (e) => galat.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Falur");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/alur", { timeout: 60_000 });

  const buat = async (nama: string, kartu: string, jeda: string) => {
    const form = page.getByRole("form", { name: "Alur baru" });
    await form.getByLabel("Nama alur").fill(nama);
    await form.getByLabel("Ketika").selectOption({ label: "Formulir Permintaan pengingat dikirim" });
    await form.getByLabel("Judul kartu Feed").fill(kartu);
    await form.getByLabel("Jeda sebelum aksi (jam)").fill(jeda);
    await form.getByRole("button", { name: "Buat alur" }).click();
    await expect(page.locator("[data-testid=alur]").filter({ hasText: nama })).toBeVisible({ timeout: 30_000 });
  };
  await buat("Langsung ke Feed", "Langsung: {hal}", "0");
  await buat("Pengingat dua jam", "Ingat: {hal}", "2");
  const berjeda = page.locator("[data-testid=alur]").filter({ hasText: "Pengingat dua jam" });
  await expect(berjeda.getByTestId("alur-jeda")).toContainText("2 jam sebelum aksi");
  await expect(page.locator("[data-testid=alur]").filter({ hasText: "Langsung ke Feed" }).getByTestId("alur-jeda")).toHaveCount(0);

  // Kirim formulir dari layar yang sama.
  const isi = page.getByRole("form", { name: "Permintaan pengingat" });
  await isi.getByLabel("Hal").fill("Bayar listrik");
  await isi.getByRole("button", { name: "Kirim isian" }).click();
  await expect.poll(async () => (await sb.from("usulan").select("judul").eq("judul", "Langsung: Bayar listrik")).data?.length ?? 0, { timeout: 20_000 }).toBe(1);
  expect((await sb.from("usulan").select("judul").eq("judul", "Ingat: Bayar listrik")).data?.length ?? 0).toBe(0);
  await page.reload();
  await berjeda.getByText("Riwayat jalan").click();
  await expect(berjeda).toContainText("menunggu jeda");

  mkdirSync(LAYAR, { recursive: true });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `alur ${lebar} tanpa gulir samping`).toBe(true);
      await berjeda.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${LAYAR}/alur-jeda-${lebar}-${skema === "light" ? "terang" : "gelap"}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });

  // Dimatikan sebelum jatuh tempo: batal.
  await berjeda.getByRole("button", { name: "Matikan" }).click();
  await expect.poll(async () => (await sb.from("flow_tertunda").select("status")).data?.[0]?.status, { timeout: 20_000 }).toBe("batal");
  await page.reload();
  await berjeda.getByText("Riwayat jalan").click();
  await expect(berjeda).toContainText("batal karena alur dimatikan");
  expect(galat).toEqual([]);
});
