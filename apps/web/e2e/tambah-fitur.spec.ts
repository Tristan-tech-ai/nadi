import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// X-06 Tambah fitur, LOKAL saja (mode tanpa commit): pemilik usaha kantor memasang paket resmi dari katalog, fitur itu tampil di
// bagian Fitur tambahan sidebar dan ditemukan Ctrl K, dilepas (hilang dari menu) lalu dipasang lagi tanpa kehilangan catatan,
// modul bawaan Kasir dinyalakan dan masuk Fitur tambahan, manifest buatan sendiri yang berbahaya ditahan pengawas sedangkan yang
// sah diterapkan. Jalankan seperti e2e/mod.spec.ts (E2E_BASE_URL, E2E_LOKAL_URL, E2E_LOKAL_KUNCI).
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/tambah-fitur-layar";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

const SAH = {
  skema: 1, kode: "izin-acara", nama: "Izin acara", deskripsi: "Pengajuan izin acara kantor.", ikon: "kalender-cek", ruang: "dokumen", versi: "1.0.0",
  koleksi: [{ kode: "acara", nama: "Acara", judul: "nama", bidang: [{ kode: "nama", label: "Nama acara", tipe: "teks", wajib: true }, { kode: "tanggal", label: "Tanggal", tipe: "tanggal" }],
    tampilan: [{ jenis: "daftar", kolom: ["nama", "tanggal"] }], akses: { pemilik: "kelola", admin: "kelola", akuntan: "lihat", staf: "tulis" } }],
};

const sidebar = (page: Page) => page.locator(".kerangka-sidebar");

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

test("tambah fitur: paket resmi, lepas dan pasang lagi tanpa kehilangan data, modul bawaan, buat sendiri", async ({ page }) => {
  test.setTimeout(300_000);
  const email = `tambah-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Kantor Uji Fitur", p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  expect((await sb.from("orang").insert({ perusahaan_id: usaha.data, nama: "Sari Uji" })).error).toBeNull();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Ftambah-fitur");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/tambah-fitur", { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Tambah fitur" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("status-mcp")).toContainText("Belum ada AI yang tersambung");

  // Sidebar: modul kantor (Proyek) sudah di Fitur tambahan, ruang Jual tidak memuat Kasir.
  await expect(sidebar(page).getByRole("link", { name: "Proyek", exact: true })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Kasir" })).toHaveCount(0);

  // UAT-01: sebelum ada fitur tambahan, /app/mod memberi satu langkah pertama ke Tambah fitur (audit keadaan kosong).
  await page.goto("/app/mod");
  const kosong = page.getByTestId("mod-kosong");
  await expect(kosong).toContainText("Belum ada fitur tambahan yang aktif.");
  await kosong.getByRole("link", { name: "Tambah fitur" }).click();
  await page.waitForURL((u) => u.pathname === "/app/tambah-fitur");

  // Paket resmi: pratinjau lalu pasang.
  const paket = page.locator("[data-paket=proyek-agensi]");
  await paket.getByText("Pratinjau isi").click();
  await expect(page.getByTestId("pratinjau-proyek-agensi")).toContainText("Kirim untuk review wajib mengisi Tautan hasil");
  await paket.getByRole("button", { name: "Pasang" }).click();
  await expect(paket).toHaveAttribute("data-terpasang", "aktif", { timeout: 20_000 });
  await expect(sidebar(page).getByRole("link", { name: "Proyek agensi" })).toBeVisible();
  await periksaAxe(page);
  await foto(page, "tambah-fitur");

  // Ctrl K menemukan fitur tambahan.
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Cari fitur" });
  await dialog.getByRole("combobox").fill("agensi");
  await expect(dialog.getByRole("option").first()).toContainText("Proyek agensi");
  await dialog.getByRole("option").first().click();
  await page.waitForURL((u) => u.pathname === "/app/mod/proyek-agensi");

  // Satu catatan, lalu lepas dan pasang lagi: catatan tetap ada.
  await page.getByTestId("tambah-catatan").locator("summary").click();
  const form = page.getByRole("form", { name: "Simpan proyek" });
  await form.getByLabel("Nama proyek").fill("Katalog Bali");
  await form.getByLabel("PIC").selectOption({ label: "Sari Uji" });
  await form.getByRole("button", { name: "Simpan proyek" }).click();
  await expect(page.getByTestId("jumlah-catatan")).toContainText("1 catatan");
  await page.goto("/app/tambah-fitur");
  await paket.getByRole("button", { name: "Lepas" }).click();
  await expect(paket).toHaveAttribute("data-terpasang", "mati", { timeout: 20_000 });
  await expect(sidebar(page).getByRole("link", { name: "Proyek agensi" })).toHaveCount(0);
  await page.goto("/app/mod/proyek-agensi");
  await expect(page.getByText("tidak ditemukan atau sedang dimatikan")).toBeVisible();
  await page.goto("/app/tambah-fitur");
  await paket.getByRole("button", { name: "Pasang lagi" }).click();
  await expect(paket).toHaveAttribute("data-terpasang", "aktif", { timeout: 20_000 });
  await page.goto("/app/mod/proyek-agensi?k=proyek&v=daftar");
  await expect(page.getByTestId("jumlah-catatan")).toContainText("1 catatan");

  // Modul bawaan: tampilkan Kasir, masuk Fitur tambahan.
  await page.goto("/app/tambah-fitur");
  const kasir = page.getByTestId("fitur-dipakai").locator("li[data-modul=kasir]");
  await kasir.getByRole("button").click();
  await expect(kasir).toHaveAttribute("data-nyala", "ya");
  await expect(sidebar(page).getByRole("link", { name: "Kasir" })).toBeVisible();

  // Buat sendiri: berbahaya ditahan, sah diterapkan.
  const isian = page.getByLabel("Isi fitur (manifest JSON)");
  await isian.fill(JSON.stringify({ ...SAH, nama: "<script>alert(1)</script>" }));
  await page.getByRole("button", { name: "Periksa dan simpan draf" }).click();
  await expect(page.getByRole("form", { name: "Simpan fitur buatan sendiri" }).getByTestId("alasan-pengawas")).toBeVisible();
  await expect(page.locator("[data-draf=izin-acara]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-draf=izin-acara]").getByRole("button", { name: "Terapkan" })).toHaveCount(0);
  await isian.fill(JSON.stringify(SAH));
  await page.getByRole("button", { name: "Periksa dan simpan draf" }).click();
  await expect(page.locator("[data-draf=izin-acara]").getByRole("button", { name: "Terapkan" })).toBeVisible({ timeout: 20_000 });
  await page.locator("[data-draf=izin-acara]").getByRole("button", { name: "Terapkan" }).click();
  await expect(page.locator("[data-draf=izin-acara]")).toHaveCount(0, { timeout: 20_000 });
  await expect(sidebar(page).getByRole("link", { name: "Izin acara" })).toBeVisible();
  await expect(page.locator("[data-mod=izin-acara]")).toContainText("versi 1");
});

async function periksaAxe(page: Page) {
  const hasil = await new AxeBuilder({ page }).analyze();
  expect(hasil.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
}
