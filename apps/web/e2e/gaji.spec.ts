import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F1-05: isi gaji Rp8.000.000 TK/0 di halaman Orang, siapkan gaji, PPh 21 Rp125.448 (TER A 1,5% x bruto 8.363.200) dan peringatan
// JP tampil, setujui, bagikan, slip terbuka tanpa akun. Memakai usaha khusus "Uji Gaji E2E" milik akun A dan bulan yang belum pernah
// dipakai (periode yang disetujui terkunci), lalu usaha aktif dikembalikan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const NAMA_USAHA = "Uji Gaji E2E";
const NAMA_USAHA_LEMBUR = "Uji Lembur E2E";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});
// Berurutan: usaha aktif melekat di akun A (klaim JWT), jadi dua tes yang memanggil pindah_perusahaan tidak boleh jalan bersamaan.
test.describe.configure({ mode: "serial" });

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("gaji: isi gaji, siapkan, PPh 21 sesuai TER, setujui, bagikan, slip terbuka tanpa akun", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", NAMA_USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: NAMA_USAHA, p_industri: "fnb" });
      expect(error).toBeNull();
      pid = data as string;
    } else {
      expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    }
    await sb.auth.refreshSession();
    // Orang dari jalan sebelumnya tidak ikut digaji lagi; bulan baru yang belum punya periode (bukan Desember: masa Pasal 17).
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const { data: per } = await sb.from("periode_gaji").select("bulan").eq("perusahaan_id", pid);
    const dipakai = new Set((per ?? []).map((p) => (p.bulan as string).slice(0, 7)));
    let bulan = "";
    for (let i = 2026 * 12 + 10; !bulan; i++) {
      const b = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
      if (!b.endsWith("-12") && !dipakai.has(b)) bulan = b;
    }
    const nama = `Karyawan Gaji ${Date.now()}`;
    // Mulai bekerja pertengahan bulan itu: belum 30 hari, jadi Gerbang Gaji tidak menuntut absen.
    expect((await sb.from("orang").insert({ perusahaan_id: pid, nama, data: { mulai: `${bulan}-15` } })).error).toBeNull();

    await page.goto("/masuk?next=/app/orang");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL(/\/app\/orang/);
    const baris = page.getByRole("listitem").filter({ hasText: nama });
    await baris.getByText("Gaji belum diisi").click();
    const form = baris.getByRole("form", { name: `Gaji ${nama}` });
    await form.getByLabel("Gaji pokok (Rp)").fill("8000000");
    await form.getByLabel("Status PTKP").selectOption("TK/0");
    await form.getByRole("button", { name: `Simpan gaji ${nama}` }).click();
    await expect(form.getByText("Tersimpan.")).toBeVisible();

    await page.goto(`/app/gaji?bulan=${bulan}`);
    await page.getByRole("button", { name: "Siapkan gaji bulan ini" }).click();
    await expect(page.getByText("Draf gaji siap untuk 1 orang.")).toBeVisible();
    await page.reload();
    const slip = page.getByTestId("daftar-slip").getByRole("listitem").filter({ hasText: nama });
    // Neto = 8.000.000 - BPJS Kes 80.000 - JHT 160.000 - PPh 21 125.448 = 7.634.552.
    await expect(slip).toContainText("Rp7.634.552");
    await expect(slip).toContainText("Jaminan Pensiun tahun ini belum terverifikasi");
    await slip.getByText("Rincian").click();
    await expect(slip.getByText("Potongan PPh 21")).toBeVisible();
    await expect(slip).toContainText("-Rp125.448");
    await periksaUi(page, "gaji-draf");

    await page.getByRole("button", { name: "Setujui gaji bulan ini" }).click();
    // Setelah disetujui halaman dirender ulang: formulir Setujui hilang, tombol Bagikan muncul, periode bercap Disetujui.
    const bagikan = page.getByRole("button", { name: `Bagikan slip ${nama}` });
    await expect(bagikan).toBeVisible();
    await expect(page.getByRole("button", { name: "Setujui gaji bulan ini" })).toHaveCount(0);
    await bagikan.click();
    const tautan = (await page.getByTestId("tautan-slip-isi").textContent())!;
    expect(tautan).toMatch(/\/slip#nms_[0-9a-f]{64}$/);

    const tamu = await (await browser.newContext()).newPage();
    await tamu.goto(new URL(tautan).pathname + new URL(tautan).hash);
    await expect(tamu.getByTestId("slip-neto")).toContainText("Rp7.634.552");
    await expect(tamu.getByTestId("slip")).toContainText(nama);
    await periksaUi(tamu, "slip-publik");
    await tamu.goto("/slip#nms_" + "0".repeat(64));
    await tamu.reload();
    await expect(tamu.getByTestId("slip-galat")).toContainText("tidak berlaku lagi");
    await tamu.context().close();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});

