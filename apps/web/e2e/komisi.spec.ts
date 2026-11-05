import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// W-07C: barbershop (akun B, usaha "Uji Komisi E2E"): kapster menjual 2 potong rambut di kasir dengan akun stafnya sendiri, pemilik
// memasang komisi bawaan 10% di halaman Gaji, rekap menunjukkan Rp7.000, lalu draf gaji memuat komponen komisi di slip kapster.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Komisi E2E";

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

test("komisi: penjualan kasir kapster masuk rekap dan slip gaji", async ({ page }) => {
  test.setTimeout(240_000);
  const klien = () => createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const sb = klien();
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
    // Orang dan akun staf dari jalan sebelumnya tidak ikut.
    await sb.from("anggota").update({ aktif: false }).eq("perusahaan_id", pid).neq("peran", "pemilik").eq("aktif", true);
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const { data: usaha } = await sb.from("perusahaan").select("kode, zona_waktu").eq("id", pid).single();
    const hari = new Intl.DateTimeFormat("en-CA", { timeZone: usaha!.zona_waktu as string }).format(new Date());
    const nama = `Kapster ${Date.now().toString(36).toUpperCase()}`;
    const { data: o, error: eo } = await sb.from("orang").insert({ perusahaan_id: pid, nama, data: { mulai: hari } }).select("id").single();
    expect(eo).toBeNull();
    expect((await sb.from("orang_rahasia").upsert({ orang_id: o!.id, perusahaan_id: pid, gaji: { pokok: 4000000, ptkp: "TK/0" } }, { onConflict: "orang_id" })).error).toBeNull();
    const pin = "975318";
    expect((await sb.rpc("buat_akun_staf", { p_orang: o!.id, p_pin: pin })).error).toBeNull();
    const { data: os } = await sb.from("orang").select("id_staf").eq("id", o!.id).single();
    const { data: cukur, error: ep } = await sb.rpc("simpan_produk", { p: { kode: `CKR${Date.now().toString(36).toUpperCase()}`, nama: "Potong rambut", jenis: "jasa", satuan: "kali", harga_jual: 35000 } });
    expect(ep).toBeNull();

    // Kapster masuk dengan akun stafnya dan menjual 2 potong rambut.
    const staf = klien();
    expect((await staf.auth.signInWithPassword({ email: `${usaha!.kode}-${os!.id_staf}@staf.nadi.local`.toLowerCase(), password: pin })).error).toBeNull();
    const { data: sh, error: es } = await staf.rpc("pos_open_shift", { p_kas_awal: 0 });
    expect(es).toBeNull();
    expect((await staf.rpc("pos_record_sale", { p_shift: sh, p_kunci: crypto.randomUUID(), p_waktu: new Date().toISOString(),
      p_baris: [{ produk: cukur, jumlah: 2 }], p_bayar: "tunai", p_diterima: 70000, p_total_perangkat: 70000 })).error).toBeNull();

    await page.goto(`/masuk?next=${encodeURIComponent("/app/gaji")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/gaji");
    await page.waitForLoadState("networkidle");

    const f = page.getByRole("form", { name: "Aturan komisi" });
    await f.getByLabel("Berlaku untuk").selectOption({ label: "Semua produk dan jasa (bawaan)" });
    await f.getByLabel("Persen dari nilai penjualan").fill("10");
    await f.getByLabel("Rupiah per satuan terjual").fill("0");
    await f.getByRole("button", { name: "Simpan aturan komisi" }).click();
    await expect(f.getByRole("status")).toHaveText("Aturan komisi tersimpan.", { timeout: 30_000 });
    await expect(page.getByTestId("rekap-komisi")).toContainText(`${nama}: komisi Rp7.000 dari penjualan Rp70.000`);

    await page.getByRole("button", { name: /^(Siapkan gaji bulan ini|Hitung ulang draf)$/ }).click();
    await expect(page.getByText(/Draf gaji siap untuk \d+ orang/)).toBeVisible({ timeout: 60_000 });
    await page.reload();
    const slip = page.getByTestId("daftar-slip").getByRole("listitem").filter({ hasText: nama });
    await slip.getByText("Rincian").click();
    await expect(slip).toContainText("Komisi penjualan dan layanan");
    await expect(slip).toContainText("Rp7.000");
    await periksaUi(page, "gaji-komisi");
    await staf.auth.signOut({ scope: "local" });
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
