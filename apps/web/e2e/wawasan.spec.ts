import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-23: dasbor wawasan dan pembuat laporan. Akun B, usaha contoh "Toko Bu Sari" (hanya dibaca). Angka di layar sama dengan RPC
// insight_dashboard; laporan invoice dengan dua kolom tampil dan terunduh sebagai CSV dengan jumlah baris sama dengan tabel sumber.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Toko Bu Sari";

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

const rp = (n: number) => `Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(Math.abs(n))}`;

test("wawasan: angka sama dengan RPC sumber, laporan invoice dua kolom terunduh CSV", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    const pid = ada?.[0]?.id as string;
    expect(pid).toBeTruthy();
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const { data: w, error } = await sb.rpc("insight_dashboard");
    expect(error).toBeNull();
    const W = w as { hr: { aktif: number; hadir_hari_ini: number }; bisnis: { pendapatan_bulan: number; laba_bulan: number; invoice_terbuka: { nilai: number } } };
    const { count } = await sb.from("invoice").select("id", { count: "exact", head: true });
    expect(count ?? 0, "usaha contoh punya invoice").toBeGreaterThan(0);

    await page.goto(`/masuk?next=${encodeURIComponent("/app/wawasan")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/wawasan");
    await expect(page.getByTestId("ws-aktif")).toHaveText(String(W.hr.aktif));
    await expect(page.getByTestId("ws-hadir")).toHaveText(String(W.hr.hadir_hari_ini));
    await expect(page.getByTestId("ws-pendapatan")).toHaveText(rp(W.bisnis.pendapatan_bulan));
    await expect(page.getByTestId("ws-laba")).toContainText(rp(W.bisnis.laba_bulan));
    await expect(page.getByTestId("ws-terbuka")).toHaveText(rp(W.bisnis.invoice_terbuka.nilai));
    await expect(page.getByTestId("ws-berisiko")).toBeVisible();

    // Laporan: invoice, kolom Nomor dan Total saja.
    const f = page.getByRole("form", { name: "Susun laporan" });
    await f.getByLabel("Sumber").selectOption("invoice");
    await f.getByRole("button", { name: "Tampilkan" }).click();
    await page.waitForURL((u) => u.searchParams.get("sumber") === "invoice");
    await page.waitForLoadState("networkidle");
    // Navigasi bawah sticky menutupi bagian bawah layar: gulir tiap kotak ke tengah dulu.
    for (const k of ["Pelanggan", "Tanggal", "Jatuh tempo", "Status", "Tanggal lunas"]) {
      const kotak = f.getByLabel(k, { exact: true });
      await kotak.evaluate((e) => e.scrollIntoView({ block: "center" }));
      await kotak.uncheck();
    }
    await f.getByRole("button", { name: "Tampilkan" }).click();
    await page.waitForURL((u) => u.searchParams.getAll("kolom").join(",") === "nomor,total");
    await expect(page.getByRole("region", { name: "Pratinjau laporan" }).getByRole("columnheader")).toHaveText(["Nomor", "Total"]);
    await expect(page.getByTestId("ws-baris")).toHaveCount(Math.min(20, count!));
    const [unduh] = await Promise.all([page.waitForEvent("download"), page.getByTestId("ws-unduh").click()]);
    expect(unduh.suggestedFilename()).toBe("laporan-invoice.csv");
    const isi = readFileSync((await unduh.path())!, "utf8").replace(/^﻿/, "").trim().split(/\r\n/);
    expect(isi[0]).toBe("Nomor;Total");
    expect(isi).toHaveLength(count! + 1);
    // Kolom di luar daftar putih di URL diabaikan.
    await page.goto("/app/wawasan?sumber=invoice&kolom=kode_verifikasi&kolom=nomor");
    await expect(page.getByRole("region", { name: "Pratinjau laporan" }).getByRole("columnheader")).toHaveText(["Nomor"]);
    await page.goto("/app/wawasan");
    await periksaUi(page, "wawasan");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
