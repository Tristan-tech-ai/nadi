import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-08: pemilik (akun B) dengan dua usaha uji "Uji Konsol Induk E2E" dan "Uji Konsol Anak E2E" memakai halaman
// /app/buku/lanjut: anggaran per akun, cabang + aturan kata yang menandai jurnal baru, jurnal berulang dibukukan lalu
// dihentikan, kurs usaha di kalkulator, transaksi antarusaha, dan konsolidasi yang angkanya sama dengan RPC.
// Usaha aktif akun B dikembalikan di akhir.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const INDUK = "Uji Konsol Induk E2E";
const ANAK = "Uji Konsol Anak E2E";

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

test("akuntansi lanjutan: anggaran, cabang, jurnal berulang, kurs, antarusaha, konsolidasi", async ({ page }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const id: Record<string, string> = {};
  try {
    for (const [k, nama, industri] of [["anak", ANAK, "fnb"], ["induk", INDUK, "toko"]] as const) {
      const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", nama).limit(1);
      if (ada?.[0]) id[k] = ada[0].id as string;
      else {
        const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: nama, p_industri: industri });
        expect(error).toBeNull();
        id[k] = data as string;
      }
    }
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: id.induk })).error).toBeNull();
    await sb.auth.refreshSession();
    const tanda = Date.now().toString(36).toUpperCase();

    await page.goto(`/masuk?next=${encodeURIComponent("/app/buku/lanjut")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/buku/lanjut");
    await expect(page.getByRole("heading", { level: 1, name: "Anggaran, cabang, dan konsolidasi" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Anggaran sewa bulan ini.
    const fa = page.getByRole("form", { name: "Anggaran dan realisasi" });
    await fa.getByLabel("Akun").selectOption("6-200");
    await fa.getByLabel("Anggaran per bulan (Rp)").fill("600.000");
    await fa.getByRole("button", { name: "Simpan anggaran" }).click();
    await expect(fa.getByRole("status")).toHaveText("Anggaran 6-200 tersimpan untuk 1 bulan.");
    await page.reload();
    await expect(page.getByTestId("laporan-anggaran").locator('tr[data-kode="6-200"]')).toContainText("Rp600.000");

    // Cabang + aturan kata, lalu jurnal baru berketerangan kata itu tertandai sendiri.
    const fd = page.getByRole("form", { name: "Cabang dan proyek" });
    await fd.getByLabel("Nama").fill("Cabang Kuta E2E");
    await fd.getByRole("button", { name: "Tambah" }).click();
    await expect(fd.getByRole("status")).toHaveText("Cabang Kuta E2E tersimpan.");
    await page.reload();
    await page.waitForLoadState("networkidle");
    const fr = page.getByRole("form", { name: "Aturan kata" });
    await fr.getByLabel("Cabang atau proyek").selectOption({ label: "Cabang: Cabang Kuta E2E" });
    await fr.getByLabel("Kata di keterangan jurnal").fill("kuta e2e");
    await fr.getByRole("button", { name: "Simpan aturan" }).click();
    await expect(fr.getByRole("status")).toHaveText("Aturan tersimpan.");
    const { data: j, error: ej } = await sb.rpc("posting_jurnal", { p_kepala: { keterangan: `Jual tunai Kuta E2E ${tanda}` }, p_baris: [{ akun: "1-100", debit: 250000 }, { akun: "4-100", kredit: 250000 }] });
    expect(ej).toBeNull();
    const { data: tag } = await sb.from("journal_tag").select("sumber").eq("jurnal_id", (j as { id: string }).id).single();
    expect(tag?.sumber).toBe("aturan");
    await page.reload();
    await expect(page.getByTestId("lr-cabang").locator('tr[data-dimensi="Cabang Kuta E2E"]')).toBeVisible();

    // Jurnal berulang mulai hari ini: dibukukan sekali, lalu dihentikan agar jalan berikutnya tidak menumpuk jurnal.
    const nama = `Sewa gudang E2E ${tanda}`;
    const fb = page.getByRole("form", { name: "Jurnal berulang" });
    await fb.getByLabel("Nama").fill(nama);
    await fb.getByLabel("Jumlah (Rp)").fill("1.000.000");
    await fb.getByLabel("Akun debit (biasanya beban)").selectOption("6-200");
    await fb.getByLabel("Akun kredit (biasanya kas atau bank)").selectOption("1-110");
    await fb.getByRole("button", { name: "Simpan jadwal" }).click();
    await expect(fb.getByRole("status")).toContainText("Jadwal tersimpan");
    const fj = page.getByRole("form", { name: "Bukukan yang sudah jatuh tempo" });
    await fj.getByRole("button", { name: "Bukukan yang sudah jatuh tempo" }).click();
    await expect(fj.getByRole("status")).toHaveText(/^\d+ jurnal dibukukan\.$/);
    await page.reload();
    const baris = page.getByTestId("daftar-berulang").locator(`li[data-nama="${nama}"]`);
    await expect(baris).toContainText("1 kali dibukukan");
    await baris.getByRole("button", { name: `Hentikan: ${nama}` }).click();
    await expect(baris).toContainText("Berhenti");

    // Kurs usaha hari ini menang di kalkulator: 100 USD x Rp18.200 = Rp1.820.000.
    const fk = page.getByRole("form", { name: "Kurs usahamu" });
    await fk.getByLabel("Valuta", { exact: true }).fill("USD");
    await fk.getByLabel("Kurs (Rp per 1 unit)").fill("18.200");
    await fk.getByLabel("Sumber kurs").fill("Kurs jual bank (uji e2e)");
    await fk.getByRole("button", { name: "Simpan kurs" }).click();
    await expect(fk.getByRole("status")).toHaveText("Kurs USD tersimpan.");
    await page.reload();
    await page.waitForLoadState("networkidle");
    const kal = page.getByTestId("kalkulator-kurs");
    await kal.getByLabel("Valuta", { exact: true }).selectOption("USD");
    await kal.getByLabel("Jumlah valuta").fill("100");
    await expect(kal.getByTestId("hasil-kurs")).toHaveText("Rp1.820.000");

    // Transaksi antarusaha induk menjual ke anak, lalu konsolidasi dua usaha.
    const fi = page.getByRole("form", { name: "Transaksi antarusaha" });
    await fi.getByLabel("Usaha lawan").selectOption({ label: ANAK });
    await fi.getByLabel("Jumlah (Rp)").fill("500.000");
    await fi.getByLabel("Keterangan").fill(`Jasa kelola E2E ${tanda}`);
    await fi.getByRole("button", { name: "Catat di dua usaha" }).click();
    await expect(fi.getByRole("status")).toHaveText("Tercatat di dua usaha.");
    const fg = page.getByTestId("form-konsolidasi");
    await fg.getByLabel(INDUK).check();
    await fg.getByLabel(ANAK).check();
    await fg.getByRole("button", { name: "Gabungkan" }).click();
    await page.waitForURL(/g=/);
    await expect(page.getByTestId("konsolidasi-seimbang")).toHaveAttribute("data-seimbang", "ya");
    const url = new URL(page.url());
    const { data: k } = await sb.rpc("consolidated_report", { p_perusahaan: [id.induk, id.anak], p_dari: url.searchParams.get("dari"), p_sampai: url.searchParams.get("sampai") });
    const K = k as { eliminasi: { jurnal: number }; laba_rugi: { laba: number } };
    expect(K.eliminasi.jurnal).toBeGreaterThanOrEqual(4);
    await expect(page.getByTestId("eliminasi")).toContainText(`${K.eliminasi.jurnal} baris jurnal antarusaha`);
    await expect(page.getByTestId("konsolidasi")).toContainText(`Rp${Math.abs(K.laba_rugi.laba).toLocaleString("id-ID")}`);
    await expect(page.getByTestId("konsolidasi").locator('tr[data-kode="1-250"]')).toHaveCount(0);
    await periksaUi(page, "buku-lanjut");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
