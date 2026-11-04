import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-11B: (1) izin staf beratasan menunggu atasan langsung, atasan menyetujui dari Feed-nya, baru sampai ke Feed pemilik; (2) survei
// anonim: ringkasan ditahan sampai 3 jawaban; (3) kolom data tambahan yang boleh dilihat staf; (4) SP terbit sebagai surat bernomor
// ber-QR dan dokumen dari templat jadi draf Surat keluar. Akun A, usaha aktif; orang uji dinonaktifkan di akhir.
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
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

async function masukStaf(browser: Browser, kode: string, id: string, pin: string) {
  const s = await (await browser.newContext()).newPage();
  await s.goto("/masuk/staf");
  await s.getByLabel("Kode usaha").fill(kode);
  await s.getByLabel("ID kamu").fill(id);
  await s.getByLabel("PIN").fill(pin);
  await s.getByRole("button", { name: "Masuk" }).click();
  await expect(s.getByTestId("peran")).toContainText("staf");
  return s;
}

const tanggal = (tambahHari: number) => new Date(Date.now() + 8 * 3600_000 + tambahHari * 86_400_000).toISOString().slice(0, 10);

test("HR lanjutan: rantai atasan, survei anonim, data tambahan, SP dan dokumen jadi surat keluar", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const pemohon = `Pemohon Hr ${tanda}`;
  const atasan = `Atasan Hr ${tanda}`;
  const judulSurvei = `Survei shift ${tanda}`;
  const kolom = `Ukuran seragam ${tanda}`;
  await page.goto("/masuk?next=/app/orang");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/orang/);
  const kode = (await page.getByTestId("kode-usaha").textContent())!.trim();
  const ids: Record<string, string> = {};
  for (const [n, pin] of [[pemohon, "112233"], [atasan, "445566"]]) {
    await page.getByLabel("Nama orang").fill(n);
    await page.getByRole("button", { name: "Tambah" }).click();
    const b = page.getByRole("listitem").filter({ hasText: n });
    await b.getByPlaceholder("PIN 6 angka").fill(pin);
    await b.getByRole("button", { name: "Buat akun staf" }).click();
    ids[n] = (await b.getByTestId("info-akun").textContent())!.match(/ID (S\d{3})/)![1];
  }

  try {
    // Atasan langsung + kolom tambahan + delegasi tampil.
    await page.goto("/app/orang/kerja");
    const fp = page.getByRole("form", { name: "Ubah jabatan dan atasan" });
    await fp.getByLabel("Orang", { exact: true }).selectOption({ label: pemohon });
    await fp.getByLabel("Jabatan", { exact: true }).fill("Kasir");
    await fp.getByLabel("Atasan langsung").selectOption({ label: atasan });
    await fp.getByRole("button", { name: "Simpan jabatan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "riwayat" })).toBeVisible();
    await page.reload();
    const fb = page.getByRole("form", { name: "Tambah kolom data" });
    await fb.getByLabel("Nama kolom").fill(kolom);
    await fb.getByLabel("Jenis isian").selectOption("pilihan");
    await fb.getByLabel(/^Pilihan/).fill("S, M, L");
    await fb.getByLabel("Karyawan boleh melihat isiannya sendiri").check();
    await fb.getByRole("button", { name: "Tambah kolom" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Kolom ditambahkan" })).toBeVisible();
    await page.reload();
    const fn = page.getByRole("form", { name: "Isi data tambahan" });
    await fn.getByLabel("Orang", { exact: true }).selectOption({ label: pemohon });
    await fn.getByLabel("Nama kolom").selectOption({ label: kolom });
    await fn.getByLabel("Isian", { exact: true }).fill("XL");
    await fn.getByRole("button", { name: "Simpan isian" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "tidak cocok" })).toBeVisible();
    // React mengosongkan formulir setelah aksi: pilih ulang orang dan kolom.
    await fn.getByLabel("Orang", { exact: true }).selectOption({ label: pemohon });
    await fn.getByLabel("Nama kolom").selectOption({ label: kolom });
    await fn.getByLabel("Isian", { exact: true }).fill("M");
    await fn.getByRole("button", { name: "Simpan isian" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Isian tersimpan" })).toBeVisible();

    // SP terbit sebagai surat bernomor ber-QR.
    const fs = page.getByRole("form", { name: "Beri surat peringatan" });
    await fs.getByLabel("Orang", { exact: true }).selectOption({ label: pemohon });
    await fs.getByLabel("Pelanggaran", { exact: true }).fill("Selisih kas tanpa laporan");
    await fs.getByRole("button", { name: "Catat surat peringatan" }).click();
    await expect(page.getByRole("status").filter({ hasText: "SP1 tercatat" })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: `Terbitkan surat: ${pemohon}` }).click();
    // Setelah terbit, tombol berganti tautan cetak (komponen tombol dilepas bersama pesannya).
    const cetak = page.getByTestId("daftar-sp").locator(`li[data-orang="${pemohon}"]`).getByRole("link", { name: "Cetak surat peringatan" });
    await expect(cetak).toBeVisible();

    // Templat dokumen bebas jadi draf Surat keluar.
    const ft = page.getByRole("form", { name: "Simpan templat dokumen" });
    await ft.getByLabel("Nama templat").fill(`Penawaran ${tanda}`);
    await ft.getByRole("button", { name: "Simpan templat" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Templat tersimpan" })).toBeVisible();
    await page.reload();
    const fd = page.getByRole("form", { name: "Buat dokumen dari templat" });
    await fd.getByLabel("Nama templat").selectOption({ label: `Penawaran ${tanda}` });
    await fd.getByLabel("Orang", { exact: true }).selectOption({ label: pemohon });
    await fd.getByRole("button", { name: "Buat draf dokumen" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Draf dokumen dibuat" })).toBeVisible();
    await periksaUi(page, "hr-lanjut-kerja");
    await page.goto("/app/surat-keluar");
    await expect(page.getByTestId("daftar-surat-keluar")).toContainText(`Surat Penawaran Kerja ${pemohon}`);
    await expect(page.getByTestId("daftar-surat-keluar")).toContainText("Surat Peringatan Pertama");
    await expect(page.getByTestId("daftar-surat-keluar").getByRole("listitem").filter({ hasText: "Surat Peringatan Pertama" }).filter({ hasText: pemohon })).toContainText("/SP/");

    // Survei anonim: satu jawaban, ringkasan ditahan.
    await page.goto("/app/survei");
    const fsv = page.getByRole("form", { name: "Buat survei" });
    await fsv.getByLabel("Judul", { exact: true }).fill(judulSurvei);
    await fsv.getByLabel("Pertanyaan 1").fill("Seberapa nyaman shift kamu?");
    await fsv.getByRole("button", { name: "Mulai survei" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Survei tampil" })).toBeVisible();

    // Pemohon: izin menunggu atasan; isi survei; lihat data tambahannya.
    const sp = await masukStaf(browser, kode, ids[pemohon], "112233");
    await sp.getByRole("link", { name: "Izin" }).click();
    await sp.getByLabel("Izin", { exact: true }).check({ force: true });
    await sp.getByLabel("Mulai").fill(tanggal(20));
    await sp.getByLabel("Sampai").fill(tanggal(20));
    await sp.getByRole("button", { name: "Ajukan", exact: true }).click();
    await expect(sp.getByTestId("hasil-izin")).toBeVisible();
    await sp.goto("/app/survei");
    const isi = sp.locator(`li[data-judul="${judulSurvei}"]`);
    await isi.getByLabel("4", { exact: true }).check();
    await isi.getByRole("button", { name: "Kirim jawaban" }).click();
    await expect(isi).toContainText(/jawabanmu tersimpan|Sudah kamu isi/);
    await periksaUi(sp, "hr-lanjut-survei-staf");
    await sp.goto("/app/pengumuman");
    await expect(sp.getByTestId("kustom-saya")).toContainText("M");
    await sp.context().close();

    // Pemilik belum melihat izin itu di Feed; atasan menyetujui dari Feed-nya.
    await page.goto("/app");
    const judulIzin = `Setujui izin ${pemohon}`;
    await expect(page.locator("article").filter({ hasText: judulIzin })).toHaveCount(0);
    const sa = await masukStaf(browser, kode, ids[atasan], "445566");
    const kartu = sa.getByTestId("langkah-atasan").locator(`li[data-pemohon="${pemohon}"]`);
    await expect(kartu).toContainText(judulIzin);
    await periksaUi(sa, "hr-lanjut-langkah");
    await kartu.getByRole("button", { name: "Setujui" }).click();
    // Setelah diputus, kartunya hilang dari daftar atasan (halaman dirender ulang).
    await expect(sa.getByTestId("langkah-atasan").locator(`li[data-pemohon="${pemohon}"]`)).toHaveCount(0);
    await sa.context().close();
    await page.reload();
    const kartuPemilik = page.locator("article").filter({ hasText: judulIzin }).last();
    await expect(kartuPemilik).toContainText(`Disetujui atasan ${atasan}`);

    await page.goto("/app/survei");
    await expect(page.locator(`li[data-judul="${judulSurvei}"]`).getByTestId("hasil-ditahan")).toContainText("1 jawaban");
  } finally {
    const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
    await sb.from("orang").update({ status: "nonaktif" }).in("nama", [pemohon, atasan]);
    // Kolom uji dinonaktifkan (bukan dihapus) agar tabel data tambahan tidak bertambah lebar tiap jalan.
    const { data: bk } = await sb.from("bidang_kustom").select("id").eq("label", kolom).maybeSingle();
    if (bk) await sb.rpc("simpan_bidang_kustom", { p_id: bk.id, p_label: kolom, p_tipe: "pilihan", p_pilihan: ["S", "M", "L"], p_staf_lihat: true, p_aktif: false });
  }
});
