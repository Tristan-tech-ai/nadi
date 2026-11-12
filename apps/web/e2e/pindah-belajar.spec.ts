import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import ExcelJS from "exceljs";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// T-01C: daftar harga berantakan (docs/promo/aset-demo/harga-berantakan.xlsx) tidak dikenali pengurai bawaan. Unggahan pertama
// dipetakan model (hanya judul + tipe kolom), layar menulis bahwa Nadi sedang mempelajari format baru; peta bayangan dibandingkan
// 2 kali lalu aktif; unggahan berikutnya dibaca tanpa AI. Usulan produk uji ditolak lagi (tombol Tolak biasa) supaya tidak menumpuk.
// Usaha akun B "Uji Kinerja E2E". Jalankan sendirian: spec akun B lain bisa menukar usaha aktif.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Kinerja E2E";
const BERKAS = join(__dirname, "..", "..", "..", "docs", "promo", "aset-demo", "harga-berantakan.xlsx");

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("belajar format pindah data: model sekali, bayangan 2 kali, lalu tanpa AI", async ({ page }) => {
  test.setTimeout(300_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
  const pid = ada?.[0]?.id as string;
  expect(pid).toBeTruthy();
  try {
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    await page.goto(`/masuk?next=${encodeURIComponent("/app/pindah")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/pindah");
    await expect(page.getByTestId("nama-perusahaan")).toHaveText(USAHA);

    const asal: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.goto("/app/pindah");
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("nama-perusahaan")).toHaveText(USAHA);
      // Judul kolom sama (sidik sama), isi berbeda satu baris: usulan dengan isi sama ditolak sebagai ganda oleh propose_migration.
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(BERKAS);
      wb.worksheets[0].addRow(["", `Barang uji ${Date.now().toString(36)}`, "pcs", "1rb", "", ""]);
      const salinan = test.info().outputPath(`harga-${i}.xlsx`);
      await wb.xlsx.writeFile(salinan);
      const f = page.getByRole("form", { name: "Unggah berkas dari aplikasi lama" });
      await f.getByLabel("Berkas CSV atau XLSX").setInputFiles(salinan);
      await f.getByRole("button", { name: "Baca dan ajukan" }).click();
      const status = f.getByRole("status");
      await expect(status).toContainText("Usulan dibuat untuk 14 produk", { timeout: 60_000 });
      const t = (await status.textContent()) ?? "";
      asal.push(t.includes("sedang mempelajari format baru") ? "model" : t.includes("tanpa AI") ? "aturan" : "lain");
      if (i === 0) {
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
        await page.screenshot({ path: test.info().outputPath("pindah-belajar.png"), fullPage: true });
      }
      // Usulan produk uji ditolak lewat jalur biasa (bukan dihapus) supaya Feed usaha uji tidak menumpuk.
      const { data: u } = await sb.from("usulan").select("id").eq("status", "menunggu").eq("aksi", "produk.impor").order("dibuat_at", { ascending: false }).limit(1);
      if (u?.[0]) await sb.rpc("putuskan_usulan", { p_usulan: u[0].id, p_setuju: false });
      if (asal.at(-1) === "aturan") break;
    }
    console.log("PINDAH_BELAJAR", JSON.stringify(asal));
    expect(asal.at(-1)).toBe("aturan");
    expect(asal.filter((x) => x === "model").length).toBeLessThanOrEqual(3);
    expect(asal).not.toContain("lain");
    const { data: peta } = await sb.from("pindah_peta").select("format, peta, status, bayangan_cocok");
    expect(peta).toEqual([expect.objectContaining({ format: "produk", status: "aktif", bayangan_cocok: 2 })]);
    expect((peta![0].peta as Record<string, string>).nama).toBe("barang");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
