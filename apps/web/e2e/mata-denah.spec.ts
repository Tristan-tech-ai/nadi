import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// T-01D: kamera baru (berkas bernama unik per jalan, jadi sidiknya baru) -> bingkai kecil yang dikaburkan di perangkat -> model
// mengusulkan zona -> pengawas tanpa AI -> draf -> pemilik menyetujui. Berkas yang sama dibuka lagi: denah dikenal, dimuat tanpa
// model (baris pemakaian_ai usul_denah tidak bertambah = token 0). Akun uji A, usaha aktifnya (Warung Uji A).
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const VIDEO = readFileSync(join(__dirname, "..", "..", "..", "fixtures", "korpus", "mata", "video.webm"));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("Mata: denah kamera baru dipelajari sekali, kamera yang sama berikutnya tanpa AI", async ({ page }) => {
  test.setTimeout(300_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const hitung = async () => (await sb.from("pemakaian_ai").select("id", { count: "exact", head: true }).eq("tugas", "usul_denah")).count ?? 0;
  const berkas = { name: `kamera-${Date.now()}.webm`, mimeType: "video/webm", buffer: VIDEO };

  await page.goto("/masuk?next=/app/mata");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/mata");
  await page.waitForLoadState("networkidle");

  // Kamera baru: model mengusulkan, pesan belajar tampil, draf menunggu persetujuan.
  const sebelum = await hitung();
  await page.getByTestId("pilih-video").setInputFiles(berkas);
  await expect(page.getByTestId("usul-denah")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("usul-denah").click();
  await expect(page.getByText("Nadi sedang mempelajari format baru, sekali saja")).toBeVisible();
  await expect(page.getByTestId("setujui-denah")).toBeVisible({ timeout: 120_000 });
  expect(await hitung()).toBeGreaterThan(sebelum);
  await page.getByTestId("setujui-denah").click();
  await expect(page.getByTestId("setujui-denah")).toHaveCount(0, { timeout: 30_000 });
  const sesudah = await hitung();
  await expect(page.getByTestId("zona-mata").first()).toBeVisible();

  // Kamera yang sama lagi: denah aktif dimuat tanpa model.
  await page.reload();
  await page.waitForLoadState("networkidle"); // tunggu hidrasi: berkas yang dipilih sebelum itu tidak memicu onChange
  await page.getByTestId("pilih-video").setInputFiles(berkas);
  await expect(page.getByText("Denah kamera ini sudah dikenal. Zona dimuat tanpa AI.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("usul-denah")).toHaveCount(0);
  expect(await hitung()).toBe(sesudah);
  console.log("MATA_DENAH token usul pertama", sesudah - sebelum, "baris; kedua 0");
});
