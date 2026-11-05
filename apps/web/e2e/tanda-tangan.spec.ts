import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-17: pemilik (akun B, usaha "Uji Tanda E2E") mengirim perjanjian ke dua penanda tangan berurutan; penanda kedua belum bisa
// mendahului; keduanya menandatangani dari tautan sekali pakai; layar menyebut jenis tanda tangan dengan jujur; halaman cek
// menyatakan isi dan jejak utuh, salinan sama cocok dan salinan yang diubah tidak cocok.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Tanda E2E";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("tanda tangan: dua penanda berurutan, jenis jujur, verifikasi menolak salinan yang diubah", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: USAHA, p_industri: "toko" });
      expect(error).toBeNull();
      pid = data as string;
    }
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const tanda = Date.now().toString(36).toUpperCase();
    const judul = `Perjanjian pasok kopi ${tanda}`;
    const isi = `Perjanjian pasok kopi ${tanda} antara ${USAHA} dan CV Maju. Harga Rp45.000 per kg, dibayar 14 hari setelah barang diterima.`;

    await page.goto(`/masuk?next=${encodeURIComponent("/app/tanda-tangan")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/tanda-tangan");
    await expect(page.getByTestId("jujur-tanda")).toContainText("tidak tersertifikasi");
    await page.waitForLoadState("networkidle");
    const f = page.getByRole("form", { name: "Dokumen baru" });
    await f.getByLabel("Judul").fill(judul);
    await f.getByLabel("Isi dokumen").fill(isi);
    await f.getByLabel(/^Penanda tangan/).fill("Rina Wulandari, 0812-1111-2222\nBagus Pratama");
    await f.getByLabel(/Bubuhkan cap/).check();
    await f.getByRole("button", { name: "Simpan dan kirim" }).click();
    const tautan = f.getByTestId("tautan-penanda");
    await expect(tautan).toHaveCount(2);
    const [u1, u2] = [(await tautan.nth(0).getAttribute("href"))!, (await tautan.nth(1).getAttribute("href"))!];
    expect(u1).toMatch(/\/tanda\/[0-9a-f]{48}$/);
    await expect(f.getByTestId("tautan-tanda")).toContainText("Bagikan lewat WhatsApp");
    await periksaUi(page, "tanda-pemilik");

    const s2 = await (await browser.newContext()).newPage();
    await s2.goto(new URL(u2).pathname);
    await expect(s2.getByTestId("bukan-giliran")).toContainText("Belum giliranmu");

    const s1 = await (await browser.newContext()).newPage();
    await s1.goto(new URL(u1).pathname);
    await expect(s1.getByTestId("jenis-tanda")).toContainText("Tanda tangan elektronik tidak tersertifikasi (PP 71/2019 Pasal 60 ayat (4))");
    await expect(s1.getByTestId("isi-dokumen")).toHaveText(isi);
    await s1.getByLabel("Ketik namamu: Rina Wulandari").fill("Rina Wulandari");
    await s1.getByLabel(/Saya sudah membaca/).check();
    await periksaUi(s1, "tanda-publik");
    await s1.getByRole("button", { name: "Tanda tangani" }).click();
    await expect(s1.getByTestId("hasil-tanda")).toContainText("Tanda tanganmu tercatat");
    await s1.goto(new URL(u1).pathname);
    await expect(s1.getByTestId("tanda-tidak-berlaku")).toBeVisible();

    await s2.reload();
    await s2.getByLabel("Ketik namamu: Bagus Pratama").fill("Bagus Pratama");
    await s2.getByLabel(/Saya sudah membaca/).check();
    await s2.getByRole("button", { name: "Tanda tangani" }).click();
    await expect(s2.getByTestId("hasil-tanda")).toContainText("Tanda tanganmu tercatat");

    const { data: doc } = await sb.from("sign_document").select("id, kode, status").eq("judul", judul).single();
    expect(doc!.status).toBe("selesai");
    const { data: ev } = await sb.from("sign_event").select("jenis, perangkat").eq("document_id", doc!.id).eq("jenis", "ditandatangani");
    expect(ev).toHaveLength(2);
    expect(ev!.every((e) => (e.perangkat ?? "").length > 0)).toBe(true);
    await page.reload();
    await expect(page.getByTestId("daftar-tanda").locator(`li[data-judul="${judul}"]`)).toHaveAttribute("data-status", "selesai");

    await s2.goto(`/tanda/cek/${doc!.kode}`);
    await expect(s2.getByTestId("hasil-cek")).toHaveAttribute("data-utuh", "ya");
    await expect(s2.getByTestId("penanda-cek")).toContainText("Bagus Pratama, ditandatangani");
    await s2.waitForLoadState("networkidle");
    await s2.getByLabel("Tempel isi dokumen yang kamu pegang").fill(isi);
    await s2.getByRole("button", { name: "Periksa" }).click();
    await expect(s2.getByTestId("hasil-cocok")).toHaveText("Salinanmu sama persis dengan dokumen yang ditandatangani.");
    await s2.getByLabel("Tempel isi dokumen yang kamu pegang").fill(isi.replace("45.000", "40.000"));
    await s2.getByRole("button", { name: "Periksa" }).click();
    await expect(s2.getByTestId("hasil-cocok")).toHaveText("Salinanmu BERBEDA dengan dokumen yang ditandatangani.");
    await s1.context().close();
    await s2.context().close();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
