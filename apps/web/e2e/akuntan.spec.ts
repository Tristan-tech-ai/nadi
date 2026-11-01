import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";

// F4-08: pemilik (akun A) menambahkan akun B sebagai akuntan "Uji Gaji E2E" (usaha dengan gaji disetujui dari gaji.spec). B membuka
// klien itu dari Ruang Akuntan, mengisi NPWP pemotong, mengunduh BPMP sebulan, dan berkasnya dibaca ulang: sheet DATA dengan judul
// template v.3 DJP. Usaha aktif A dan B dikembalikan di akhir (spec lain bergantung padanya); jalankan tidak paralel dengan gaji.spec.
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

const klien = () => createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
const pid = async (sb: ReturnType<typeof klien>) => ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid as string;

test("ruang akuntan: tambah akuntan, buka klien, NPWP, unduh BPMP sesuai template DJP", async ({ page }) => {
  test.setTimeout(180_000);
  const a = klien();
  expect((await a.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const b = klien();
  expect((await b.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const awalA = await pid(a);
  const awalB = await pid(b);
  const { data: gaji } = await a.from("perusahaan").select("id").eq("nama", "Uji Gaji E2E").single();
  try {
    expect((await a.rpc("pindah_perusahaan", { p_perusahaan: gaji!.id })).error).toBeNull();
    await a.auth.refreshSession();
    const t = await a.rpc("tambah_akuntan", { p_email: E.E2E_EMAIL_B });
    expect(t.error).toBeNull();
    expect(String(t.data)).toContain("Bila email itu sudah punya akun Nadi");

    await page.goto(`/masuk?next=${encodeURIComponent("/app/akuntan")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/akuntan");
    const baris = page.getByTestId("baris-klien").filter({ hasText: "Uji Gaji E2E" });
    await expect(baris).toContainText("Akuntan");
    if ((await baris.getByTestId("klien-aktif").count()) === 0) {
      await baris.getByRole("button", { name: "Buka Uji Gaji E2E" }).click();
      await page.waitForURL((u) => u.pathname === "/app/akuntan");
    }
    await expect(page.getByTestId("baris-klien").filter({ hasText: "Uji Gaji E2E" }).getByTestId("klien-aktif")).toHaveText("Sedang dibuka");

    const f = page.getByRole("form", { name: "Identitas pemotong" });
    await f.getByLabel("NPWP pemotong (16 angka)").fill("3172022407981234");
    await f.getByLabel("ID TKU (22 angka, boleh kosong)").fill("");
    await f.getByRole("button", { name: "Simpan identitas" }).click();
    await expect(f.getByRole("status")).toHaveText("Tersimpan.");
    await expect(f.getByLabel("ID TKU (22 angka, boleh kosong)")).toHaveValue("");
    const tautan = page.getByTestId("unduh-bpmp").getByRole("link").filter({ hasNotText: "Des" }).first();
    await expect(tautan).toBeVisible();
    await periksaUi(page, "ruang-akuntan");

    const unduh = page.waitForEvent("download");
    await tautan.click();
    const berkas = await (await unduh).path();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(berkas);
    const ws = wb.getWorksheet("DATA")!;
    expect(ws.getCell("A1").value).toBe("NPWP Pemotong");
    expect(ws.getCell("B1").value).toBe("3172022407981234");
    expect((ws.getRow(4).values as unknown[]).slice(2)).toEqual(["Masa Pajak", "Tahun Pajak", "Status Pegawai", "NPWP/NIK/TIN", "Nomor Passport", "Status", "Posisi",
      "Sertifikat/Fasilitas", "Kode Objek Pajak", "Penghasilan Kotor", "Tarif", "ID TKU", "Tgl Pemotongan"]);
    expect(ws.getCell("D5").value).toBe("Resident");
    expect(ws.getCell("J5").value).toBe("21-100-01");
    expect(Number(ws.getCell("K5").value)).toBeGreaterThan(0);
    expect(typeof ws.getCell("L5").value).toBe("number");
    expect(ws.getCell("M5").value).toBe("3172022407981234000000");
    expect(ws.getCell("E5").value ?? null).toBeNull();
  } finally {
    await b.rpc("pindah_perusahaan", { p_perusahaan: awalB });
    await a.rpc("pindah_perusahaan", { p_perusahaan: awalA });
  }
});
