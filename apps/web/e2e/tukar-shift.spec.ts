import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { tolakUsulanLama } from "./bersih";

// F3-06B: dua staf sintetis bertopi kasir uji. Sari menawarkan shift Senin depan 07.00-15.00; Budi (sudah punya 16.00-20.00 hari
// itu) mengambil, melihat peringatan lembur 4 jam, tetap mengambil; pemilik menyetujui di Feed; shift pindah ke jadwal Budi.
// Shift uji dibatalkan di akhir (bukan dihapus) supaya beban Warung Uji A tetap jam sama rata.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));
const PIN = "246813";

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

async function masukStaf(browser: Browser, kode: string, id: string): Promise<Page> {
  const p = await (await browser.newContext()).newPage();
  await p.goto("/masuk/staf");
  await p.getByLabel("Kode usaha").fill(kode);
  await p.getByLabel("ID kamu").fill(id);
  await p.getByLabel("PIN").fill(PIN);
  await p.getByRole("button", { name: "Masuk" }).click();
  await expect(p.getByTestId("peran")).toContainText("staf");
  await p.goto("/app/jadwal");
  return p;
}

test("tukar shift: tawarkan, ambil dengan peringatan lembur, pemilik setujui di Feed", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid as string;
  const { data: usaha } = await sb.from("perusahaan").select("nama, kode, zona_waktu").eq("id", pid).single();
  expect(usaha?.nama, "usaha aktif akun A harus Warung Uji A").toBe("Warung Uji A");
  await tolakUsulanLama(sb);
  const t = Date.now().toString(36);
  const { data: topi } = await sb.from("topi").insert({ perusahaan_id: pid, kode: `kasir_tukar_${t}`, nama: `Kasir Tukar ${t}` }).select("id").single();
  const orang: Record<string, { id: string; staf: string }> = {};
  for (const n of ["Sari", "Budi"]) {
    const { data: o } = await sb.from("orang").insert({ perusahaan_id: pid, nama: `${n} Tukar ${t}` }).select("id").single();
    expect((await sb.rpc("buat_akun_staf", { p_orang: o!.id, p_pin: PIN })).error).toBeNull();
    expect((await sb.from("pakai_topi").insert({ perusahaan_id: pid, orang_id: o!.id, topi_id: topi!.id })).error).toBeNull();
    const { data: s } = await sb.from("orang").select("id_staf").eq("id", o!.id).single();
    orang[n] = { id: o!.id, staf: s!.id_staf as string };
  }
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: usaha!.zona_waktu as string }).format(new Date());
  const d = new Date(`${hari}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (8 - (d.getUTCDay() || 7)));
  const senin = d.toISOString().slice(0, 10);
  const shiftSari = await sb.rpc("simpan_shift", { p_orang: orang.Sari.id, p_tanggal: senin, p_mulai: "07:00", p_selesai: "15:00", p_istirahat: 60, p_topi: topi!.id, p_kunci: crypto.randomUUID() });
  const shiftBudi = await sb.rpc("simpan_shift", { p_orang: orang.Budi.id, p_tanggal: senin, p_mulai: "16:00", p_selesai: "20:00", p_istirahat: 0, p_topi: null, p_kunci: crypto.randomUUID() });
  expect(shiftSari.error ?? shiftBudi.error).toBeNull();
  const idShift = [(shiftSari.data as { id: string }).id, (shiftBudi.data as { id: string }).id];

  try {
    const sari = await masukStaf(browser, usaha!.kode as string, orang.Sari.staf);
    const barisSari = sari.getByTestId("baris-jadwal-saya").filter({ hasText: "07.00-15.00" });
    await barisSari.getByRole("button", { name: "Tawarkan ke rekan" }).click();
    await expect(sari.getByTestId("baris-jadwal-saya").filter({ hasText: "07.00-15.00" })).toContainText("Ditawarkan");

    const budi = await masukStaf(browser, usaha!.kode as string, orang.Budi.staf);
    const kartu = budi.getByTestId("kartu-tawaran").filter({ hasText: `Ditawarkan Sari Tukar ${t}` });
    await expect(kartu).toContainText("07.00-15.00");
    await periksaUi(budi, "tukar-staf");
    await kartu.getByRole("button", { name: "Saya ambil" }).click();
    await expect(kartu.getByTestId("peringatan-ambil")).toContainText("Kamu jadi lembur 4 jam hari itu");
    await kartu.getByRole("button", { name: "Tetap ambil" }).click();
    // Setelah diambil, kartu tawaran hilang (bukan lagi terbuka) dan muncul catatan menunggu pemilik.
    await expect(budi.getByTestId("tukar-menunggu")).toContainText("Menunggu persetujuan pemilik");
    await sari.reload();
    await expect(sari.getByTestId("baris-jadwal-saya").filter({ hasText: "07.00-15.00" })).toContainText(`Diambil Budi Tukar ${t}, menunggu pemilik`);

    await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app");
    const usul = page.locator("article").filter({ hasText: `Sari Tukar ${t} menukar shift` }).last();
    await expect(usul).toContainText(`ke Budi Tukar ${t}. Budi Tukar ${t} jadi 11 jam minggu ini.`);
    await expect(usul).toContainText("sudah menyetujuinya saat mengambil");
    await usul.getByRole("button", { name: "Setujui" }).click();
    await expect(usul.getByTestId("hasil-putusan")).toBeVisible();

    await budi.reload();
    await expect(budi.getByTestId("baris-jadwal-saya").filter({ hasText: "07.00-15.00" })).toHaveCount(1);
    await sari.reload();
    await expect(sari.getByTestId("baris-jadwal-saya").filter({ hasText: "07.00-15.00" })).toHaveCount(0);
    await budi.context().close();
    await sari.context().close();
  } finally {
    for (const id of idShift) await sb.rpc("batal_shift", { p_id: id });
  }
});
