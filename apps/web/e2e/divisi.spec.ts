import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// X-13 divisi, LOKAL saja: pemilik membuat divisi Desain dengan kepala dan anggota di halaman Orang; hasil kerja anggota dikirim
// (RPC, sama dengan tombol Kirim untuk review); kepala divisi masuk sebagai staf, melihat hasil yang menunggu di halaman Kerja,
// meminta revisi untuk satu kerja dan menerima kerja lain. Jalankan seperti e2e/mod.spec.ts.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";
const LAYAR = "test-results/divisi-layar";
const PIN = "246813";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

async function periksa(page: Page, nama: string) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
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

test("divisi: pemilik membuat divisi, kepala divisi meninjau hasil kerja anggota", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const email = `divisi-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Agensi Divisi", p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const orang = await sb.from("orang").insert([{ perusahaan_id: usaha.data, nama: "Sari Desain", jenis: ["karyawan"] }, { perusahaan_id: usaha.data, nama: "Raka Kepala", jenis: ["karyawan"] }]).select("id, nama");
  expect(orang.error, orang.error?.message).toBeNull();
  const sari = orang.data!.find((o) => o.nama === "Sari Desain")!.id as string;
  const raka = orang.data!.find((o) => o.nama === "Raka Kepala")!.id as string;
  expect((await sb.rpc("buat_akun_staf", { p_orang: raka, p_pin: PIN })).error).toBeNull();
  const idRaka = (await sb.from("orang").select("id_staf").eq("id", raka).single()).data!.id_staf as string;
  const kode = (await sb.from("perusahaan").select("kode").eq("id", usaha.data).single()).data!.kode as string;

  // Pemilik membuat divisi di halaman Orang.
  const galatKonsol: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") galatKonsol.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on("pageerror", (e) => galatKonsol.push(`pageerror: ${e.message.slice(0, 300)}`));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Forang");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/orang", { timeout: 60_000 });
  const bagian = page.getByTestId("divisi");
  await expect(bagian).toContainText("Belum ada divisi", { timeout: 60_000 });
  const form = bagian.getByRole("form", { name: "Buat divisi" });
  await form.getByLabel("Nama divisi").fill("Desain");
  await form.getByLabel("Kepala divisi").selectOption({ label: "Raka Kepala" });
  await form.getByRole("group", { name: "Anggota" }).getByLabel("Sari Desain").check();
  await form.getByRole("button", { name: "Buat divisi" }).click();
  const baris = bagian.locator("[data-divisi='Desain']");
  await expect(baris).toContainText("kepala Raka Kepala, 1 anggota: Sari Desain", { timeout: 20_000 });
  await baris.scrollIntoViewIfNeeded();
  await periksa(page, "orang-divisi");
  expect(galatKonsol.filter((g) => g.startsWith("error") || g.startsWith("pageerror"))).toEqual([]);

  // Dua hasil kerja Sari menunggu tinjauan.
  const kerja: string[] = [];
  for (const judul of ["Desain logo klien", "Poster acara"]) {
    const k = await sb.rpc("buat_kerja", { p_judul: judul, p_topi: null, p_pelaksana: sari, p_tenggat: new Date(Date.now() + 2 * 86_400_000).toISOString(), p_kunci: null });
    expect(k.error, k.error?.message).toBeNull();
    const id = (k.data as { id: string }).id;
    expect((await sb.rpc("ubah_status_kerja", { p_kerja: id, p_aksi: "mulai" })).error).toBeNull();
    expect((await sb.rpc("kirim_hasil_kerja", { p_kerja: id, p_tautan: `https://drive.example.org/${kerja.length + 1}`, p_catatan: "Versi pertama" })).error).toBeNull();
    kerja.push(id);
  }

  // Kepala divisi masuk sebagai staf dan meninjau.
  const staf = await (await browser.newContext()).newPage();
  await staf.setViewportSize({ width: 1440, height: 900 });
  await staf.goto("/masuk/staf");
  await staf.getByLabel("Kode usaha").fill(kode);
  await staf.getByLabel("ID kamu").fill(idRaka);
  await staf.getByLabel("PIN").fill(PIN);
  await staf.getByRole("button", { name: "Masuk" }).click();
  await expect(staf.getByTestId("peran")).toContainText("staf", { timeout: 60_000 });
  await staf.goto("/app/kerja");
  const review = staf.getByTestId("review-divisi");
  await expect(review).toContainText("Hasil yang menunggu tinjauanmu (2)", { timeout: 60_000 });
  await expect(review.locator("[data-review='Desain logo klien']")).toContainText("dari Sari Desain");
  // Papan pribadi kepala tetap hanya kerjanya sendiri, walau ia boleh membaca kerja anggota.
  await expect(staf.getByTestId("kerja-aktif")).not.toContainText("Desain logo klien");
  await expect(staf.getByTestId("kerja-aktif")).not.toContainText("Poster acara");
  await periksa(staf, "kerja-review-divisi");

  const poster = review.locator("[data-review='Poster acara']");
  await poster.getByTestId("minta-revisi").locator("summary").click();
  await poster.getByLabel("Yang perlu diperbaiki").fill("Tanggal acara di poster salah");
  await poster.getByRole("button", { name: "Kirim permintaan revisi" }).click();
  await expect.poll(async () => (await sb.from("kerja").select("status").eq("id", kerja[1]).single()).data?.status, { timeout: 20_000 }).toBe("jalan");

  await review.locator("[data-review='Desain logo klien']").getByRole("button", { name: "Terima hasil" }).click();
  await expect.poll(async () => (await sb.from("kerja").select("status").eq("id", kerja[0]).single()).data?.status, { timeout: 20_000 }).toBe("selesai");
  const alasan = await sb.from("kerja_hasil").select("alasan").eq("kerja_id", kerja[1]).eq("status", "revisi");
  expect(alasan.data?.[0]?.alasan).toBe("Tanggal acara di poster salah");

  // Kepala divisi tetap staf: halaman Orang (gaji) tertutup.
  await staf.goto("/app/orang");
  await expect(staf.getByTestId("ditolak")).toBeVisible({ timeout: 30_000 });
});
