import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { extractText, getDocumentProxy } from "unpdf";

// F4-02: kalimat "SK mutasi <nama> ke cabang Denpasar mulai 1 Desember" jadi isian, draf, terbit bernomor; lembar cetak menjadi PDF
// satu halaman A4 (595 x 842 pt) yang memuat nomor, nama, dan QR; verifikasi publik tanpa akun: kode asli diterima, kode diubah
// ditolak, surat dibatalkan ditandai batal. Orang sintetis unik per jalan di usaha aktif akun A.
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

test("surat keluar: kalimat, draf, terbit, PDF A4, verifikasi asli/palsu/batal", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const t = Date.now().toString(36).toUpperCase();
  const nama = `Budi Keluar ${t}`;
  expect((await sb.from("orang").insert({ perusahaan_id: pid, nama })).error).toBeNull();

  await page.goto("/masuk?next=/app/surat-keluar");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/surat-keluar");
  await page.getByLabel("Tulis permintaan suratnya dalam satu kalimat").fill(`SK mutasi ${nama} ke cabang Denpasar mulai 1 Desember`);
  await page.getByRole("button", { name: "Susun surat" }).click();
  const isian = page.getByRole("form", { name: "Isian surat" });
  await expect(isian.getByLabel("Jenis surat")).toHaveValue("sk_mutasi");
  await expect(isian.getByLabel("Tujuan (mutasi atau tugas)")).toHaveValue("cabang Denpasar");
  await expect(isian.getByLabel("Mulai")).toHaveValue(/^\d{4}-12-01$/);
  await expect(isian.getByLabel("Untuk siapa").locator("option:checked")).toHaveText(nama);
  await isian.getByRole("button", { name: "Simpan draf" }).click();
  await expect(isian.getByText("Draf tersimpan.")).toBeVisible();

  const item = page.getByTestId("daftar-surat-keluar").getByRole("listitem").filter({ hasText: nama });
  await expect(item).toContainText("Belum bernomor");
  await periksaUi(page, "surat-keluar");
  await item.getByRole("button", { name: `Terbitkan dan beri nomor: Surat Keputusan Mutasi untuk ${nama}` }).click();
  await expect(item.getByTestId("kode-verifikasi")).toHaveText(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  const kode = (await item.getByTestId("kode-verifikasi").textContent())!.replaceAll("-", "");
  const nomor = (await item.locator("p.font-mono").textContent())!.split(",")[0].trim();
  expect(nomor).toMatch(/^\d{3}\/[A-Z0-9]+\/SK\/[IVX]+\/\d{4}$/);

  // Lembar cetak dan PDF A4.
  const cetak = await page.context().newPage();
  await cetak.goto(await item.getByRole("link", { name: "Cetak atau simpan PDF" }).getAttribute("href") as string);
  await expect(cetak.getByTestId("lembar-surat")).toContainText(nomor);
  await expect(cetak.getByTestId("lembar-surat")).toContainText(nama);
  await expect(cetak.getByTestId("qr-surat").locator("svg")).toBeVisible();
  await cetak.emulateMedia({ media: "print" });
  const pdf = await getDocumentProxy(new Uint8Array(await cetak.pdf({ preferCSSPageSize: true, printBackground: true })));
  expect(pdf.numPages).toBe(1);
  const vp = (await pdf.getPage(1)).getViewport({ scale: 1 });
  expect([Math.round(vp.width), Math.round(vp.height)]).toEqual([595, 842]);
  const { text } = await extractText(pdf, { mergePages: true });
  expect(text).toContain(nomor);
  expect(text).toContain(nama);
  expect(text).toContain(`/v/${kode}`);
  await cetak.emulateMedia({ media: "screen" });
  await periksaUi(cetak, "surat-cetak");
  await cetak.close();

  // Verifikasi tanpa akun.
  const tamu = await (await browser.newContext()).newPage();
  await tamu.goto(`/v/${kode}`);
  await expect(tamu.getByTestId("verifikasi-asli")).toContainText(nomor);
  await expect(tamu.getByTestId("verifikasi-asli")).toContainText(nama);
  await periksaUi(tamu, "surat-verifikasi");
  const palsu = (kode[0] === "A" ? "B" : "A") + kode.slice(1);
  await tamu.goto(`/v/${palsu}`);
  await expect(tamu.getByTestId("verifikasi-palsu")).toContainText("tidak terdaftar");

  await item.getByText("Batalkan surat").click();
  await item.getByLabel("Alasan").fill("Tujuan mutasi berubah");
  await item.getByRole("button", { name: "Batalkan" }).click();
  await expect(page.getByTestId("daftar-surat-keluar").getByRole("listitem").filter({ hasText: nama })).toContainText("Dibatalkan: Tujuan mutasi berubah");
  await tamu.goto(`/v/${kode}`);
  await expect(tamu.getByTestId("verifikasi-batal")).toContainText("sudah dibatalkan");
  await tamu.context().close();
});
