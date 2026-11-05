import { createHmac } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// M-21: akun uji B menyalakan verifikasi dua langkah di /app/akun/keamanan; sesi kata sandi saja (aal1) ditolak database; masuk lagi
// meminta kode di /masuk/2fa; log mencatat kode benar; 2FA dimatikan lagi dan perangkat lain dikeluarkan. Kunci rahasia disimpan
// sementara di folder temp agar faktor bisa dibersihkan bila tes terputus di tengah.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const RAHASIA = join(tmpdir(), "nadi-e2e-2fa-b.txt");

/** TOTP RFC 6238 (SHA-1, 30 detik, 6 angka) dari kunci base32. */
function totp(base32: string, t = Date.now()) {
  const abjad = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bit = "";
  for (const c of base32.replace(/=+$/, "").toUpperCase()) bit += abjad.indexOf(c).toString(2).padStart(5, "0");
  const kunci = Buffer.from(bit.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const hitung = Buffer.alloc(8);
  hitung.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / 30)));
  const h = createHmac("sha1", kunci).update(hitung).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
/** Tunggu jendela 30 detik berikutnya agar kode yang sama tidak dipakai dua kali. */
const jendelaBaru = async (p: Page) => p.waitForTimeout(30_000 - (Date.now() % 30_000) + 1500);

const klien = () => createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
async function bersihkan() {
  const sb = klien();
  if ((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error) return;
  const { data } = await sb.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    if (f.status === "verified" && existsSync(RAHASIA)) {
      await new Promise((r) => setTimeout(r, 30_000 - (Date.now() % 30_000) + 1500));
      await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(readFileSync(RAHASIA, "utf8").trim()) });
    }
    await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  await sb.auth.signOut({ scope: "local" });
}

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

async function masuk(page: Page) {
  await page.goto(`/masuk?next=${encodeURIComponent("/app/akun/keamanan")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("2FA: nyalakan, sesi kata sandi saja ditolak database, masuk dengan kode, matikan", async ({ page }) => {
  test.setTimeout(300_000);
  await bersihkan();
  try {
    await masuk(page);
    await page.waitForURL((u) => u.pathname === "/app/akun/keamanan");
    const dua = page.getByTestId("dua-langkah");
    await expect(dua).toHaveAttribute("data-aktif", "tidak");
    await dua.getByRole("button", { name: "Nyalakan verifikasi dua langkah" }).click();
    const kunci = (await dua.getByTestId("kunci-2fa").textContent())!.trim();
    writeFileSync(RAHASIA, kunci);
    await expect(dua.getByRole("img", { name: "Kode QR verifikasi dua langkah" })).toBeVisible();
    await dua.getByLabel("Kode 6 angka").fill(totp(kunci));
    await dua.getByRole("button", { name: "Aktifkan" }).click();
    await expect(dua.getByRole("status")).toHaveText("Verifikasi dua langkah aktif.");
    await expect(dua).toHaveAttribute("data-aktif", "ya");

    // Database: sesi kata sandi saja tidak mendapat usaha; setelah kode benar terbuka.
    const sb2: SupabaseClient = klien();
    expect((await sb2.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
    expect((await sb2.rpc("pos_products")).error?.code).toBe("42501");
    await jendelaBaru(page);
    const { data: fs } = await sb2.auth.mfa.listFactors();
    expect((await sb2.auth.mfa.challengeAndVerify({ factorId: fs!.totp[0].id, code: totp(kunci) })).error).toBeNull();
    expect((await sb2.rpc("pos_products")).error).toBeNull();

    // Masuk ulang dari peramban: kode diminta, tujuan dipertahankan.
    await page.context().clearCookies();
    await masuk(page);
    await page.waitForURL((u) => u.pathname === "/masuk/2fa");
    await jendelaBaru(page);
    await page.getByLabel("Kode 6 angka").fill("000000");
    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.getByText("Kode tidak cocok. Periksa jam HP")).toBeVisible();
    await page.getByLabel("Kode 6 angka").fill(totp(kunci));
    await page.getByRole("button", { name: "Lanjut" }).click();
    await page.waitForURL((u) => u.pathname === "/app/akun/keamanan");
    await expect(page.locator('[data-testid=log][data-jenis="2fa.lolos"]').first()).toBeVisible();
    await expect(page.locator('[data-testid=log][data-jenis="2fa.aktif"]').first()).toBeVisible();
    await periksaUi(page, "keamanan");

    // Matikan lagi, lalu keluarkan perangkat lain (sb2 ikut keluar).
    await page.getByTestId("dua-langkah").getByRole("button", { name: "Matikan verifikasi dua langkah" }).click();
    await expect(page.getByTestId("dua-langkah")).toHaveAttribute("data-aktif", "tidak", { timeout: 20_000 });
    rmSync(RAHASIA, { force: true });
    await page.getByRole("button", { name: "Keluar dari semua perangkat lain" }).click();
    await page.waitForLoadState("networkidle");
    // Sesi lain dicabut: token penyegar sb2 tidak berlaku lagi (token akses yang sudah terbit tetap sampai kedaluwarsa).
    await expect.poll(async () => (await sb2.auth.refreshSession()).error !== null, { timeout: 30_000 }).toBe(true);
  } finally {
    await bersihkan();
  }
});
