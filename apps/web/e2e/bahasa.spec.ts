import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// I-02: bahasa id/en. Landing berganti bahasa lewat navigasi klien (tanpa muat ulang halaman), pilihan diingat cookie;
// di aplikasi pilihan tersimpan di akun (user_metadata) sehingga ikut ke sesi lain.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = bacaEnv(".env.e2e.local");

test.describe.configure({ mode: "serial" });

test("landing: ganti ke English tanpa muat ulang, cookie diingat, format angka en, axe bersih", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nadi yang merapikan");
  await page.evaluate(() => ((window as unknown as { __tanda: number }).__tanda = 7));
  await page.getByTestId("pemilih-bahasa").click();
  await page.waitForURL((u) => u.pathname === "/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nadi sorts it out.");
  // Navigasi klien: objek window yang sama, jadi halaman tidak dimuat ulang.
  expect(await page.evaluate(() => (window as unknown as { __tanda?: number }).__tanda)).toBe(7);
  await expect(page.locator("#harga li").nth(1)).toContainText("Rp149,000");
  await expect(page.locator("#harga li").nth(1)).toContainText("Business");
  await expect(page.locator("[lang=en]").first()).toBeVisible();

  // Cookie: beranda Indonesia mengalihkan ke /en sampai pengguna memilih Bahasa Indonesia lagi.
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(2600);
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${w} ${skema}`).toEqual([]);
      await page.screenshot({ path: info.outputPath(`en-${w}-${skema}.png`) });
    }
  }
  await page.getByTestId("pemilih-bahasa").click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nadi yang merapikan");
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
});

/** Teks isi layar aplikasi tanpa bagian bertanda lang="id" (isi yang memang ditulis dalam bahasa Indonesia). */
async function teksTanpaId(page: Page) {
  return page.locator("#isi").evaluate((el) => {
    const salin = el.cloneNode(true) as HTMLElement;
    salin.querySelectorAll('[lang="id"]').forEach((x) => x.remove());
    document.body.appendChild(salin);
    const t = salin.innerText;
    salin.remove();
    return t;
  });
}
const KATA_ID = /\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau|usulan|setujui|tolak|berkas|lempar)\b/i;

async function masuk(page: Page) {
  await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
}

test("aplikasi: pilihan bahasa tersimpan di akun dan ikut ke sesi lain, Feed dan Lempar berbahasa Inggris @bahasa-akun", async ({ browser }) => {
  test.skip(!E.E2E_SANDI, "butuh .env.e2e.local");
  const k1 = await browser.newContext();
  const p1 = await k1.newPage();
  await masuk(p1);
  const nav = p1.getByRole("navigation", { name: /Navigasi utama|Main navigation/ });
  if ((await p1.getByTestId("pemilih-bahasa-app").innerText()) === "Bahasa Indonesia") {
    // Sisa jalan sebelumnya yang gagal: kembalikan ke Indonesia dulu.
    await p1.getByTestId("pemilih-bahasa-app").click();
    await expect(p1.getByTestId("pemilih-bahasa-app")).toHaveText("English");
  }
  await expect(nav).toContainText("Feed");
  await expect(p1.getByRole("button", { name: "Keluar" })).toBeVisible();
  await p1.getByTestId("pemilih-bahasa-app").click();
  await expect(p1.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(p1.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

  // I-03 (b): Feed mode Inggris. Teks yang ditulis Nadi dalam bahasa Indonesia (isi usulan, insight) bertanda lang="id"
  // dan dikecualikan dari pemindaian; sisanya tidak boleh memuat kata Indonesia umum.
  await expect(p1.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await expect(p1.getByTestId("peran")).toHaveText("You are signed in as owner.");
  expect(await teksTanpaId(p1)).not.toMatch(KATA_ID);
  const axe = await new AxeBuilder({ page: p1 }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Lempar mode Inggris: berkas berjenis asing ditolak di perangkat dengan pesan Inggris, tanpa Coba lagi.
  await p1.goto("/app/lempar");
  await expect(p1.getByRole("heading", { level: 1, name: "Drop it" })).toBeVisible();
  await p1.getByTestId("input-berkas").setInputFiles({ name: "catatan.txt", mimeType: "text/plain", buffer: Buffer.from("halo") });
  await expect(p1.getByTestId("daftar-lempar")).toContainText("This file type cannot be read yet");
  await expect(p1.getByTestId("coba-lagi")).toHaveCount(0);
  expect(await teksTanpaId(p1)).not.toMatch(KATA_ID);
  const axeLempar = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeLempar.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Sesi baru tanpa cookie bahasa: pilihan datang dari akun.
  const k2 = await browser.newContext();
  const p2 = await k2.newPage();
  await masuk(p2);
  await expect(p2.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect((await k2.cookies()).some((c) => c.name === "nadi_bahasa")).toBe(false);

  // Kembalikan ke Indonesia agar spec lain tetap memakai teks Indonesia.
  await p2.getByTestId("pemilih-bahasa-app").click();
  await expect(p2.getByRole("button", { name: "Keluar" })).toBeVisible();
  await k1.close();
  await k2.close();
});

test("harga dua bahasa: /en/harga berbahasa Inggris, pemilih bolak-balik ke /harga, axe bersih", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  await page.goto("/en/harga");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pricing");
  await expect(page.locator("main")).toContainText("Rp149,000");
  await expect(page.getByRole("table")).toContainText("20 people");
  const teks = await page.locator("main").innerText();
  expect(teks).not.toMatch(/\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i);
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByTestId("pemilih-bahasa").click();
  await page.waitForURL((u) => u.pathname === "/harga");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harga");
});

test("keamanan dua bahasa: /en/keamanan berbahasa Inggris dan axe bersih", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  await page.goto("/en/keamanan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data security");
  await expect(page.locator("main h2")).toHaveCount(6);
  expect(await page.locator("main").innerText()).not.toMatch(/\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i);
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByTestId("pemilih-bahasa").click();
  await page.waitForURL((u) => u.pathname === "/keamanan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Keamanan data");
});

for (const [jalur, judul, idJudul] of [["/en/privasi", "Privacy policy", "Kebijakan privasi"], ["/en/syarat", "Terms of service", "Syarat layanan"]]) {
  test(`${jalur} berbahasa Inggris, tanda draf ada, axe bersih`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sekali (desktop)");
    await page.goto(jalur);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(judul);
    await expect(page.getByRole("note")).toContainText("not yet reviewed by a lawyer");
    expect(await page.locator("main").innerText()).not.toMatch(/\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.getByTestId("pemilih-bahasa").click();
    await page.waitForURL((u) => u.pathname === jalur.replace("/en", ""));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(idJudul);
  });
}

for (const [jalur, judul, idJudul, h2] of [["/en/tentang", "About Nadi", "Tentang Nadi", 3], ["/en/panduan", "Nadi guide", "Panduan Nadi", 4]] as const) {
  test(`${jalur} berbahasa Inggris dan axe bersih`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sekali (desktop)");
    await page.goto(jalur);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(judul);
    await expect(page.locator("main h2")).toHaveCount(h2);
    expect(await page.locator("main").innerText()).not.toMatch(/\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Guide by role" })).toHaveAttribute("href", "/en/panduan");
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.getByTestId("pemilih-bahasa").click();
    await page.waitForURL((u) => u.pathname === jalur.replace("/en", ""));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(idJudul);
  });
}
