import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { periksaBupot } from "../src/lib/pajak/bupot";
import { periksaFaktur } from "../src/lib/pajak/efaktur";

// M-09: pemilik (akun A) menyimpan identitas pajak, melengkapi data pembeli untuk invoice baru, mengunduh XML Faktur Keluaran
// Coretax; berkas diperiksa aturan DJP (periksaFaktur) dan skema turunan (scripts/pajak/validasi-xsd.py). Invoice uji dibatalkan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("faktur pajak: identitas, data pembeli, unduh XML Coretax yang lolos aturan DJP dan skema", async ({ page }) => {
  test.setTimeout(120_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const pelanggan = `CV Uji Faktur ${tanda}`;
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const inv = await sb.rpc("buat_invoice", { p_pelanggan: pelanggan, p_hp: null, p_baris: [{ uraian: "Nasi kotak ayam bakar", jumlah: 30, harga: 22200 }],
    p_jatuh_tempo: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), p_catatan: null, p_kunci: crypto.randomUUID() });
  expect(inv.error).toBeNull();
  const { id: invId, nomor } = inv.data as { id: string; nomor: string };

  try {
    await page.goto(`/masuk?next=${encodeURIComponent("/app/pajak/faktur")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/pajak/faktur");

    const idn = page.getByRole("form", { name: "Identitas pajak" });
    await idn.getByLabel("NPWP (16 angka)").fill("1091031210912281");
    await idn.getByLabel("NITKU (22 angka)").fill("");
    await idn.getByRole("button", { name: "Simpan identitas" }).click();
    await expect(idn.getByRole("status")).toHaveText("Identitas pajak tersimpan.");

    await page.reload();
    const form = page.getByRole("form", { name: `Data pajak pembeli ${pelanggan}` });
    await form.getByLabel("Jenis ID").selectOption("TIN");
    await form.getByLabel("Nomor ID").fill("0811034248502000");
    await form.getByLabel("Alamat").fill("Jl. Sudirman 5, Denpasar");
    await form.getByRole("button", { name: "Simpan pembeli" }).click();
    // tersimpan: pelanggan pindah dari formulir ke daftar "Masuk berkas"
    await expect(form).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Masuk berkas" })).toContainText(pelanggan);

    await page.reload();
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: h });
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    }
    const [unduh] = await Promise.all([page.waitForEvent("download"), page.getByTestId("unduh-faktur").click()]);
    expect(unduh.suggestedFilename()).toMatch(/^faktur-keluaran-\d{4}-\d{2}\.xml$/);
    const xml = readFileSync((await unduh.path())!, "utf8");
    expect(xml).toContain(`<RefDesc>${nomor}</RefDesc>`);
    expect(xml).toContain("<BuyerTin>0811034248502000</BuyerTin>");
    // 30 x 22.200 termasuk PPN: DPP 600.000, DPP nilai lain 550.000, PPN 66.000 (templat DJP: 11/12, tarif 12).
    const blok = xml.slice(xml.indexOf(`<RefDesc>${nomor}</RefDesc>`));
    expect(blok).toMatch(/<TaxBase>600000<\/TaxBase>\s*<OtherTaxBase>550000<\/OtherTaxBase>\s*<VATRate>12<\/VATRate>\s*<VAT>66000<\/VAT>/);
    expect(periksaFaktur(xml)).toEqual([]);
    const dir = join(__dirname, "..", "test-results", "faktur");
    mkdirSync(dir, { recursive: true });
    const f = join(dir, "unduhan.xml");
    writeFileSync(f, xml);
    const v = spawnSync("python", ["-I", join(__dirname, "..", "..", "..", "scripts", "pajak", "validasi-xsd.py"), f], { encoding: "utf8" });
    expect(v.stdout, v.stderr).toContain("LOLOS");
    expect(v.status, v.stdout).toBe(0);
  } finally {
    await sb.rpc("batal_invoice", { p_id: invId, p_alasan: "Invoice uji faktur pajak" });
  }
});

test("e-Bupot: potong PPh 23 tagihan pemasok, unduh XML BpuBulk yang lolos aturan dan skema; kalender PMK 81/2024 tampil", async ({ page }) => {
  test.setTimeout(120_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const pemasok = `CV Katering Uji ${tanda}`;
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const hari = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  const tg = await sb.rpc("buat_tagihan_beli", { p_pemasok: pemasok, p_nomor: `KT-${tanda}`, p_tanggal: hari, p_jatuh_tempo: hari, p_total: 1_500_000, p_dokumen: null, p_akun: null, p_kunci: crypto.randomUUID() });
  expect(tg.error).toBeNull();
  const tagihanId = (tg.data as { id: string }).id;

  await page.goto(`/masuk?next=${encodeURIComponent("/app/pajak/faktur")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/pajak/faktur");

  const kal = page.getByTestId("kalender-pajak");
  await expect(kal).toContainText("Setor PPh dipotong");
  await expect(kal).toContainText("PMK 81/2024 Pasal 94 ayat (2)");
  await expect(page.getByTestId("rekap-ppn")).toBeVisible();

  const form = page.getByRole("form", { name: `Potong PPh untuk ${pemasok}` });
  await form.getByLabel("Kode objek pajak").fill("24-104-39");
  await form.getByLabel("NPWP/NIK pemasok").fill("0811034248502000");
  await form.getByRole("button", { name: "Potong PPh" }).click();
  // tersimpan: tagihan tetap terbuka (sisa Rp1.470.000), bukti potong muncul di daftar
  await expect(page.getByTestId("bupot").locator("li", { hasText: pemasok })).toContainText("Rp30.000");
  const { data: t } = await sb.from("tagihan_beli").select("dikurangi").eq("id", tagihanId).single();
  expect(t?.dikurangi).toBe(30000);

  const [unduh] = await Promise.all([page.waitForEvent("download"), page.getByTestId("unduh-bupot").click()]);
  expect(unduh.suggestedFilename()).toMatch(/^bupot-unifikasi-\d{4}-\d{2}\.xml$/);
  const xml = readFileSync((await unduh.path())!, "utf8");
  expect(xml).toContain("<TaxObjectCode>24-104-39</TaxObjectCode>");
  expect(xml).toContain("<CounterpartTin>0811034248502000</CounterpartTin>");
  expect(periksaBupot(xml)).toEqual([]);
  const dir = join(__dirname, "..", "test-results", "faktur");
  mkdirSync(dir, { recursive: true });
  const f = join(dir, "bupot.xml");
  writeFileSync(f, xml);
  const v = spawnSync("python", ["-I", join(__dirname, "..", "..", "..", "scripts", "pajak", "validasi-xsd.py"), f], { encoding: "utf8" });
  expect(v.status, v.stdout).toBe(0);
  // bayar sisa supaya tagihan uji tidak menggantung
  expect((await sb.rpc("bayar_tagihan_beli", { p_tagihan: tagihanId, p_jumlah: 1_470_000, p_cara: "transfer", p_tanggal: null, p_kunci: crypto.randomUUID() })).error).toBeNull();
});