// F1-05B: gaji pokok Rp3.460.000 (upah sejam Rp20.000), lembur 4 jam di hari kerja menambah Rp150.000 ke slip
// (1,5 x 20.000 + 3 x 2 x 20.000, PP 35/2021 Pasal 31). Usaha sendiri "Uji Lembur E2E", bulan yang belum pernah dipakai.
test("lembur 4 jam hari kerja menambah Rp150.000 ke slip", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", NAMA_USAHA_LEMBUR).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: NAMA_USAHA_LEMBUR, p_industri: "fnb" });
      expect(error).toBeNull();
      pid = data as string;
    } else {
      expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    }
    await sb.auth.refreshSession();
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const { data: per } = await sb.from("periode_gaji").select("bulan").eq("perusahaan_id", pid);
    const dipakai = new Set((per ?? []).map((p) => (p.bulan as string).slice(0, 7)));
    let bulan = "";
    for (let i = 2026 * 12 + 10; !bulan; i++) {
      const b = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
      if (!b.endsWith("-12") && !dipakai.has(b)) bulan = b;
    }
    const nama = `Karyawan Lembur ${Date.now()}`;
    const { data: o, error: eo } = await sb.from("orang").insert({ perusahaan_id: pid, nama, data: { mulai: `${bulan}-15` } }).select("id").single();
    expect(eo).toBeNull();
    expect((await sb.from("orang_rahasia").insert({ orang_id: o!.id, perusahaan_id: pid, gaji: { pokok: 3_460_000, tunjangan_tetap: 0, ptkp: "TK/0", risiko_jkk: "sangat_rendah" } })).error).toBeNull();

    await page.goto(`/masuk?next=/app/gaji?bulan=${bulan}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    // Tunggu pathname, bukan pola URL: "/masuk?next=/app/gaji" sudah cocok dengan /\/app\/gaji/ sebelum masuk selesai.
    await page.waitForURL((u) => u.pathname === "/app/gaji");
    await page.goto(`/app/gaji?bulan=${bulan}`);
    await expect(page.getByTestId("lembur-kosong")).toBeVisible();
    await page.getByRole("button", { name: "Siapkan gaji bulan ini" }).click();
    const slip = page.getByTestId("daftar-slip").getByRole("listitem").filter({ hasText: nama });
    // Tanpa lembur: 3.460.000 - BPJS Kes 34.600 - JHT 69.200 = 3.356.200 (bruto PPh di bawah batas TER A 0%).
    await expect(slip).toContainText("Rp3.356.200");

    const form = page.getByRole("form", { name: "Catat lembur" });
    await form.getByLabel("Orang").selectOption({ label: nama });
    await form.getByLabel("Tanggal").fill(`${bulan}-03`);
    await form.getByLabel("Jenis hari").selectOption("hari_kerja");
    await form.getByLabel("Jam lembur").fill("5");
    await form.getByRole("button", { name: "Catat lembur" }).click();
    await expect(form.getByRole("alert")).toContainText("paling lama 4 jam");
    await form.getByLabel("Jam lembur").fill("4");
    await form.getByRole("button", { name: "Catat lembur" }).click();
    const daftar = page.getByTestId("daftar-lembur");
    await expect(daftar.getByRole("listitem").filter({ hasText: nama })).toContainText("4 jam, hari kerja");

    await page.getByRole("button", { name: "Hitung ulang draf" }).click();
    await expect(slip).toContainText("Rp3.506.200");
    await slip.getByText("Rincian").click();
    await expect(slip.getByText("Lembur 4 jam")).toBeVisible();
    await expect(slip).toContainText("Rp150.000");

    for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: lebar, height: tinggi });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(400);
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
        await page.getByTestId("lembur").screenshot({ path: test.info().outputPath(`lembur-${lebar}-${skema}.png`) });
      }
    }
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
