import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-06C: pemilik mengisi kebutuhan (kasir uji 07.00-15.00 tiap hari, Sabtu sore butuh 3), meminta usulan untuk minggu dua pekan
// lagi, melihat kekurangan beralasan, lalu menyimpan. Topi dan orang uji unik per jalan; di akhir kebutuhan dihentikan dan shift
// uji dibatalkan (bukan dihapus) supaya usulan dan beban di Warung Uji A tidak terganggu jalan berikutnya.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

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

test("usulan jadwal: kebutuhan, usulkan, kekurangan beralasan, simpan", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid as string;
  const { data: usaha } = await sb.from("perusahaan").select("nama, zona_waktu").eq("id", pid).single();
  expect(usaha?.nama, "usaha aktif akun A harus Warung Uji A").toBe("Warung Uji A");
  const t = Date.now().toString(36);
  const namaTopi = `Kasir Usul ${t}`;
  const { data: topi } = await sb.from("topi").insert({ perusahaan_id: pid, kode: `kasir_usul_${t}`, nama: namaTopi }).select("id").single();
  const orang: string[] = [];
  for (const n of ["Rina", "Joko"]) {
    const { data: o } = await sb.from("orang").insert({ perusahaan_id: pid, nama: `${n} Usul ${t}` }).select("id").single();
    expect((await sb.from("pakai_topi").insert({ perusahaan_id: pid, orang_id: o!.id, topi_id: topi!.id })).error).toBeNull();
    orang.push(o!.id);
  }
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: usaha!.zona_waktu as string }).format(new Date());
  const d = new Date(`${hari}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (8 - (d.getUTCDay() || 7)) + 14);
  const senin = d.toISOString().slice(0, 10);

  try {
    await page.goto(`/masuk?next=${encodeURIComponent(`/app/jadwal?minggu=${senin}`)}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/jadwal");

    const f = page.getByRole("form", { name: "Kebutuhan orang" });
    await f.getByLabel("Topi").selectOption({ label: namaTopi });
    await f.getByRole("button", { name: "Simpan kebutuhan" }).click();
    await expect(f.getByRole("status")).toHaveText("Tersimpan untuk 7 hari.");
    // React mengosongkan formulir setelah aksi berhasil; topi dipilih lagi.
    await f.getByLabel("Topi").selectOption({ label: namaTopi });
    for (const h of ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Minggu"]) await f.getByLabel(h, { exact: true }).uncheck();
    await f.getByLabel("Butuh (orang)").fill("3");
    await f.getByLabel("Mulai").fill("16:00");
    await f.getByLabel("Selesai").fill("22:00");
    await f.getByLabel("Istirahat (menit)").fill("0");
    await f.getByRole("button", { name: "Simpan kebutuhan" }).click();
    await expect(f.getByRole("status")).toHaveText("Tersimpan untuk 1 hari.");
    await expect(page.getByTestId("daftar-kebutuhan").getByRole("listitem").filter({ hasText: namaTopi.toLowerCase() })).toHaveCount(8);

    await page.getByRole("button", { name: "Usulkan jadwal" }).click();
    const usulan = page.getByTestId("usulan-jadwal");
    await expect(usulan).toContainText("belum ada yang tersimpan");
    await expect(usulan.getByTestId("baris-usulan").filter({ hasText: `Usul ${t}` })).toHaveCount(8);
    await expect(usulan.getByTestId("usulan-kurang")).toContainText(`Sabtu 16.00-22.00: kurang 2 ${namaTopi.toLowerCase()}`);
    await periksaUi(page, "usulan-jadwal");

    await usulan.getByRole("button", { name: /^Simpan \d+ shift$/ }).click();
    await expect(page.getByTestId("hasil-simpan-usulan")).toContainText("shift tersimpan.");
    await expect(page.getByTestId("jadwal-minggu")).toContainText(`Rina Usul ${t}`);
    await expect(page.getByTestId("jadwal-minggu")).toContainText(`Joko Usul ${t}`);
    const { count } = await sb.from("shift").select("id", { count: "exact", head: true }).in("orang_id", orang).eq("status", "aktif");
    expect(count, "8 shift uji tersimpan: 7 pagi + 1 Sabtu sore (satu orang satu shift sehari, Sabtu sore kurang 2)").toBe(8);
  } finally {
    const { data: keb } = await sb.from("kebutuhan_shift").select("id").eq("topi_id", topi!.id).eq("aktif", true);
    for (const k of keb ?? []) await sb.rpc("henti_kebutuhan", { p_id: k.id });
    const { data: sh } = await sb.from("shift").select("id").in("orang_id", orang).eq("status", "aktif");
    for (const s of sh ?? []) await sb.rpc("batal_shift", { p_id: s.id });
  }
});
