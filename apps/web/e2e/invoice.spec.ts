import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { crc16, tlv } from "../src/lib/invoice/qris";

// F4-05: pemilik memasang QRIS statis (foto stiker sintetis), menerbitkan invoice jatuh tempo hari ini, melihat pengingat hari
// ini dengan tautan wa.me (tidak dikirim: wa.me diblokir di uji), pelanggan membuka halaman tagihan berisi QR asli tanpa nominal,
// lalu pemilik menandai lunas; invoice kedua dibatalkan. Semua invoice uji berakhir lunas atau batal (umur piutang tidak menumpuk).
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

// QRIS statis sintetis (bukan merchant nyata), CRC dihitung seperti stiker asli.
function qrisSintetis(): string {
  const isi = [tlv("00", "01"), tlv("01", "11"), tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1026000000001") + tlv("03", "UMI")),
    tlv("52", "5812"), tlv("53", "360"), tlv("58", "ID"), tlv("59", "WARUNG UJI NADI"), tlv("60", "DENPASAR")].join("") + "6304";
  return isi + crc16(isi);
}

test("invoice: QRIS statis, terbit, pengingat hari ini, halaman tagihan, lunas, batal", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid as string;
  const { data: usaha } = await sb.from("perusahaan").select("nama, zona_waktu").eq("id", pid).single();
  expect(usaha?.nama, "usaha aktif akun A harus Warung Uji A").toBe("Warung Uji A");
  const hari = new Intl.DateTimeFormat("en-CA", { timeZone: usaha!.zona_waktu as string }).format(new Date());
  const t = Date.now().toString(36);
  const pelanggan = `Pelanggan ${t}`;
  const payload = qrisSintetis();
  const berkasQr = test.info().outputPath("qris-sintetis.png");
  await QRCode.toFile(berkasQr, payload, { width: 600, margin: 4 });
  await page.context().route("https://wa.me/**", (r) => r.abort());

  await page.goto(`/masuk?next=${encodeURIComponent("/app/invoice")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/invoice");

  // Tujuan bayar dari foto stiker.
  const bayar = page.getByRole("form", { name: "Tujuan bayar" });
  await bayar.getByTestId("foto-qris").setInputFiles(berkasQr);
  await expect(bayar.getByTestId("baca-qris")).toContainText("Terbaca: WARUNG UJI NADI, DENPASAR (NMID ID1026000000001)");
  await bayar.getByLabel("Rekening transfer (opsional)").fill("BCA 1234567890 a.n. Warung Uji A");
  await bayar.getByRole("button", { name: "Simpan tujuan bayar" }).click();
  await expect(page.getByRole("form", { name: "Tujuan bayar" }).getByRole("status")).toContainText("QRIS atas nama WARUNG UJI NADI");
  await expect(page.getByTestId("bayar-belum")).toHaveCount(0);
  expect((await sb.from("bayar_usaha").select("qris").single()).data?.qris, "QR disimpan apa adanya").toBe(payload);

  // Invoice jatuh tempo hari ini: total dihitung langsung di layar.
  const f = page.getByRole("form", { name: "Invoice baru" });
  await f.getByLabel("Pelanggan", { exact: true }).fill(pelanggan);
  await f.getByLabel("WhatsApp pelanggan (opsional)").fill("0812 3456 7890");
  await f.getByLabel("Uraian baris 1").fill("Nasi kotak");
  await f.getByLabel("Jumlah baris 1").fill("50");
  await f.getByLabel("Harga satuan baris 1").fill("25.000");
  await f.getByRole("button", { name: "Tambah baris" }).click();
  await f.getByLabel("Uraian baris 2").fill("Air mineral");
  await f.getByLabel("Jumlah baris 2").fill("1,5");
  await f.getByLabel("Harga satuan baris 2").fill("3.333");
  await expect(f.getByTestId("total-invoice")).toHaveText("Total Rp1.255.000");
  await f.getByLabel("Jatuh tempo").fill(hari);
  await f.getByRole("button", { name: "Terbitkan invoice" }).click();
  await expect(page.getByRole("form", { name: "Invoice baru" }).getByRole("status")).toContainText("Terbit:");

  const baris = page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan });
  await expect(baris).toContainText("Belum dibayar");
  await expect(baris.getByTestId("kirim-invoice")).toHaveAttribute("href", /^https:\/\/wa\.me\/6281234567890\?text=Halo%20Pelanggan/);
  const pengingat = page.getByTestId("baris-pengingat").filter({ hasText: pelanggan });
  await expect(pengingat).toContainText("Jatuh tempo hari ini");
  await expect(pengingat.getByTestId("kirim-pengingat")).toHaveAttribute("href", /wa\.me\/6281234567890\?text=.*jatuh%20tempo%20hari%20ini/);
  await periksaUi(page, "invoice-pemilik");

  // Membuka pengingat mencatatnya terkirim (tab wa.me diblokir dan ditutup).
  const tab = page.context().waitForEvent("page");
  await pengingat.getByTestId("kirim-pengingat").click();
  await (await tab).close();
  await expect.poll(async () => { await page.reload(); return page.getByTestId("baris-pengingat").filter({ hasText: pelanggan }).count(); }, { timeout: 20_000 }).toBe(0);

  // Halaman tagihan pelanggan, tanpa akun.
  const href = await page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan }).getByRole("link", { name: "Lihat halaman tagihan" }).getAttribute("href");
  const pel = await (await browser.newContext()).newPage();
  await pel.goto(href!);
  await expect(pel.getByTestId("total-tagihan")).toHaveText("Rp1.255.000");
  await expect(pel.getByTestId("qris-tagihan")).toContainText("Pindai, lalu ketik nominal Rp1.255.000");
  await expect(pel.getByTestId("qris-tagihan").locator("svg")).toHaveCount(1);
  await expect(pel.getByTestId("tagihan")).toContainText("BCA 1234567890 a.n. Warung Uji A");
  await expect(pel.getByTestId("tagihan")).not.toContainText("0812");
  await periksaUi(pel, "invoice-tagihan");

  // Lunas lewat QRIS.
  const barisNya = page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan });
  await barisNya.getByRole("button", { name: "Tandai lunas" }).click();
  await expect(page.getByTestId("baris-daftar-invoice").filter({ hasText: pelanggan })).toContainText("lewat QRIS");
  await pel.reload();
  await expect(pel.getByTestId("tagihan-lunas")).toContainText("Sudah lunas");
  await expect(pel.getByTestId("qris-tagihan")).toHaveCount(0);
  await pel.context().close();

  // Invoice kedua dibatalkan.
  const f2 = page.getByRole("form", { name: "Invoice baru" });
  await f2.getByLabel("Pelanggan", { exact: true }).fill(`${pelanggan} batal`);
  await f2.getByLabel("Uraian baris 1").fill("Katering");
  await f2.getByLabel("Harga satuan baris 1").fill("200.000");
  await f2.getByRole("button", { name: "Terbitkan invoice" }).click();
  await expect(page.getByRole("form", { name: "Invoice baru" }).getByRole("status")).toContainText("Terbit:");
  const b2 = page.getByTestId("baris-daftar-invoice").filter({ hasText: `${pelanggan} batal` });
  await b2.getByText("Batalkan invoice").click();
  await b2.getByLabel("Alasan").fill("Pesanan dibatalkan pelanggan");
  await b2.getByRole("button", { name: "Batalkan" }).click();
  await expect(page.getByTestId("baris-daftar-invoice").filter({ hasText: `${pelanggan} batal` })).toContainText("Dibatalkan: Pesanan dibatalkan pelanggan");
});
