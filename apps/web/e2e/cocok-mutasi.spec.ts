import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F4-06: dua invoice sintetis terbit hari ini; CSV mutasi berisi transfer yang menyebut nomor invoice pertama, transfer bernama
// pelanggan kedua, dan satu debit. Pemilik mengunggah, melihat dua cocok beserta alasannya, lalu menandai lunas dengan satu tombol.
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

test("cocok mutasi: CSV, dua invoice cocok beserta alasan, tandai lunas", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid as string;
  const { data: usaha } = await sb.from("perusahaan").select("nama, zona_waktu").eq("id", pid).single();
  expect(usaha?.nama, "usaha aktif akun A harus Warung Uji A").toBe("Warung Uji A");
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: usaha!.zona_waktu as string }).format(new Date());
  const t = Date.now().toString(36);
  const harga = 7_000_000 + (Date.now() % 997) * 1000;
  const buat = async (pelanggan: string, nilai: number) => {
    const { data, error } = await sb.rpc("buat_invoice", { p_pelanggan: pelanggan, p_hp: null, p_baris: [{ uraian: "Katering uji", jumlah: 1, harga: nilai }],
      p_jatuh_tempo: hari, p_catatan: null, p_kunci: crypto.randomUUID() });
    expect(error).toBeNull();
    return data as { id: string; nomor: string };
  };
  const i1 = await buat(`Pelanggan Mutasi ${t}`, harga);
  const i2 = await buat(`Toko Mutasi ${t}`, harga + 500);
  const [y, m, d] = hari.split("-");
  const csv = ["Tanggal,Keterangan,Cabang,Jumlah,DB/CR,Saldo",
    `${d}/${m}/${y},"TRSF E-BANKING CR ${i1.nomor}",0000,${harga}.00,CR,20000000.00`,
    `${d}/${m}/${y},"TRSF E-BANKING CR TOKO MUTASI ${t.toUpperCase()}",0000,${harga + 500}.00,CR,27000000.00`,
    `${d}/${m}/${y},"PEMBAYARAN LISTRIK PLN",0000,${harga}.00,DB,13000000.00`].join("\n");

  try {
    await page.goto(`/masuk?next=${encodeURIComponent("/app/invoice")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/invoice");

    const f = page.getByRole("form", { name: "Cocokkan mutasi" });
    await f.getByTestId("csv-mutasi").setInputFiles({ name: "mutasi.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await f.getByRole("button", { name: "Cocokkan" }).click();
    const hasil = page.getByTestId("hasil-cocok");
    await expect(hasil.getByTestId("baris-cocok").filter({ hasText: i1.nomor })).toContainText("Dasar: nomor invoice disebut.");
    await expect(hasil.getByTestId("baris-cocok").filter({ hasText: i2.nomor })).toContainText("Dasar: nama pelanggan dan nominal sama.");
    await periksaUi(page, "cocok-mutasi");

    await hasil.getByRole("button", { name: /^Tandai lunas \d+ invoice$/ }).click();
    await expect(page.getByTestId("hasil-lunas-mutasi")).toContainText("tercatat lunas lewat transfer.");
    const { data: st } = await sb.from("invoice").select("id, status, lunas_cara, lunas_tanggal").in("id", [i1.id, i2.id]);
    expect(st?.map((x) => `${x.status}/${x.lunas_cara}/${x.lunas_tanggal}`).sort()).toEqual([`lunas/transfer/${hari}`, `lunas/transfer/${hari}`]);
  } finally {
    const { data: sisa } = await sb.from("invoice").select("id").in("id", [i1.id, i2.id]).eq("status", "terbit");
    for (const s of sisa ?? []) await sb.rpc("batal_invoice", { p_id: s.id, p_alasan: "Data uji e2e" });
  }
});
