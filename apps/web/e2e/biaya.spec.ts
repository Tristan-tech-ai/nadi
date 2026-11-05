import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-27: kartu biaya nyata Nadi di /app/perusahaan, angka sama dengan RPC nadi_cost, dalam bahasa Indonesia lalu Inggris.
// Akun B, usaha contoh "Toko Bu Sari" (berkasnya dibaca model sungguhan pada 5 Nov 2026, jadi angkanya tidak nol; hanya dibaca). Bahasa akun dikembalikan ke Indonesia di akhir.
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
  const kartu = page.getByTestId("biaya-nadi");
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).include("[data-testid=biaya-nadi]").analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await kartu.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

const rupiah = (n: number, b: "id" | "en") => `Rp${new Intl.NumberFormat(b === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 2 }).format(n)}`;
const angka = (n: number, b: "id" | "en") => Math.round(n).toLocaleString(b === "en" ? "en-US" : "id-ID");

test("biaya nyata: kartu di Usahamu sama dengan RPC sumber, id dan en", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  let inggris = false;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    const pid = ada?.[0]?.id as string;
    expect(pid).toBeTruthy();
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const { data: b, error } = await sb.rpc("nadi_cost");
    expect(error).toBeNull();
    const biaya = b as { token: number; berkas: number; idr: number; panggilan: number };
    expect(biaya.token, "usaha contoh punya pemakaian AI bulan ini").toBeGreaterThan(0);

    await page.goto(`/masuk?next=${encodeURIComponent("/app/perusahaan")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/perusahaan");
    if ((await page.getByTestId("pemilih-bahasa-app").innerText()) === "Bahasa Indonesia") {
      await page.getByTestId("pemilih-bahasa-app").click();
      await expect(page.getByTestId("pemilih-bahasa-app")).toHaveText("English");
    }
    const kartu = page.getByTestId("biaya-nadi");
    await expect(kartu.getByRole("heading", { level: 2 })).toContainText("Biaya Nadi untuk usahamu");
    await expect(kartu.getByTestId("biaya-token")).toHaveText(angka(biaya.token, "id"));
    await expect(kartu.getByTestId("biaya-berkas")).toHaveText(angka(biaya.berkas, "id"));
    await expect(kartu.getByTestId("biaya-rupiah")).toHaveText(rupiah(Number(biaya.idr), "id"));
    await expect(kartu.getByTestId("biaya-dasar")).toContainText(`Dari ${angka(biaya.panggilan, "id")} panggilan AI`);
    await periksaUi(page, "biaya-id");

    await page.getByTestId("pemilih-bahasa-app").click();
    inggris = true;
    await expect(page.getByTestId("pemilih-bahasa-app")).toHaveText("Bahasa Indonesia");
    await expect(kartu.getByRole("heading", { level: 2 })).toContainText("What Nadi costs for your business");
    await expect(kartu.getByTestId("biaya-token")).toHaveText(angka(biaya.token, "en"));
    await expect(kartu.getByTestId("biaya-rupiah")).toHaveText(rupiah(Number(biaya.idr), "en"));
    await expect(kartu).toHaveAttribute("lang", "en");
    await periksaUi(page, "biaya-en");
    await page.getByTestId("pemilih-bahasa-app").click();
    await expect(page.getByTestId("pemilih-bahasa-app")).toHaveText("English");
    inggris = false;
  } finally {
    if (inggris) {
      await page.getByTestId("pemilih-bahasa-app").click().catch(() => {});
      await expect(page.getByTestId("pemilih-bahasa-app")).toHaveText("English").catch(() => {});
    }
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
