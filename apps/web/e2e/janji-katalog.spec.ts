import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-16B: pelanggan tanpa akun memesan jadwal di /janji/<kunci> usaha "Uji Janji E2E" (akun B); pemilik melihatnya di
// /app/janji-temu dan menandai datang; slot yang sudah dipesan hilang dari pilihan; katalog publik membuka wa.me berisi pesanan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Janji E2E";

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

test("janji temu publik dipesan, pemilik melihat dan menandai datang; katalog membuka wa.me terisi", async ({ page, browser }) => {
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
    const { data: kunciJanji, error: e1 } = await sb.rpc("save_booking_setting", { p_aktif: true, p_mulai: "09:00", p_selesai: "17:00", p_hari: [1, 2, 3, 4, 5, 6, 7], p_jeda: 30 });
    expect(e1).toBeNull();
    const { data: lay } = await sb.from("appointment_service").select("id").eq("nama", "Potong rambut").limit(1);
    if (!lay?.length) expect((await sb.rpc("save_appointment_service", { p_id: null, p_nama: "Potong rambut", p_durasi: 60, p_harga: 50000, p_aktif: true })).error).toBeNull();
    const { data: kunciKatalog, error: e2 } = await sb.rpc("save_catalog_setting", { p_aktif: true, p_wa: "0812-9999-8888" });
    expect(e2).toBeNull();
    const { data: prod } = await sb.from("produk").select("id").eq("kode", "SMP-E2E").limit(1);
    if (!prod?.length) expect((await sb.rpc("simpan_produk", { p: { kode: "SMP-E2E", nama: "Sampo herbal", jenis: "barang", satuan: "botol", harga_jual: 45000, barcode: null, boleh_minus: true } })).error).toBeNull();
    const tanda = Date.now().toString(36).toUpperCase();
    const nama = `Bu Sri ${tanda}`;
    const { data: hari } = await sb.rpc("booking_info", { p_kunci: kunciJanji });
    const tgl = new Date(Date.parse(`${(hari as { hari_ini: string }).hari_ini}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);

    // Pelanggan memesan jadwal.
    const v = await (await browser.newContext()).newPage();
    await v.goto(`/janji/${kunciJanji}`);
    await expect(v.getByRole("heading", { level: 1, name: `Pesan jadwal di ${USAHA}` })).toBeVisible();
    await v.waitForLoadState("networkidle");
    await v.getByLabel("Tanggal").fill(tgl);
    // Slot dimuat ulang untuk tanggal baru; tunggu sebelum memilih agar pilihan tidak terhapus.
    await v.waitForLoadState("networkidle");
    await v.waitForTimeout(500);
    const slot = v.getByTestId("slot-janji").locator("label").first();
    await expect(slot).toBeVisible();
    const jam = ((await slot.textContent()) ?? "").trim();
    await slot.click();
    await expect(v.getByRole("button", { name: "Pesan jadwal" })).toBeEnabled();
    await v.getByLabel("Namamu").fill(nama);
    await v.getByLabel("Nomor WhatsApp (boleh kosong)").fill("0813-2222-3333");
    await v.getByRole("button", { name: "Pesan jadwal" }).click();
    await expect(v.getByTestId("janji-berhasil")).toContainText(/Kode [0-9A-F]{8}: Potong rambut/);
    await expect(v.getByTestId("janji-berhasil")).toContainText(`pukul ${jam}`);
    await periksaUi(v, "janji-publik");
    // Jam yang sama tidak bisa dipesan lagi.
    const { data: slotLagi } = await sb.rpc("booking_slots", { p_kunci: kunciJanji, p_layanan: (await sb.from("appointment_service").select("id").eq("nama", "Potong rambut").single()).data!.id, p_tanggal: tgl });
    expect(slotLagi as string[]).not.toContain(jam.replace(".", ":"));

    // Katalog publik.
    await v.goto(`/katalog/${kunciKatalog}`);
    const tombol = v.getByRole("link", { name: "Pesan lewat WhatsApp: Sampo herbal" });
    const href = (await tombol.getAttribute("href")) ?? "";
    expect(href.startsWith("https://wa.me/6281299998888?text=")).toBe(true);
    expect(decodeURIComponent(href.split("text=")[1])).toBe(`Halo ${USAHA}, saya mau pesan Sampo herbal (Rp45.000/botol).`);
    await v.context().close();

    // Pemilik melihat dan menandai datang.
    await page.goto(`/masuk?next=${encodeURIComponent("/app/janji-temu")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/janji-temu");
    await page.waitForLoadState("networkidle");
    const baris = page.getByTestId("daftar-janji").locator(`li[data-nama="${nama}"]`);
    await expect(baris).toContainText("Potong rambut");
    await expect(baris).toContainText("+6281322223333");
    await periksaUi(page, "janji-pemilik");
    await baris.getByRole("button", { name: "Tandai datang" }).click();
    await expect(page.getByTestId("daftar-janji").locator(`li[data-nama="${nama}"]`)).toHaveAttribute("data-status", "datang", { timeout: 15_000 });
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
