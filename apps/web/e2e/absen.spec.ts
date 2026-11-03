import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hasilFixture } from "../../../fixtures/absen/bangun";

// F1-02: layar kios QR yang berganti tiap 15 detik; halaman absen staf menjalankan cek wajah MediaPipe sungguhan di peramban.
// Kamera palsu Chromium (pola uji tanpa wajah) mewakili "bukan wajah hidup": harus ditolak dan tidak ada absen yang terkirim.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const PRODUKSI = !!process.env.E2E_BASE_URL;
// Q-20: penanda uji cek wajah: hasil deteksi dari fixture landmark per arah tantangan. Hanya dibaca build lokal (NEXT_PUBLIC_NADI_UJI_WAJAH=1).
const PENANDA = { kiri: hasilFixture("menoleh-kiri"), kanan: hasilFixture("menoleh-kanan") };

test.use({ permissions: ["camera"], launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

async function masuk(page: Page, tujuan: string) {
  await page.goto(`/masuk?next=${encodeURIComponent(tujuan)}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === tujuan.split("?")[0]);
}

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`) });
    }
  }
}

test("layar kios menampilkan QR absen dan kodenya berganti setelah habis waktu", async ({ page }) => {
  test.setTimeout(90_000);
  await masuk(page, "/kios");
  const kode = page.getByTestId("kode-kios");
  await expect(kode).toHaveText(/^\d{6}$/, { timeout: 15_000 });
  await expect(page.getByTestId("qr-kios").locator("svg")).toBeVisible();
  const awal = await kode.textContent();
  const sisa = Number(await page.getByTestId("sisa-kios").locator("span").textContent());
  // Setelah sisa waktu habis, kode lama tidak tampil lagi (1 dari 10^6 kemungkinan sama; diulang sekali).
  await page.waitForTimeout((sisa + 2) * 1000);
  let baru = await kode.textContent();
  if (baru === awal) {
    await page.waitForTimeout(15_500);
    baru = await kode.textContent();
  }
  expect(baru).not.toBe(awal);
  await periksaUi(page, "kios");
});

test("absen: kamera tanpa wajah hidup ditolak oleh cek wajah di perangkat; kode QR rusak ditolak", async ({ page }) => {
  test.setTimeout(90_000);
  const permintaanAbsen: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().includes("/absen")) permintaanAbsen.push(r.url());
  });
  // Q-20: di produksi penanda uji dipasang juga dan harus diabaikan (build Vercel menyetel nilainya "0"); semua JS yang dimuat
  // halaman tidak boleh memuat nama penanda.
  const skripBerpenanda: string[] = [];
  if (PRODUKSI) {
    await page.addInitScript((p) => { (window as unknown as { __nadiUjiWajah: unknown }).__nadiUjiWajah = p; }, PENANDA);
    page.on("response", async (res) => {
      if (res.request().resourceType() === "script" && (await res.text().catch(() => "")).includes("__nadiUjiWajah")) skripBerpenanda.push(res.url());
    });
  }
  await masuk(page, "/absen?t=00000000-0000-0000-0000-000000000000&k=123456");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Absen");
  await periksaUi(page, "absen");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Absen masuk" }).click();
  await expect(page.getByTestId("status-wajah")).toContainText(/Kedipkan mata|Menyiapkan/, { timeout: 30_000 });
  await expect(page.getByTestId("galat-absen")).toContainText(/Wajah belum terlihat jelas|Belum terlihat/, { timeout: 40_000 });
  expect(permintaanAbsen).toEqual([]); // tidak ada absen yang dikirim tanpa wajah hidup
  expect(skripBerpenanda).toEqual([]);

  await page.goto("/absen?t=bukan-uuid&k=12");
  await expect(page.getByText("Kode QR tidak terbaca")).toBeVisible();
});

// Q-20: jalur jujur ujung ke ujung: staf memindai kode QR yang berlaku, cek wajah (fixture landmark lewat bingkaiDari dan
// nilaiWajah yang sama dengan produksi), server action, RPC absen_catat, kejadian absen.masuk tercatat. Hanya build lokal.
test("absen: staf dengan cek wajah lulus mencatat absen.masuk sampai database", async ({ page, browser }) => {
  test.skip(PRODUKSI, "penanda uji hanya ada di build lokal");
  test.setTimeout(120_000);
  await masuk(page, "/app/orang");
  const kode = (await page.getByTestId("kode-usaha").textContent())!.trim();
  const nama = `Staf Absen ${Date.now()}`;
  await page.getByLabel("Nama orang").fill(nama);
  await page.getByRole("button", { name: "Tambah" }).click();
  const baris = page.getByRole("listitem").filter({ hasText: nama });
  await expect(baris).toBeVisible();
  await baris.getByPlaceholder("PIN 6 angka").fill("246810");
  await baris.getByRole("button", { name: "Buat akun staf" }).click();
  await expect(baris.getByTestId("info-akun")).toContainText(`kode ${kode}`);
  const id = (await baris.getByTestId("info-akun").textContent())!.match(/ID (S\d{3})/)![1];

  // Kode absen yang sedang berlaku diambil pemilik (sama dengan yang tampil di layar kios).
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const { data: tempat } = await sb.rpc("tempat_absen_utama");
  expect(tempat).toBeTruthy();

  const ctx = await browser.newContext({ permissions: ["camera"] });
  await ctx.addInitScript((p) => { (window as unknown as { __nadiUjiWajah: unknown }).__nadiUjiWajah = p; }, PENANDA);
  const staf = await ctx.newPage();
  await staf.goto("/masuk/staf");
  await staf.getByLabel("Kode usaha").fill(kode);
  await staf.getByLabel("ID kamu").fill(id);
  await staf.getByLabel("PIN").fill("246810");
  await staf.getByRole("button", { name: "Masuk" }).click();
  await staf.waitForURL((u) => u.pathname === "/app");
  const { data: k } = await sb.rpc("kode_absen", { p_tempat: tempat });
  const sebelum = new Date().toISOString();
  await staf.goto(`/absen?t=${tempat}&k=${(k as { kode: string }).kode}`);
  await staf.getByRole("button", { name: "Absen masuk" }).click();
  await expect(staf.getByTestId("hasil-absen")).toContainText("Absen masuk tercatat", { timeout: 30_000 });

  const { data: orang } = await sb.from("orang").select("id").eq("nama", nama).maybeSingle();
  const { data: kej } = await sb.from("kejadian").select("jenis, data").eq("orang_id", orang!.id).gte("terjadi_at", sebelum);
  expect((kej ?? []).map((x) => x.jenis)).toEqual(["absen.masuk"]);
  await ctx.close();
});
