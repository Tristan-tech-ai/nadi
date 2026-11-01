import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-06: pemilik menyusun shift minggu depan (7 jam biasa, sore 3 jam = lembur menunggu persetujuan, lebih dari 4 jam lembur
// ditolak), staf melihat jadwalnya dan menyetujui lembur. Orang sintetis berakun staf unik per jalan di usaha aktif akun A.
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

test("jadwal: shift, lembur menunggu persetujuan, batas 4 jam, staf menyetujui", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid as string;
  const t = Date.now().toString(36);
  const nama = `Jadwal ${t}`;
  const { data: o } = await sb.from("orang").insert({ perusahaan_id: pid, nama }).select("id").single();
  expect((await sb.rpc("buat_akun_staf", { p_orang: o!.id, p_pin: PIN })).error).toBeNull();
  const { data: info } = await sb.from("orang").select("id_staf, perusahaan:perusahaan_id(kode, zona_waktu)").eq("id", o!.id).single();
  const usaha = info!.perusahaan as unknown as { kode: string; zona_waktu: string };
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: usaha.zona_waktu }).format(new Date());
  const d = new Date(`${hari}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (8 - (d.getUTCDay() || 7)));
  const senin = d.toISOString().slice(0, 10);

  await page.goto(`/masuk?next=${encodeURIComponent(`/app/jadwal?minggu=${senin}`)}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/jadwal");
  const isi = async (mulai: string, selesai: string, istirahat: string) => {
    const f = page.getByRole("form", { name: "Tambah shift" });
    await f.getByLabel("Orang").selectOption({ label: nama });
    await f.getByLabel("Tanggal").fill(senin);
    await f.getByLabel("Mulai").fill(mulai);
    await f.getByLabel("Selesai").fill(selesai);
    await f.getByLabel("Istirahat (menit)").fill(istirahat);
    await f.getByRole("button", { name: "Simpan shift" }).click();
    return f;
  };
  let f = await isi("07:00", "15:00", "60");
  await expect(f.getByRole("status")).toHaveText("Tersimpan.");
  f = await isi("18:00", "21:00", "0");
  await expect(f.getByRole("status")).toContainText("Selebihnya 3 jam dihitung lembur");
  f = await isi("21:30", "23:00", "0");
  await expect(f.getByRole("alert")).toContainText("Lembur paling lama 4 jam sehari");
  await expect(f.getByRole("alert")).toContainText("jadi 4,5 jam");
  const minggu = page.getByTestId("jadwal-minggu");
  await expect(minggu).toContainText(`${nama} 07.00-15.00, istirahat 60 menit`);
  await expect(minggu).toContainText("lembur menunggu persetujuan");
  await periksaUi(page, "jadwal-pemilik");

  const staf = await (await browser.newContext()).newPage();
  await staf.goto("/masuk/staf");
  await staf.getByLabel("Kode usaha").fill(usaha.kode);
  await staf.getByLabel("ID kamu").fill(info!.id_staf as string);
  await staf.getByLabel("PIN").fill(PIN);
  await staf.getByRole("button", { name: "Masuk" }).click();
  await expect(staf.getByTestId("peran")).toContainText("staf");
  await staf.goto("/app/jadwal");
  await expect(staf.getByTestId("jadwal-saya")).toContainText("18.00-21.00");
  const minta = staf.getByTestId("minta-lembur");
  await expect(minta).toContainText("3 jam");
  await periksaUi(staf, "jadwal-staf");
  await minta.getByRole("button", { name: "Setuju" }).click();
  // Setelah dijawab, permintaan lembur tidak lagi menunggu, jadi kartunya hilang dari layar staf.
  await expect(staf.getByTestId("minta-lembur")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("jadwal-minggu")).toContainText("lembur disetujui");
  await staf.context().close();

  // Bersihkan dengan membatalkan (bukan menghapus): shift aktif di Warung Uji A mengubah jam beban (beban_jadwal), dan
  // bagi-adil.spec memakai usaha yang sama dengan anggapan jam sama rata.
  const { data: sisa } = await sb.from("shift").select("id").eq("orang_id", o!.id).eq("status", "aktif");
  expect(sisa?.length).toBe(2);
  for (const s of sisa ?? []) expect((await sb.rpc("batal_shift", { p_id: s.id })).error).toBeNull();
});
