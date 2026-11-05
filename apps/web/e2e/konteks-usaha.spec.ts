import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// W-03: akun B menyiapkan usaha di Malaysia lewat formulir Mulai. Yang diperiksa:
// - mata uang MYR dan zona Asia/Kuala_Lumpur terisi sendiri;
// - Kompas Pajak dan Gaji tampil terkunci dengan alasannya;
// - formulir Mulai bersih axe.
// Batas 20 usaha per akun: usaha uji baru dibuat hanya bila akun B punya kurang dari 15 usaha, selain itu usaha uji yang ada dipakai
// ulang (formulir tetap dibuka dan diperiksa). Usaha aktif B dikembalikan di akhir.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL || !E.E2E_EMAIL_B, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("usaha di luar Indonesia: MYR dan zona terisi, pajak dan gaji terkunci dengan alasan", async ({ page }) => {
  test.setTimeout(120_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const awal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const { data: usaha } = await sb.from("perusahaan").select("id, nama, negara").order("dibuat_at");
  const lama = (usaha ?? []).find((u) => u.nama.startsWith("Uji Luar Negeri") && u.negara === "MY");
  const buatBaru = (usaha ?? []).length < 15 || !lama;
  try {
    await page.goto(`/masuk?next=${encodeURIComponent("/app/mulai")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/mulai");
    await page.getByLabel("Negara").selectOption("MY");
    await expect(page.getByTestId("negara-lain")).toContainText("aturan Indonesia");
    await expect(page.getByLabel("Zona waktu")).toHaveCount(0);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    if (buatBaru) {
      await page.getByLabel("Nama usaha").fill(`Uji Luar Negeri ${Date.now().toString(36)}`);
      await page.getByText("Toko, grosir, minimarket").click();
      await page.getByText("2 sampai 5").click();
      await page.getByLabel("Kota").fill("Kuala Lumpur");
      await page.getByRole("button", { name: "Siapkan usahaku" }).click();
      // U-04: langkah 2 Mulai menawarkan Isi sendiri atau Siapkan dengan AI-mu; tes ini melewatinya.
      await page.waitForURL((u) => u.pathname === "/app/mulai/lanjut");
      await page.getByRole("link", { name: "Lewati dulu, buka Hari ini" }).click();
      await page.waitForURL((u) => u.pathname === "/app");
    } else {
      expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: lama!.id })).error).toBeNull();
      await page.context().clearCookies();
      await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
      await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
      await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
      await page.getByRole("button", { name: "Masuk" }).click();
      await page.waitForURL((u) => u.pathname === "/app");
    }
    await sb.auth.refreshSession();
    const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
    const { data: p } = await sb.from("perusahaan").select("negara, mata_uang, zona_waktu, kota").eq("id", pid!).single();
    expect(p).toMatchObject({ negara: "MY", mata_uang: "MYR", zona_waktu: "Asia/Kuala_Lumpur", kota: "Kuala Lumpur" });

    await page.goto("/app/pajak");
    await expect(page.getByTestId("aturan-terkunci")).toContainText("Malaysia");
    await expect(page.getByTestId("aturan-terkunci")).toContainText("aturan Indonesia");
    await page.goto("/app/gaji");
    await expect(page.getByTestId("aturan-terkunci")).toBeVisible();
  } finally {
    if (awal) await sb.rpc("pindah_perusahaan", { p_perusahaan: awal });
  }
});
