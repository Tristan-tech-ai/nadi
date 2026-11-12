import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-07: karyawan sintetis berakun staf berhenti (tanggal efektif kemarin di zona usaha): paket berisi topi, kerja dengan usulan
// pengganti, akses otomatis (akun Nadi) dan manual; kerja dipindah ke pengganti; akses manual dicentang. Sebelum dicatat akun
// stafnya bisa masuk. Pencabutan sendiri dijalankan pg_cron tiap jam (diuji tes SQL serah_terima dan diperiksa setelah e2e produksi).
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));
export const PIN_SERAH = "135791";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("serah terima: paket, pengganti, pindah kerja, akses manual", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid as string;
  const t = Date.now().toString(36);
  const nama = `Sari Serah ${t}`;
  const rekan = `Rekan Serah ${t}`;
  const { data: topi, error: eTopi } = await sb.from("topi").insert({ perusahaan_id: pid, kode: `kasir_serah_${t}`, nama: `Kasir Serah ${t}` }).select("id").single();
  expect(eTopi).toBeNull();
  const { data: org, error: eOrang } = await sb.from("orang").insert([{ perusahaan_id: pid, nama }, { perusahaan_id: pid, nama: rekan }]).select("id, nama");
  expect(eOrang).toBeNull();
  const sari = org!.find((o) => o.nama === nama)!.id as string;
  const idRekan = org!.find((o) => o.nama === rekan)!.id as string;
  const { data: kemarin } = await sb.from("perusahaan").select("kode, zona_waktu").eq("id", pid).single();
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: kemarin!.zona_waktu }).format(new Date(Date.now() - 86_400_000));
  expect((await sb.from("pakai_topi").insert([sari, idRekan].map((orang_id) => ({ perusahaan_id: pid, orang_id, topi_id: topi!.id, porsi: 100, mulai: hari })))).error).toBeNull();
  const { data: kerja } = await sb.from("kerja").insert({ perusahaan_id: pid, judul: `Tutup kas ${t}`, topi_id: topi!.id, pelaksana_id: sari, status: "baru" }).select("id").single();
  expect((await sb.rpc("buat_akun_staf", { p_orang: sari, p_pin: PIN_SERAH })).error).toBeNull();
  const { data: o } = await sb.from("orang").select("id_staf").eq("id", sari).single();
  const email = `${kemarin!.kode}-${o!.id_staf}@staf.nadi.local`.toLowerCase();
  const staf = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await staf.auth.signInWithPassword({ email, password: PIN_SERAH })).error, "akun staf masih bisa masuk sebelum berhenti").toBeNull();

  await page.goto(`/masuk?next=${encodeURIComponent(`/app/serah-terima?orang=${sari}`)}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/serah-terima");
  const form = page.getByRole("form", { name: "Catat berhenti" });
  await expect(form.getByLabel("Siapa yang berhenti").locator("option:checked")).toHaveText(nama);
  await form.getByLabel("Tanggal surat diterima").fill(hari);
  await form.getByLabel("Tanggal efektif (hari kerja terakhir)").fill(hari);
  await form.getByRole("button", { name: "Siapkan paket serah terima" }).click();
  await expect(form.getByText("Paket serah terima disiapkan.")).toBeVisible();

  const paket = page.getByTestId("paket-serah").filter({ hasText: `Serah terima ${nama}` });
  await expect(paket).toContainText("Dicabut segera");
  await expect(paket).toContainText("Pasal 231 huruf i");
  await expect(paket.getByTestId("butir-kerja")).toContainText(`Usulan pengganti: ${rekan}`);
  await expect(paket.getByTestId("akses-otomatis")).toContainText("Akun Nadi (staf)");
  await expect(paket.getByTestId("akses-manual").getByRole("listitem")).toHaveCount(4);
  await periksaUi(page, "serah-terima");

  await paket.getByRole("button", { name: "Pindahkan 1 kerja ke pengganti" }).click();
  await expect(paket.getByText("1 kerja dipindah ke penggantinya.")).toBeVisible();
  const { data: dipindah } = await sb.from("kerja").select("pelaksana_id").eq("id", kerja!.id).single();
  expect(dipindah!.pelaksana_id).toBe(idRekan);
  await paket.getByRole("button", { name: "Tandai beres: Grup WhatsApp kerja" }).click();
  await expect(paket.getByTestId("akses-manual")).toContainText("Grup WhatsApp kerja (beres)");
});
