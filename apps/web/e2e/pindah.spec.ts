import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-24: impor dari aplikasi lama. Akun B, usaha "Uji Kinerja E2E" (akun B sudah di batas 20 usaha). Kontak berformat template Jurnal
// dan daftar produk umum dibuat per jalan dengan penanda unik (supaya bisa diulang), diunggah di /app/pindah, disetujui dari Feed,
// lalu data muncul di tabel; berkas penagihan Jurnal ditolak dengan jujur; unduh semua data berisi lembar-lembar yang dijanjikan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Kinerja E2E";
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "pindah");

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

async function unggah(page: Page, berkas: string) {
  const f = page.getByRole("form", { name: "Unggah berkas dari aplikasi lama" });
  await f.getByLabel("Berkas CSV atau XLSX").setInputFiles(berkas);
  await f.getByRole("button", { name: "Baca dan ajukan" }).click();
  return f;
}

async function setujui(page: Page, judul: string) {
  await page.goto("/app?urut=terbaru");
  const kartu = page.locator("article", { hasText: judul });
  await kartu.getByRole("button", { name: "Setujui" }).click();
  // Kartu punya jendela batal: "Disetujui" tampil dulu, keputusan baru terkirim setelah jendela habis. Tunggu sampai tersimpan.
  await expect(page.getByTestId("kartu-diputuskan").filter({ hasText: judul })).toHaveAttribute("data-tersimpan", "ya", { timeout: 30_000 });
}

test("pindah: kontak Jurnal dan produk diunggah, disetujui di Feed, lalu ada di Nadi; unduh semua data", async ({ page }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    const pid = ada?.[0]?.id as string;
    expect(pid).toBeTruthy();
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const tanda = Date.now().toString(36).toUpperCase();
    const kontak = test.info().outputPath(`kontak-${tanda}.csv`);
    // Judul kolom persis template Kontak Jurnal (help-center.jurnal.id artikel 13804805323545).
    writeFileSync(kontak, readFileSync(join(KORPUS, "jurnal-kontak.csv"), "utf8").split("\n").map((l, i) => i === 0 || !l ? l : l.replace(/^([^,]*),([^,]*),/, `$1,$2 ${tanda},`)).join("\n"));
    const produk = test.info().outputPath(`produk-${tanda}.xlsx`);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Produk");
    ws.addRow(["Kode Produk", "Nama Produk", "Satuan", "Harga Jual", "Stok"]);
    ws.addRow([`TH-${tanda}`, `Teh Melati ${tanda}`, "bks", "Rp6.500", 24]);
    ws.addRow([`KC-${tanda}`, `Kecap Manis ${tanda}`, "btl", 14000, ""]);
    await wb.xlsx.writeFile(produk);

    await page.goto(`/masuk?next=${encodeURIComponent("/app/pindah")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/pindah");
    await page.waitForLoadState("networkidle");

    let f = await unggah(page, join(KORPUS, "jurnal-penagihan.csv"));
    await expect(f.getByRole("alert")).toContainText("Invoice terbuka belum bisa dipindahkan otomatis", { timeout: 30_000 });
    f = await unggah(page, kontak);
    await expect(f.getByRole("status")).toContainText("Usulan dibuat untuk 6 kontak (0 baris dilewati)", { timeout: 30_000 });
    await page.reload();
    f = await unggah(page, produk);
    await expect(f.getByRole("status")).toContainText("Usulan dibuat untuk 2 produk", { timeout: 30_000 });
    await periksaUi(page, "pindah");

    await setujui(page, `Pindahkan 6 kontak dari kontak-${tanda}.csv`);
    await setujui(page, `Pindahkan 2 produk dari produk-${tanda}.xlsx`);
    const { data: pel } = await sb.from("customer").select("nama, hp").like("nama", `%${tanda}`).order("nama");
    expect(pel).toEqual([
      { nama: `Hotel Segara ${tanda}`, hp: "6281234567801" },
      { nama: `Koperasi Tani Makmur ${tanda}`, hp: "6281234567804" },
      { nama: `Warung Bu Ani ${tanda}`, hp: "6281234567802" },
    ]);
    const { data: pr } = await sb.from("produk").select("id, kode, harga_jual").like("kode", `%-${tanda}`).order("kode");
    expect(pr?.map((p) => [p.kode, p.harga_jual])).toEqual([[`KC-${tanda}`, 14000], [`TH-${tanda}`, 6500]]);
    const { data: st } = await sb.from("stok").select("jumlah").eq("produk_id", pr!.find((p) => p.kode === `TH-${tanda}`)!.id);
    expect(Number(st?.[0]?.jumlah)).toBe(24);

    // Unduh semua data.
    await page.goto("/app/pindah");
    const [unduh] = await Promise.all([page.waitForEvent("download"), page.getByTestId("unduh-semua").click()]);
    expect(unduh.suggestedFilename()).toMatch(/^nadi-semua-data-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const isi = new ExcelJS.Workbook();
    await isi.xlsx.readFile((await unduh.path())!);
    expect(isi.worksheets.map((w) => w.name)).toEqual(["Akun", "Jurnal", "Baris jurnal", "Invoice", "Tagihan pemasok", "Pelanggan", "Produk", "Stok", "Orang", "Lembur", "Izin", "Kerja"]);
    const lembarPelanggan = isi.getWorksheet("Pelanggan")!;
    const nama: string[] = [];
    lembarPelanggan.eachRow((r) => nama.push(String(r.getCell(1).value)));
    expect(nama).toContain(`Hotel Segara ${tanda}`);
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
