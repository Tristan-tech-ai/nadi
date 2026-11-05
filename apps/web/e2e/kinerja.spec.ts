import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-13: satu siklus review penuh. Pemilik (akun B, usaha "Uji Kinerja E2E") membuka siklus untuk Budi, Budi masuk dengan akun stafnya
// dan mengisi penilaian diri, pemilik melihat ringkasan dan mengkalibrasi potensi tinggi sehingga Budi masuk kotak Bintang, lalu menutup
// siklus. Budi tidak melihat ringkasan, kalibrasi, maupun peta 9-box.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Kinerja E2E";

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

test("kinerja: satu siklus review diri sampai kalibrasi 9-box, nilai rahasia bagi yang dinilai", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: USAHA, p_industri: "toko" });
      expect(error).toBeNull();
      pid = data as string;
    }
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    await sb.from("anggota").update({ aktif: false }).eq("perusahaan_id", pid).neq("peran", "pemilik").eq("aktif", true);
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const tanda = Date.now().toString(36).toUpperCase();
    const nama = `Budi ${tanda}`;
    const siklus = `Review ${tanda}`;
    const { data: o, error: eo } = await sb.from("orang").insert({ perusahaan_id: pid, nama }).select("id").single();
    expect(eo).toBeNull();
    const pin = "468024";
    expect((await sb.rpc("buat_akun_staf", { p_orang: o!.id, p_pin: pin })).error).toBeNull();
    const { data: os } = await sb.from("orang").select("id_staf").eq("id", o!.id).single();
    const { data: us } = await sb.from("perusahaan").select("kode").eq("id", pid).single();

    await page.goto(`/masuk?next=${encodeURIComponent("/app/kinerja")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/kinerja");
    await page.waitForLoadState("networkidle");
    const fs = page.getByRole("form", { name: "Siklus review baru" });
    await fs.getByLabel("Nama siklus").fill(siklus);
    await fs.getByLabel(nama).check();
    await fs.getByRole("button", { name: "Buka siklus" }).click();
    await expect(fs.getByRole("status")).toHaveText("Siklus dibuka.", { timeout: 30_000 });
    const blok = page.getByTestId("siklus").filter({ hasText: siklus });
    await expect(blok.getByTestId("ringkas-review").filter({ hasText: nama })).toContainText("0/1");

    // Budi mengisi penilaian diri dari akun stafnya.
    const staf = await (await browser.newContext()).newPage();
    await staf.goto("/masuk/staf");
    await staf.getByLabel("Kode usaha").fill(us!.kode as string);
    await staf.getByLabel("ID kamu").fill(os!.id_staf as string);
    await staf.getByLabel("PIN").fill(pin);
    await staf.getByRole("button", { name: "Masuk" }).click();
    await staf.waitForURL((u) => u.pathname.startsWith("/app"));
    await staf.goto("/app/kinerja");
    const fr = staf.getByRole("form", { name: `${siklus}. Penilaian diri: ${nama}` });
    for (const k of ["Kualitas kerja", "Kerja sama", "Inisiatif", "Disiplin"]) await fr.getByLabel(k, { exact: true }).selectOption("4");
    await fr.getByLabel("Catatan (opsional)").fill("Target bulan ini tercapai");
    await fr.getByRole("button", { name: "Kirim review" }).click();
    // Terkirim: tugas hilang dari daftar.
    await expect(staf.getByText("Tidak ada review yang menunggu.")).toBeVisible({ timeout: 30_000 });
    await staf.reload();
    await expect(staf.getByText("Peta 9-box")).toHaveCount(0);
    await expect(staf.getByTestId("ringkas-review")).toHaveCount(0);

    // Pemilik: ringkasan, kalibrasi potensi tinggi = Bintang, tutup siklus.
    await page.reload();
    const baris = page.getByTestId("siklus").filter({ hasText: siklus }).getByTestId("ringkas-review").filter({ hasText: nama });
    await expect(baris).toContainText("1/1");
    const kal = page.getByRole("form", { name: `Kalibrasi ${nama}` }).first();
    await kal.getByLabel("Potensi").selectOption("3");
    await kal.getByRole("button", { name: /^Simpan kalibrasi/ }).click();
    await expect(kal.getByRole("status")).toHaveText("Kalibrasi tersimpan: Bintang.", { timeout: 30_000 });
    await expect(page.getByTestId("siklus").filter({ hasText: siklus }).getByTestId("grid-9box")).toContainText(nama);
    await periksaUi(page, "kinerja");
    await page.getByTestId("siklus").filter({ hasText: siklus }).getByRole("button", { name: "Tutup siklus" }).click();
    await expect(page.getByTestId("siklus").filter({ hasText: siklus })).toHaveAttribute("data-status", "selesai", { timeout: 30_000 });
    await staf.context().close();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
