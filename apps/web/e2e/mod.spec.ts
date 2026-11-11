import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { CONTOH_PROYEK_AGENSI } from "../src/lib/mod/skema";

// X-05 penafsir mod, LOKAL saja (mode tanpa commit): akun dan usaha uji dibuat di Supabase lokal lewat API publik (tanpa
// kunci service role), manifest contoh proyek agensi diterapkan pemilik, lalu UI membuat proyek dan tugas, menyaring daftar,
// memindah status di papan dan rincian (termasuk transisi yang mewajibkan isian), membuka kalender, dan memeriksa riwayat.
// Jalankan: E2E_BASE_URL=http://localhost:3100 E2E_LOKAL_URL=<API_URL lokal> E2E_LOKAL_KUNCI=<kunci publik lokal> pnpm exec playwright test mod.spec.ts
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/mod-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

async function siapkanUsaha() {
  const email = `mod-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  const daftar = await sb.auth.signUp({ email, password: sandi });
  expect(daftar.error, daftar.error?.message).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Agensi Uji Mod", p_industri: null });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const orang = await sb.from("orang").insert([{ perusahaan_id: usaha.data, nama: "Sari Uji" }, { perusahaan_id: usaha.data, nama: "Budi Uji" }]).select("id");
  expect(orang.error, orang.error?.message).toBeNull();
  const draf = await sb.rpc("mod_draf_simpan", { p_manifest: CONTOH_PROYEK_AGENSI, p_sumber: "sendiri" });
  expect(draf.error, draf.error?.message).toBeNull();
  const terap = await sb.rpc("mod_terapkan", { p_mod: (draf.data as { id: string }).id });
  expect(terap.error, terap.error?.message).toBeNull();
  return { email, sandi };
}

async function periksaAxe(page: Page, nama: string) {
  const hasil = await new AxeBuilder({ page }).analyze();
  const serius = hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serius.map((v) => `${nama}: ${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
}

async function foto(page: Page, nama: string) {
  mkdirSync(LAYAR, { recursive: true });
  for (const [lebar, tinggi] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width: lebar, height: tinggi });
    for (const skema of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(250);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: `${LAYAR}/${nama}-${lebar}-${skema === "light" ? "terang" : "gelap"}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("penafsir mod: buat, saring, papan, transisi wajib isi, kalender, riwayat", async ({ page }) => {
  test.setTimeout(300_000);
  const akun = await siapkanUsaha();
  await page.goto("/masuk?next=%2Fapp%2Fmod");
  await page.getByLabel("Email").fill(akun.email);
  await page.getByLabel("Kata sandi").fill(akun.sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/mod", { timeout: 60_000 });

  await page.getByTestId("daftar-mod").getByRole("link", { name: "Proyek agensi" }).click(); // juga tampil di sidebar (X-06)
  await expect(page.getByRole("heading", { level: 1, name: "Proyek agensi" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Belum ada proyek.")).toBeVisible();

  // Buat dua proyek lewat formulir dari manifest.
  const tambah = page.getByTestId("tambah-catatan");
  for (const [i, [nama, jenis, tenggat]] of ([["Katalog Bali", "Sekali", "2026-11-25"], ["Kampanye Ramadan", "Berulang", "2027-02-10"]] as const).entries()) {
    if (!(await tambah.evaluate((d) => (d as HTMLDetailsElement).open))) await tambah.locator("summary").click();
    const form = tambah.getByRole("form", { name: "Simpan proyek" });
    await form.getByLabel("Nama proyek").fill(nama);
    await form.getByLabel("PIC").selectOption({ label: "Sari Uji" });
    await form.getByLabel("Jenis").selectOption({ label: jenis });
    await form.getByLabel("Tenggat").fill(tenggat);
    await form.getByLabel("Nilai kontrak").fill("12.500.000");
    await form.getByRole("button", { name: "Simpan proyek" }).click();
    await expect(form.getByRole("status")).toContainText("catatan baru tersimpan");
    // pesan sukses berikutnya sama teksnya: tunggu daftar di halaman ini ikut bertambah (revalidatePath)
    await expect(page.getByTestId("jumlah-catatan")).toContainText(`${i + 1} catatan`);
  }
  // Isian tidak sah ditolak dengan pesan dari pemeriksaan (nilai di bawah 0).
  const formSalah = tambah.getByRole("form", { name: "Simpan proyek" });
  await formSalah.getByLabel("Nama proyek").fill("Salah");
  await formSalah.getByLabel("PIC").selectOption({ label: "Sari Uji" });
  await formSalah.getByLabel("Nilai kontrak").fill("-5");
  await formSalah.getByRole("button", { name: "Simpan proyek" }).click();
  await expect(formSalah.getByRole("alert")).toContainText("Nilai kontrak di luar batas");

  await page.goto("/app/mod/proyek-agensi?k=proyek&v=daftar");
  const tabel = page.getByTestId("daftar-catatan");
  await expect(tabel.locator("tbody tr")).toHaveCount(2);
  await expect(tabel.locator("tbody tr").first()).toContainText("Katalog Bali"); // urut tenggat naik (bawaan manifest)
  await expect(tabel).toContainText("Sari Uji"); // kolom dari manifest: nama, klien, pic, tenggat
  const saring = page.getByRole("form", { name: "Cari dan saring Proyek" });
  await saring.getByLabel("Jenis", { exact: true }).selectOption({ label: "Berulang" });
  await saring.getByRole("button", { name: "Terapkan" }).click();
  await expect(tabel.locator("tbody tr")).toHaveCount(1);
  await expect(tabel).toContainText("Kampanye Ramadan");
  await page.goto("/app/mod/proyek-agensi?k=proyek&v=daftar&q=katalog");
  await expect(tabel.locator("tbody tr")).toHaveCount(1);
  await expect(tabel).toContainText("Katalog Bali");
  // halaman di luar jumlah tidak galat (PostgREST 416), tampil halaman terakhir
  await page.goto("/app/mod/proyek-agensi?k=proyek&v=daftar&hal=99");
  await expect(page.getByTestId("jumlah-catatan")).toContainText("2 catatan");
  await periksaAxe(page, "daftar");
  await foto(page, "daftar");

  // Tugas: papan per status.
  await page.goto("/app/mod/proyek-agensi?k=tugas");
  await expect(page.locator("[data-kolom=antrian]")).toBeVisible();
  await page.getByTestId("tambah-catatan").locator("summary").click();
  const ft = page.getByRole("form", { name: "Simpan tugas" });
  await ft.getByLabel("Judul").fill("Desain katalog");
  await ft.getByLabel("Proyek").selectOption({ label: "Katalog Bali" });
  await ft.getByLabel("PIC").selectOption({ label: "Sari Uji" });
  await ft.getByRole("group", { name: "Pelaksana" }).getByLabel("Budi Uji").check();
  await ft.getByLabel("Tenggat").fill("2026-11-20T14:30");
  await ft.getByRole("button", { name: "Simpan tugas" }).click();
  await expect(ft.getByRole("status")).toContainText("catatan baru tersimpan");
  await page.reload();
  const kartu = page.locator("[data-kolom=antrian] [data-catatan]");
  await expect(kartu).toHaveCount(1);
  await expect(kartu).toContainText("Katalog Bali");
  await kartu.getByRole("button", { name: "Dikerjakan" }).click();
  await expect(page.locator("[data-kolom=dikerjakan] [data-catatan]")).toHaveCount(1, { timeout: 20_000 });
  await periksaAxe(page, "papan");
  await foto(page, "papan");

  // Rincian: kirim untuk review mewajibkan tautan hasil; lalu terima.
  await page.locator("[data-kolom=dikerjakan] [data-catatan] a").first().click();
  const rincian = page.getByTestId("rincian-catatan");
  await expect(rincian.getByRole("heading", { name: "Desain katalog" })).toBeVisible();
  await expect(rincian.locator("[data-bidang=tenggat]")).toContainText("20 Nov 2026, 14.30");
  await rincian.locator("summary", { hasText: "Kirim untuk review" }).click();
  const review = rincian.getByRole("form", { name: "Kirim untuk review" });
  await review.getByLabel("Tautan hasil").fill("https://drive.example.org/katalog-v1");
  await review.getByRole("button", { name: "Kirim untuk review" }).click();
  // halaman dirender ulang: lencana status berganti dan tombol transisi berikutnya muncul
  await expect(rincian.locator("h2 + [data-status]")).toHaveAttribute("data-status", "review", { timeout: 20_000 });
  await expect(rincian.locator("[data-bidang=hasil]")).toContainText("https://drive.example.org/katalog-v1");
  await rincian.getByRole("button", { name: "Terima" }).click();
  await expect(rincian.locator("h2 + [data-status]")).toHaveAttribute("data-status", "selesai", { timeout: 20_000 });
  await expect(rincian.getByTestId("transisi")).toHaveCount(0);
  const riwayat = page.getByTestId("riwayat");
  await expect(riwayat.locator("li")).toHaveCount(5); // buat, status ke dikerjakan, ubah (hasil), status ke review, status ke selesai
  await expect(riwayat).toContainText("Review ke Selesai");
  await expect(rincian.locator("[data-bidang=hasil] a")).toHaveAttribute("rel", /noopener/);
  await periksaAxe(page, "rincian");
  await foto(page, "rincian");

  // Kalender bulan tenggat.
  await page.goto("/app/mod/proyek-agensi?k=tugas&v=kalender&bulan=2026-11");
  await expect(page.getByTestId("kalender-grid")).toContainText("Desain katalog");
  await expect(page.getByTestId("kalender-grid")).toContainText("14.30");
  await periksaAxe(page, "kalender");
  await foto(page, "kalender");
});
