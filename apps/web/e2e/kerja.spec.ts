import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-01: pemilik menambah kerja untuk staf sintetis baru (poin dari riwayat atau model, lalu diubah manual jadi 2 poin = 30 menit),
// staf memulai, menunda, melanjutkan, lalu menyelesaikan; durasi nyata tampil "Selesai dalam ... (perkiraan 30)" di layar staf
// dan papan pemilik. Memakai usaha bawaan akun A (Warung Uji A, tanpa pindah usaha). Staf uji dinonaktifkan di akhir, kerja
// yang belum selesai dibatalkan (tanpa penghapusan). Foto ke E2E_FOTO_DIR bila diisi, selain itu ke folder keluaran Playwright.
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

async function axeDanFoto(p: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await p.setViewportSize({ width: lebar, height: tinggi });
      await p.emulateMedia({ colorScheme: skema });
      await p.waitForTimeout(400);
      const axe = await new AxeBuilder({ page: p }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      const lebarHalaman = await p.evaluate(() => document.documentElement.scrollWidth);
      expect(lebarHalaman, `${nama} ${lebar}: tanpa gulir mendatar`).toBeLessThanOrEqual(lebar);
      await p.screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.emulateMedia({ colorScheme: "light" });
}

test("kerja: pemilik menambah kerja berpoin, staf mulai sampai selesai, durasi nyata tampil", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  expect(pid).toBeTruthy();
  const { data: usaha } = await sb.from("perusahaan").select("nama, kode, zona_waktu").eq("id", pid!).single();
  expect(usaha?.nama, "usaha aktif akun A harus Warung Uji A").toBe("Warung Uji A");
  expect(usaha?.zona_waktu, "Warung Uji A memakai WIB, beda dari zona browser uji (WITA)").toBe("Asia/Jakarta");
  const besokWib = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86_400_000));
  const jamWib = (ms: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms)).replace(":", ".");

  const jejak = String(Date.now());
  const namaStaf = `Staf Kerja ${jejak}`;
  const judul = `Cek stok beras rak ${jejak.slice(-5)}`;
  const pin = "246813";
  const { data: o, error: eo } = await sb.from("orang").insert({ perusahaan_id: pid, nama: namaStaf, data: {} }).select("id").single();
  expect(eo).toBeNull();
  const idOrang = o!.id as string;
  expect((await sb.rpc("buat_akun_staf", { p_orang: idOrang, p_pin: pin })).error).toBeNull();
  const { data: s } = await sb.from("orang").select("id_staf").eq("id", idOrang).single();
  const idStaf = s!.id_staf as string;
  expect(idStaf).toMatch(/^S\d{3,}$/);

  try {
    // Pemilik menambah kerja lewat lembar bawah.
    await page.goto("/masuk?next=/app/kerja");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/kerja");
    await expect(page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Kerja" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("ringkasan-kerja")).toBeVisible();

    await page.getByRole("button", { name: "Tambah kerja" }).click();
    const form = page.getByRole("form", { name: "Tambah kerja" });
    await expect(form).toBeVisible();
    await form.getByLabel("Judul kerja").fill(judul);
    await form.getByRole("combobox", { name: /^Pelaksana/ }).selectOption({ label: namaStaf });
    // Q-25: usaha uji WIB, browser uji WITA (playwright.config). Jam yang diketik dibaca di zona usaha: besok 17.00 WIB = 10.00 UTC.
    await form.getByLabel("Tenggat (boleh kosong)").fill(`${besokWib}T17:00`);
    await form.getByRole("button", { name: "Simpan kerja" }).click();
    await expect(page.getByTestId("hasil-tambah")).toContainText("Tersimpan.", { timeout: 40_000 });

    // Poin dari riwayat (0 token) atau model ringan; keduanya membawa alasan.
    const { data: kr } = await sb.from("kerja").select("id, data, poin_beban, tenggat").eq("judul", judul).single();
    const idKerja = kr!.id as string;
    expect(new Date(kr!.tenggat as string).toISOString(), "17.00 WIB tersimpan 10.00 UTC").toBe(`${besokWib}T10:00:00.000Z`);
    const sumberAwal = (kr!.data as { estimasi?: { sumber?: string } }).estimasi?.sumber ?? null;
    test.info().annotations.push({ type: "sumber poin awal", description: String(sumberAwal) });
    expect(["riwayat", "model"], "estimasi otomatis tersimpan").toContain(sumberAwal);
    const kartu = page.locator(`[data-testid="kartu-kerja"][data-judul="${judul}"]`);
    await expect(kartu).toBeVisible();
    await expect(kartu.getByTestId("poin-kerja")).toHaveText(/^\d+(,\d+)? poin, (dari \d+ kerja serupa|perkiraan model)$/);
    await expect(kartu.getByTestId("alasan-poin")).not.toBeEmpty();
    await expect(kartu).toContainText(namaStaf);
    await expect(kartu, "jam tenggat yang tampil sama dengan yang diketik").toContainText("Tenggat Besok, 17.00");

    // Ubah poin manual: 2 poin = 30 menit.
    await kartu.getByText("Ubah poin").click();
    const formPoin = kartu.getByRole("form", { name: `Ubah poin ${judul}` });
    await formPoin.getByLabel("Poin (1 poin = 15 menit)").fill("2");
    await formPoin.getByRole("button", { name: "Simpan poin" }).click();
    await expect(page.locator(`[data-testid="kartu-kerja"][data-judul="${judul}"]`).getByTestId("poin-kerja")).toHaveText("2 poin, diisi manual");
    await page.reload();
    await expect(page.locator(`[data-testid="kartu-kerja"][data-judul="${judul}"]`).getByTestId("poin-kerja")).toHaveText("2 poin, diisi manual");
    await axeDanFoto(page, "kerja-pemilik");

    // Staf: satu kerja aktif, tombol besar.
    const konteksStaf = await browser.newContext({ locale: "id-ID", timezoneId: "Asia/Makassar" });
    const staf = await konteksStaf.newPage();
    await staf.goto("/masuk/staf");
    await staf.getByLabel("Kode usaha").fill(usaha!.kode as string);
    await staf.getByLabel("ID kamu").fill(idStaf);
    await staf.getByLabel("PIN").fill(pin);
    await staf.getByRole("button", { name: "Masuk" }).click();
    await expect(staf.getByTestId("peran")).toContainText("staf");
    await staf.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Kerja" }).click();
    await staf.waitForURL((u) => u.pathname === "/app/kerja");
    const aktif = staf.getByTestId("kerja-aktif");
    await expect(aktif).toContainText(judul);
    await expect(staf.getByTestId("status-aktif")).toHaveText("Belum dimulai");
    await expect(aktif).toContainText("2 poin, sekitar 30 menit");
    await expect(aktif).toContainText("Tenggat Besok, 17.00");
    await axeDanFoto(staf, "kerja-staf-mulai");

    await aktif.getByRole("button", { name: "Mulai" }).click();
    await expect(staf.getByTestId("hasil-kerja")).toHaveText("Dimulai. Tekan Selesai bila sudah beres.");
    await expect(staf.getByTestId("status-aktif")).toContainText("Sedang jalan sejak");
    // Jam mulai di zona usaha (WIB), bukan zona browser (WITA): satu menit toleransi untuk jam server dan pergantian menit.
    const kini = Date.now();
    expect([kini - 60_000, kini, kini + 60_000].map((t) => `Sedang jalan sejak ${jamWib(t)}`)).toContain((await staf.getByTestId("status-aktif").textContent())?.trim());
    await staf.setViewportSize({ width: 390, height: 844 });
    await staf.screenshot({ path: foto("kerja-staf-jalan-wib-390-light.png"), fullPage: true });
    await aktif.getByRole("button", { name: "Tunggu dulu" }).click();
    await expect(staf.getByTestId("hasil-kerja")).toHaveText("Ditunda. Waktu menunggu tidak dihitung.");
    await expect(staf.getByTestId("status-aktif")).toHaveText("Ditunda dulu");
    await staf.waitForTimeout(1500);
    await aktif.getByRole("button", { name: "Lanjut" }).click();
    await expect(staf.getByTestId("hasil-kerja")).toHaveText("Dilanjutkan.");
    await aktif.getByRole("button", { name: "Selesai" }).click();
    await expect(staf.getByTestId("hasil-kerja")).toHaveText(/^Selesai dalam (kurang dari 1 menit|\d+ menit) \(perkiraan 30\)\.$/);
    const itemSelesai = staf.locator(`[data-testid="kerja-selesai-staf"] li[data-judul="${judul}"]`);
    await expect(itemSelesai.getByTestId("durasi-nyata")).toHaveText(/^Selesai dalam (kurang dari 1 menit|\d+ menit) \(perkiraan 30\)$/);
    await expect(staf.getByTestId("kerja-kosong")).toHaveText("Semua kerjamu hari ini sudah selesai.");
    await axeDanFoto(staf, "kerja-staf-selesai");
    await konteksStaf.close();

    // Database: durasi nyata dan jeda tersimpan, galat relatif terhadap 30 menit, kejadian lengkap.
    const { data: akhir } = await sb.from("kerja").select("status, mulai_at, selesai_at, poin_beban, data").eq("id", idKerja).single();
    const d = akhir!.data as { aktual_menit: number; jeda_menit: number; galat_relatif: number; estimasi: { sumber: string; menit: number } };
    expect(akhir!.status).toBe("selesai");
    expect(Number(akhir!.poin_beban)).toBe(2);
    expect(d.estimasi).toMatchObject({ sumber: "manual", menit: 30 });
    expect(typeof d.aktual_menit).toBe("number");
    expect(d.jeda_menit).toBeGreaterThan(0);
    const kotor = (Date.parse(akhir!.selesai_at as string) - Date.parse(akhir!.mulai_at as string)) / 60_000;
    expect(d.aktual_menit).toBeCloseTo(kotor - d.jeda_menit, 1);
    expect(d.galat_relatif).toBeLessThan(0);
    const { data: kej } = await sb.from("kejadian").select("jenis").eq("kerja_id", idKerja);
    expect((kej ?? []).map((k) => k.jenis).sort()).toEqual(["kerja.buat", "kerja.lanjut", "kerja.mulai", "kerja.selesai", "kerja.tunggu"]);

    // Papan pemilik: kerja pindah ke kolom Selesai dengan durasi nyata.
    await page.reload();
    const selesai = page.getByTestId("kolom-selesai").locator(`[data-testid="kartu-kerja"][data-judul="${judul}"]`);
    await expect(selesai.getByTestId("durasi-nyata")).toHaveText(/^Selesai dalam (kurang dari 1 menit|\d+ menit) \(perkiraan 30\)$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("navigation", { name: "Saring kolom" }).getByRole("link", { name: /^Selesai/ }).click();
    await page.waitForURL((u) => u.searchParams.get("kolom") === "selesai");
    await expect(selesai).toBeVisible();
    await expect(page.getByTestId("kolom-baru")).toBeHidden();
    await axeDanFoto(page, "kerja-pemilik-selesai");
  } finally {
    // Bersihkan tanpa menghapus: kerja uji yang belum selesai dibatalkan, staf uji dinonaktifkan.
    const { data: sisa } = await sb.from("kerja").select("id, status").eq("judul", judul);
    for (const k of sisa ?? []) if (k.status !== "selesai" && k.status !== "batal") await sb.rpc("ubah_status_kerja", { p_kerja: k.id, p_aksi: "batal" });
    await sb.from("orang").update({ status: "nonaktif" }).eq("id", idOrang);
  }
});
