import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-15: pemilik (akun B, usaha "Uji CRM E2E") menambah pelanggan, membuat deal, mencatat tugas, menjadikan deal penawaran M-03
// (bernomor PNW, tampil di Penjualan), lalu penawaran dijadikan pesanan dan deal pindah ke "Menang" sendiri.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji CRM E2E";

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

test("crm: pelanggan, deal, tugas, deal menjadi penawaran, pesanan membuat deal menang", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: USAHA, p_industri: "toko" });
      expect(error).toBeNull();
      pid = data as string;
    }
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    const tanda = Date.now().toString(36).toUpperCase();
    const nama = `PT Maju Jaya ${tanda}`;
    const judulDeal = `Seragam drill ${tanda}`;

    await page.goto(`/masuk?next=${encodeURIComponent("/app/pelanggan")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/pelanggan");
    await expect(page.getByRole("heading", { level: 1, name: "Pelanggan dan deal" })).toBeVisible();
    await page.waitForLoadState("networkidle");

    const fp = page.getByRole("form", { name: "Tambah pelanggan" });
    await fp.getByLabel("Nama").fill(nama);
    await fp.getByLabel("Nomor WhatsApp (boleh kosong)").fill("0812-3456-7890");
    await fp.getByLabel("Kota (boleh kosong)").fill("Denpasar");
    await fp.getByRole("button", { name: "Simpan pelanggan" }).click();
    await expect(fp.getByRole("status")).toHaveText(`${nama} tersimpan.`);
    await page.reload();
    await page.waitForLoadState("networkidle");

    const fd = page.getByRole("form", { name: "Tambah deal" });
    await fd.getByLabel("Pelanggan").selectOption({ label: nama });
    await fd.getByLabel("Judul deal").fill(judulDeal);
    await fd.getByLabel("Perkiraan nilai (Rp)").fill("14.000.000");
    await fd.getByRole("button", { name: "Simpan deal" }).click();
    await expect(fd.getByRole("status")).toHaveText("Deal tersimpan.");
    await page.reload();
    await page.waitForLoadState("networkidle");

    let kartu = page.getByTestId("tahap-prospek").locator(`li[data-judul="${judulDeal}"]`);
    await expect(kartu).toContainText("Rp14.000.000");
    await kartu.getByText("Catat aktivitas").click();
    const fa = kartu.getByRole("form", { name: `Catat aktivitas: ${judulDeal}` });
    await fa.getByLabel("Jenis").selectOption("tugas");
    await fa.getByLabel("Jatuh tempo tugas").fill(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date(Date.now() + 2 * 86_400_000)));
    await fa.getByLabel("Isi").fill("Kirim katalog kain");
    await fa.getByRole("button", { name: "Simpan" }).click();
    await expect(fa.getByRole("status")).toHaveText("Tersimpan.");

    const fq = kartu.getByRole("form", { name: `Buat penawaran: ${judulDeal}` });
    await fq.getByLabel("Jumlah").fill("200");
    await fq.getByLabel("Harga satuan (Rp)").fill("75.000");
    await fq.getByRole("button", { name: "Buat penawaran" }).click();
    // revalidatePath memindahkan kartu ke tahap Penawaran (formulir lama terlepas), jadi yang ditunggu adalah akibatnya.
    kartu = page.getByTestId("tahap-penawaran").locator(`li[data-judul="${judulDeal}"]`);
    await expect(kartu).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(kartu).toContainText("Rp15.000.000");
    await expect(kartu.getByTestId("penawaran-deal")).toContainText("/PNW/");
    await expect(kartu.getByTestId("aktivitas-deal")).toContainText("Kirim katalog kain");
    const { data: deal } = await sb.from("deal").select("dokumen_jual_id, dokumen_jual(nomor)").eq("judul", judulDeal).single();
    const nomor = (deal!.dokumen_jual as unknown as { nomor: string }).nomor;
    await periksaUi(page, "crm");

    await page.goto("/app/jual");
    await expect(page.getByText(nomor).first()).toBeVisible();
    // Pesanan dari penawaran (alur M-03): deal menang sendiri.
    expect((await sb.rpc("buat_dokumen_jual", { p_jenis: "pesanan", p_induk: deal!.dokumen_jual_id, p_pelanggan: null, p_hp: null, p_baris: null, p_berlaku: null, p_catatan: null, p_kunci: crypto.randomUUID() })).error).toBeNull();
    await page.goto("/app/pelanggan");
    await expect(page.getByTestId("deal-tutup").locator(`li[data-judul="${judulDeal}"]`)).toHaveAttribute("data-tahap", "menang");
    await expect(page.getByTestId("ringkas-crm")).toBeVisible();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
