import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Q-05: aksesibilitas per halaman. Untuk setiap halaman publik dan aplikasi (pemilik, akun uji A di Warung Uji A):
// axe tanpa pelanggaran serius/kritis di 390 dan 1440 px terang dan gelap, satu h1, lang id, papan ketik (12 Tab pertama
// selalu mendarat di elemen yang fokusnya terlihat dengan kontras cincin >= 3:1 terhadap latar, WCAG 1.4.11/2.4.7), dan di
// aplikasi Tab pertama adalah "Lompat ke isi" (WCAG 2.4.1). Hasil per halaman ditulis ke E2E_LAPORAN (JSON) bila diisi.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

type Hasil = { halaman: string; axe: Record<string, string[]>; h1: number; lang: string; fokus: { ok: boolean; catatan: string[] }; lompat: boolean | null };
const laporan: Hasil[] = [];

// Jalankan dengan --workers=1 supaya laporan dua tes tertulis dalam satu berkas; kegagalan halaman publik tidak menghentikan tes aplikasi.
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});
test.afterAll(() => {
  if (process.env.E2E_LAPORAN) writeFileSync(process.env.E2E_LAPORAN, JSON.stringify(laporan, null, 1));
});

async function fokusTerlihat(page: Page, jumlah = 12) {
  const catatan: string[] = [];
  for (let i = 0; i < jumlah; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const rgb = (t: string) => (t.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const k = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * k(r) + 0.7152 * k(g) + 0.0722 * k(b);
      };
      const a = lum(rgb(s.outlineColor));
      const b = lum(rgb(getComputedStyle(document.body).backgroundColor));
      return {
        nama: `${el.tagName.toLowerCase()}${el.getAttribute("type") ? `[type=${el.getAttribute("type")}]` : ""}${el.getAttribute("name") ? `[name=${el.getAttribute("name")}]` : ""} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" (${s.outlineStyle} ${s.outlineWidth})`,
        garis: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2,
        kontras: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
    if (!f) break;
    if (!f.garis) catatan.push(`${f.nama}: fokus tanpa garis`);
    else if (f.kontras < 3) catatan.push(`${f.nama}: kontras cincin fokus ${f.kontras.toFixed(2)}:1`);
  }
  return { ok: catatan.length === 0, catatan: [...new Set(catatan)].slice(0, 5) };
}

async function periksa(page: Page, jalur: string, aplikasi: boolean) {
  const axe: Record<string, string[]> = {};
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.goto(jalur);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await page.waitForTimeout(500);
      const r = await new AxeBuilder({ page }).analyze();
      axe[`${lebar}-${skema}`] = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.nodes.length})`);
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(jalur);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const h1 = await page.locator("h1").count();
  const lang = (await page.locator("html").getAttribute("lang")) ?? "";
  let lompat: boolean | null = null;
  if (aplikasi) {
    await page.keyboard.press("Tab");
    lompat = (await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")) === "Lompat ke isi";
    if (lompat) {
      await page.keyboard.press("Enter");
      lompat = await page.evaluate(() => document.activeElement?.id === "isi");
    }
    await page.goto(jalur);
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
  const fokus = await fokusTerlihat(page);
  laporan.push({ halaman: jalur, axe, h1, lang, fokus, lompat });
  return { axe, h1, lang, fokus, lompat };
}

function harus(jalur: string, h: Awaited<ReturnType<typeof periksa>>, aplikasi: boolean) {
  expect.soft(Object.values(h.axe).flat(), `${jalur} axe`).toEqual([]);
  expect.soft(h.h1, `${jalur} satu h1`).toBe(1);
  expect.soft(h.lang, `${jalur} lang`).toBe("id");
  expect.soft(h.fokus.catatan, `${jalur} fokus terlihat`).toEqual([]);
  if (aplikasi) expect.soft(h.lompat, `${jalur} lompat ke isi`).toBe(true);
}

test("halaman publik", async ({ page }) => {
  test.setTimeout(600_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const inv = (await sb.from("invoice").select("kode_verifikasi").limit(1).maybeSingle()).data?.kode_verifikasi;
  const surat = (await sb.from("surat_keluar").select("kode_verifikasi").not("kode_verifikasi", "is", null).limit(1).maybeSingle()).data?.kode_verifikasi;
  const low = (await sb.from("lowongan").select("kode").eq("buka", true).limit(1).maybeSingle()).data?.kode;
  const daftar = ["/", "/demo", "/demo/toko", "/masuk", "/daftar", "/masuk/staf", "/luring", "/lamar/status", "/slip",
    ...(inv ? [`/i/${inv}`] : []), ...(surat ? [`/v/${surat}`] : []), ...(low ? [`/lamar/${low}`] : [])];
  for (const jalur of daftar) harus(jalur, await periksa(page, jalur, false), false);
});

test("halaman aplikasi pemilik", async ({ page }) => {
  test.setTimeout(1_500_000);
  await page.goto("/masuk?next=/app");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  await expect(page.getByTestId("nama-perusahaan")).toHaveText("Warung Uji A");
  const daftar = ["/app", "/app/perusahaan", "/app/orang", "/app/gaji", "/app/izin", "/app/invoice", "/app/pajak", "/app/akuntan",
    "/app/jadwal", "/app/kerja", "/app/surat", "/app/surat-keluar", "/app/lempar", "/app/magang", "/app/serah-terima", "/app/mulai"];
  // /app/skill bukan layar: route yang mengunduh berkas skill.
  const pilih = process.env.E2E_A11Y_HALAMAN?.split(",");
  for (const jalur of daftar.filter((j) => !pilih || pilih.includes(j))) harus(jalur, await periksa(page, jalur, true), true);
});
