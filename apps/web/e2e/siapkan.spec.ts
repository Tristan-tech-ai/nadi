import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CONTOH_TEKS_NADI } from "../src/lib/onboarding/prompt";
import { KEPALA } from "../src/lib/onboarding/teks-nadi";

// U-04 (menggantikan alur W-04 lama): pemilik (akun A) menempel Teks Nadi hasil chat AI di /app/siapkan. Hasilnya SATU draf yang
// ditinjau: (1) draf 20 orang yang benar selesai dalam <= 3 klik (Buat draf, Terapkan) lalu dibatalkan sehingga data uji tidak
// menumpuk; (2) satu sel diubah dan satu baris dihapus tetap tersimpan setelah halaman dimuat ulang; baris gaji ditolak di pratinjau.
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
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

// Nama unik per jalan, huruf saja (nama orang ditolak bila berisi angka).
const huruf = (n: number) => { let s = ""; do { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } while (n > 0); return s; };

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target.join(" ")}`), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`) });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 900 });
}

test("draf AI: 20 baris diterapkan dalam 2 klik lalu dibatalkan; sel diubah dan baris dihapus tersimpan", async ({ page }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const tanda = huruf(Date.now() % 1e9);
  const nama = Array.from({ length: 20 }, (_, i) => `Uji ${tanda} ${huruf(i).padStart(2, "a")}`);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/masuk?next=${encodeURIComponent("/app/mulai/lanjut")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/mulai/lanjut");
  // Langkah 2 Mulai: dua pilihan sejajar.
  const pilihan = page.getByTestId("pilihan-isi");
  await expect(pilihan.getByRole("link", { name: /Isi sendiri/ })).toBeVisible();
  await periksaUi(page, "mulai-lanjut");
  await pilihan.getByRole("link", { name: /Siapkan dengan AI-mu/ }).click();
  await page.waitForURL((u) => u.pathname === "/app/siapkan");

  // Pratinjau tetap menolak gaji dari AI.
  const f = page.getByRole("form", { name: "Tempel hasil dari AI" });
  await f.getByLabel("Tempel hasil dari AI").fill(`${CONTOH_TEKS_NADI}\n- Budi Santoso | kasir | gaji Rp4.500.000`);
  await expect(page.getByTestId("pratinjau-teks-nadi").locator("[data-dikenali=tidak]")).toContainText("Gaji diisi sendiri");

  // (1) 20 orang: klik 1 Buat draf, klik 2 Terapkan.
  let klik = 0;
  await f.getByLabel("Tempel hasil dari AI").fill(`${KEPALA}\nORANG:\n${nama.map((n, i) => `- ${n} | ${i % 2 ? "kasir" : "pelayan"}`).join("\n")}`);
  await f.getByRole("button", { name: "Buat draf 20 baris untuk diperiksa" }).click(); klik++;
  await page.waitForURL((u) => /^\/app\/siapkan\/draf\/[0-9a-f-]{36}$/.test(u.pathname));
  const tinjau = page.getByTestId("tinjau-draf");
  await expect(page.getByTestId("ringkas-draf")).toHaveText("20 baris dari AI-mu. 20 tercentang, 0 perlu dicek.");
  await periksaUi(page, "tinjau-draf");
  await page.getByTestId("terapkan-draf").click(); klik++;
  await expect(tinjau.getByRole("status")).toContainText("20 baris diterapkan.", { timeout: 20_000 });
  expect(klik).toBeLessThanOrEqual(3);
  const { count: dibuat } = await sb.from("orang").select("id", { count: "exact", head: true }).like("nama", `Uji ${tanda} %`).eq("status", "aktif");
  expect(dibuat).toBe(20);
  // Jendela batal.
  await tinjau.getByRole("button", { name: "Batalkan" }).click();
  await expect(tinjau.getByRole("status")).toContainText("Draf dibatalkan");
  const { count: sisa } = await sb.from("orang").select("id", { count: "exact", head: true }).like("nama", `Uji ${tanda} %`).eq("status", "aktif");
  expect(sisa).toBe(0);

  // (2) Ubah sel dan hapus baris, lalu muat ulang.
  await page.goto("/app/siapkan");
  await f.getByLabel("Tempel hasil dari AI").fill(`${KEPALA}\nORANG:\n- ${nama[0]} | kasir\n- ${nama[1]} | koki\n- ${nama[2]} | kurir`);
  await f.getByRole("button", { name: "Buat draf 3 baris untuk diperiksa" }).click();
  await page.waitForURL((u) => /^\/app\/siapkan\/draf\/[0-9a-f-]{36}$/.test(u.pathname));
  const topi1 = page.getByLabel("Topi 1", { exact: true });
  await topi1.fill("barista");
  await topi1.press("Enter");
  await expect(page.locator("[data-bagian=orang] input[aria-label='Topi 1']")).toHaveValue("barista");
  await page.getByRole("button", { name: "Hapus baris 3" }).click();
  await expect(page.getByTestId("ringkas-draf")).toHaveText("2 baris dari AI-mu. 2 tercentang, 0 perlu dicek.");
  await page.reload();
  await expect(page.getByTestId("ringkas-draf")).toHaveText("2 baris dari AI-mu. 2 tercentang, 0 perlu dicek.");
  await expect(page.getByLabel("Topi 1", { exact: true })).toHaveValue("barista");
  const sisaNama = await page.locator("[data-bagian=orang] input[aria-label^='Nama ']").evaluateAll((xs) => xs.map((x) => (x as HTMLInputElement).value));
  expect(sisaNama.sort()).toEqual([nama[0], nama[1]].sort());
});
