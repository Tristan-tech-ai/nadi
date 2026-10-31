import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { buatUji } from "../src/lib/rekrut/uji-kerja";

// F2-03: lowongan bertopi Pelayan otomatis berisi pertanyaan; tamu melamar di HP lalu merekam jawaban pertanyaan 1
// dengan mikrofon palsu Chromium yang memutar kalimat korpus s01, memutarnya, mengirimnya lewat slot anon, dan jawaban
// tercatat berstatus masuk. Lalu pemilik membuka layar penilai: klip, transkrip di perangkat, dan ringkasan rubrik.
// E2E_MODEL_CACHE (opsional, .env.e2e.local) = folder cache model transformers.js; berkas model dilayani dari sana
// agar tes tidak mengunduh ratusan MB tiap jalan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const axeSerius = async (p: Page, ket: string) =>
  expect((await new AxeBuilder({ page: p }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), ket).toEqual([]);
const CV = join(__dirname, "..", "..", "..", "fixtures", "korpus", "cv", "cv-01.pdf");
const SUARA = join(__dirname, "..", "..", "..", "fixtures", "korpus", "suara", "s01.wav");

test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${SUARA}`] } });
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("wawancara suara: tamu merekam dan mengirim jawaban pertanyaan 1 setelah melamar", async ({ page, browser }) => {
  test.setTimeout(420_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  expect((await sb.rpc("pasang_paket", { p_kode: "fnb" })).error).toBeNull();
  await page.goto("/masuk?next=/app/orang");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/orang/);
  const judul = `Pelayan wawancara ${Date.now()}`;
  const kartu = page.getByTestId("kartu-lowongan");
  await kartu.getByLabel("Judul lowongan").fill(judul);
  await kartu.getByLabel("Topi (posisi)").selectOption({ label: "Pelayan" });
  await kartu.getByRole("button", { name: "Buat lowongan" }).click();
  const baris = kartu.getByTestId("daftar-lowongan").getByRole("listitem").filter({ hasText: judul });
  await expect(baris).toBeVisible();
  const tautan = (await baris.getByTestId("tautan-lamar").textContent())!.trim();

  const tamu = await (await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["microphone"] })).newPage();
  const nama = `Pelamar Wawancara ${Date.now()}`;
  await tamu.goto(new URL(tautan).pathname);
  await tamu.getByLabel("Nama lengkap").fill(nama);
  await tamu.getByLabel("Nomor HP (WhatsApp)").fill(`0814${String(Date.now()).slice(-8)}`);
  await tamu.getByLabel(/CV: foto atau PDF/).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.concat([readFileSync(CV), Buffer.from(`\n%uji ${nama}\n`)]) });
  await tamu.getByRole("button", { name: "Kirim lamaran" }).click();
  await expect(tamu.getByTestId("lamaran-terkirim")).toBeVisible({ timeout: 60_000 });

  const wawancara = tamu.getByTestId("wawancara");
  await expect(wawancara).toBeVisible();
  await expect(wawancara.getByRole("listitem")).not.toHaveCount(0);
  await tamu.getByTestId("rekam-0").click();
  await expect(tamu.getByRole("timer")).toBeVisible();
  await tamu.waitForTimeout(6000);
  await tamu.getByTestId("berhenti-0").click();
  await expect(wawancara.locator("audio")).toHaveCount(1);
  await tamu.getByTestId("kirim-jawaban-0").click();
  await expect(tamu.getByTestId("jawaban-terkirim-0")).toBeVisible({ timeout: 30_000 });
  await expect(wawancara).toContainText("1 dari");

  // F2-04 uji kerja: benih dibaca pemilik (RLS), soal disusun dengan modul yang sama; dua jawaban benar, satu salah.
  const { data: laUji } = await sb.from("lamaran").select("id").eq("nama", nama).single();
  const ujiKerja = tamu.getByTestId("uji-kerja");
  await expect(ujiKerja.getByTestId("uji-jawaban-2")).toBeVisible();
  const { data: barisUji } = await sb.from("uji_lamaran").select("topi_kode, benih").eq("lamaran_id", laUji!.id).eq("jenis", "kerja").single();
  const soal = buatUji(barisUji!.topi_kode!, barisUji!.benih!)!;
  await expect(ujiKerja).toContainText(soal[0].teks);
  await ujiKerja.getByTestId("uji-jawaban-0").fill(String(soal[0].jawaban));
  await ujiKerja.getByTestId("uji-jawaban-1").fill(`Rp${soal[1].jawaban.toLocaleString("id-ID")}`);
  await ujiKerja.getByTestId("uji-jawaban-2").fill(String(soal[2].jawaban + 1));
  await axeSerius(tamu, "formulir uji kerja");
  await ujiKerja.screenshot({ path: test.info().outputPath("uji-kerja-isi-390.png") });
  await tamu.getByTestId("kirim-uji").click();
  await expect(tamu.getByTestId("uji-terkirim")).toBeVisible();

  // IPIP opsional: hanya 10 butir ekstraversi dijawab "Sangat sesuai" -> 5 butir + (5) + 5 butir - (1) = 30; faktor lain belum lengkap.
  await tamu.getByTestId("buka-diri").click();
  const diri = tamu.getByTestId("kenali-diri");
  for (const no of [1, 6, 11, 16, 21, 26, 31, 36, 41, 46]) {
    await diri.getByRole("group", { name: new RegExp(`^${no}\\. `) }).getByLabel("Sangat sesuai").check();
  }
  await expect(diri).toContainText("10 dari 50 dijawab");
  await axeSerius(tamu, "kuesioner IPIP terbuka");
  await diri.getByRole("listitem").first().screenshot({ path: test.info().outputPath("ipip-butir-390.png") });
  await tamu.getByTestId("kirim-diri").click();
  await expect(tamu.getByTestId("diri-terkirim")).toContainText("10 dari 50");

  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await tamu.setViewportSize({ width: lebar, height: tinggi });
      await tamu.emulateMedia({ colorScheme: skema });
      await tamu.waitForTimeout(400);
      const axe = await new AxeBuilder({ page: tamu }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await wawancara.screenshot({ path: test.info().outputPath(`wawancara-${lebar}-${skema}.png`) });
      await ujiKerja.screenshot({ path: test.info().outputPath(`uji-kerja-${lebar}-${skema}.png`) });
    }
  }
  await tamu.context().close();

  // Pemilik melihat jawaban berstatus masuk untuk lamaran ini (RLS: pemilik/admin perusahaan).
  const { data: la } = await sb.from("lamaran").select("id").eq("nama", nama).single();
  const { data: jw, error } = await sb.from("jawaban_wawancara").select("urutan, status, durasi_detik").eq("lamaran_id", la!.id);
  expect(error).toBeNull();
  expect(jw).toHaveLength(1);
  expect(jw![0].urutan).toBe(0);
  expect(jw![0].status).toBe("masuk");
  expect(Number(jw![0].durasi_detik)).toBeGreaterThan(2);

  // Layar penilai: klip lewat tautan bertanda, transkrip whisper di perangkat, ringkasan rubrik dari transkrip.
  // route.fulfill dengan berkas ratusan MB membuat Chromium tumbang; berkas dilayani server statis lokal lewat pengalihan 302.
  // Hanya untuk server lokal http: halaman https (produksi) tidak boleh mengambil dari http://localhost, jadi model diunduh asli.
  const cache = (process.env.E2E_BASE_URL ?? "http://").startsWith("http://") ? E.E2E_MODEL_CACHE : undefined;
  const srv = cache
    ? createServer((req, res) => {
        const f = join(cache, decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
        if (!existsSync(f)) return res.writeHead(404, { "access-control-allow-origin": "*" }).end();
        res.writeHead(200, { "access-control-allow-origin": "*", "content-length": statSync(f).size });
        createReadStream(f).pipe(res);
      }).listen(4011)
    : null;
  if (cache) {
    await page.context().route("https://huggingface.co/**", async (route) => {
      const m = new URL(route.request().url()).pathname.match(/^\/([^/]+\/[^/]+)\/resolve\/[^/]+\/(.+)$/);
      if (m && existsSync(join(cache, m[1], decodeURIComponent(m[2])))) return route.fulfill({ status: 302, headers: { location: `http://localhost:4011/${m[1]}/${m[2]}`, "access-control-allow-origin": "*" } });
      return route.continue();
    });
  }
  await page.goto(`/app/wawancara/${la!.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nama);
  await expect(page.getByTestId("ringkasan-wawancara")).toContainText("1 jawaban suara masuk");
  await expect(page.getByTestId("jawaban-0").locator("audio")).toHaveAttribute("src", /\/storage\/v1\/object\/sign\//);
  await page.getByTestId("transkrip-0").click();
  await expect(page.getByTestId("teks-transkrip-0")).toContainText(/pelayan/i, { timeout: 300_000 });
  await expect(page.getByTestId("skor-wawancara")).toBeVisible();
  await expect(page.getByTestId("uji-benar")).toHaveText("2");
  await expect(page.getByTestId("hasil-uji-kerja")).toContainText("seharusnya");
  await expect(page.getByTestId("hasil-ipip").getByRole("definition").first()).toHaveText("30 dari 50");
  await expect(page.getByTestId("hasil-ipip")).toContainText("belum lengkap");
  await expect(page.getByTestId("ringkasan-wawancara")).toContainText("Pernah bekerja sebagai pelayan");
  const { data: tersimpan } = await sb.from("jawaban_wawancara").select("transkrip, nilai").eq("lamaran_id", la!.id).single();
  expect(tersimpan!.transkrip).toMatch(/pelayan/i);
  expect((tersimpan!.nilai as { cocok: string[] }).cocok).toContain("Pernah bekerja sebagai pelayan");

  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `penilai ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`penilai-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  srv?.close();
});
