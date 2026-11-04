import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-07B: kartu info "Beban dan kabar tim" di Feed pemilik: tanpa Setujui/Tolak, satu tombol utama ke tab beban, "Sudah
// ditangani" menutup kartu dan tercatat. Pembuatan kartu dari sinyal dan hak (admin/staf/JWT lama) diuji di
// supabase/tests/sinyal_beban.test.sql; di sini kartu disisipkan lewat klien pemilik agar tes bisa diulang.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

async function masuk(page: Page) {
  await page.goto("/masuk?next=/app");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
}

test("Feed: kartu Beban dan kabar tim untuk pemilik, lihat beban, sudah ditangani", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(120_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = (await sb.auth.getUser()).data.user?.app_metadata?.pid as string;
  const nama = `Sari Uji ${Date.now()}`;
  const { data: kartu, error } = await sb.from("usulan").insert({
    perusahaan_id: pid, sumber: "sinyal", aksi: "info.beban_tim",
    judul: `${nama} memikul 2,0 kali beban rata-rata tim, 3 minggu berturut-turut.`,
    penjelasan: "20,0, 20,0, 20,0 poin per 40 jam; rata-rata tim 10,0 poin.\nKabar izin sakit muncul setelah 12 minggu data.",
    payload: { orang_id: null, sinyal: ["berat"] },
  }).select("id").single();
  expect(error).toBeNull();

  await masuk(page);
  const k = page.getByTestId("kartu-info").filter({ hasText: nama });
  await expect(k).toBeVisible();
  await expect(k.getByRole("button", { name: "Setujui" })).toHaveCount(0);
  await expect(k).toContainText("Kabar izin sakit muncul setelah 12 minggu data.");
  await expect(k.getByRole("link", { name: "Lihat bebannya" })).toHaveAttribute("href", "/app/kerja?tab=beban");
  await k.scrollIntoViewIfNeeded();
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await k.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${w} ${skema}`).toEqual([]);
      await k.screenshot({ path: test.info().outputPath(`kartu-beban-${w}-${skema}.png`) });
    }
  }
  await k.getByRole("button", { name: "Sudah ditangani" }).click();
  await expect(k.getByTestId("info-ditangani")).toBeVisible();
  const { data: sesudah } = await sb.from("usulan").select("status, diputuskan_at").eq("id", kartu!.id).single();
  expect(sesudah?.status).toBe("diterima");
  expect(sesudah?.diputuskan_at).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("kartu-info").filter({ hasText: nama })).toHaveCount(0);
});
