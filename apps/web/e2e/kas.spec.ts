import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-05: pemilik (akun A) merekonsiliasi rekening Bank bawaan Warung Uji A di layar:
// - invoice terbuka + tagihan pemasok terbuka dibuat lewat RPC, aturan kata kunci lewat layar;
// - CSV mutasi 3 baris (invoice disebut nomornya, pemasok disebut namanya, biaya dengan kata kunci aturan) diunggah;
// - unggah ulang tidak menggandakan; "Cocokkan semua usulan" melunasi invoice, membayar tagihan, dan mencatat biaya;
// - pencocokan biaya dibatalkan (jurnal dibalik) lalu diabaikan, supaya tidak ada mutasi uji yang menggantung.
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

test("rekonsiliasi: unggah mutasi, cocokkan invoice, tagihan pemasok, dan aturan; batalkan satu", async ({ page }) => {
  test.setTimeout(180_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const acak = 100 + (Date.now() % 800);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const totalInv = 1_000_000 + acak * 1000 + 500;
  const inv = await sb.rpc("buat_invoice", { p_pelanggan: `Pelanggan Kas ${tanda}`, p_hp: null, p_baris: [{ uraian: "Jasa uji kas", jumlah: 1, harga: totalInv }],
    p_jatuh_tempo: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10), p_catatan: null, p_kunci: crypto.randomUUID() });
  expect(inv.error).toBeNull();
  const { id: invId, nomor } = inv.data as { id: string; nomor: string };
  const hari = (await sb.from("invoice").select("tanggal").eq("id", invId).single()).data!.tanggal as string;
  const totalTag = 500_000 + acak * 1000 + 250;
  const tag = await sb.rpc("buat_tagihan_beli", { p_pemasok: `Pemasok Kas ${tanda}`, p_nomor: null, p_tanggal: hari, p_jatuh_tempo: hari, p_total: totalTag, p_dokumen: null, p_akun: null, p_kunci: crypto.randomUUID() });
  expect(tag.error).toBeNull();
  const tagId = (tag.data as { id: string }).id;

  await page.goto(`/masuk?next=${encodeURIComponent("/app/kas")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/kas");

  const aturan = page.getByRole("form", { name: "Simpan aturan" });
  await aturan.getByLabel("Kata kunci").fill(`ADM${tanda}`);
  await aturan.getByLabel("Ke akun").selectOption("6-900");
  await aturan.getByRole("button", { name: "Simpan aturan" }).click();
  await expect(page.locator(`[data-testid=baris-aturan][data-kata="ADM${tanda}"]`)).toBeVisible();

  const [y, m, d] = hari.split("-");
  const csv = ["Tanggal,Keterangan,Cabang,Jumlah,DB/CR,Saldo",
    `${d}/${m}/${y},"TRSF E-BANKING CR ${nomor}",0000,${totalInv}.00,CR,1.00`,
    `${d}/${m}/${y},"TRSF E-BANKING DB PEMASOK KAS ${tanda}",0000,${totalTag}.00,DB,1.00`,
    `${d}/${m}/${y},"BIAYA ADM${tanda}",0000,${acak * 10}.00,DB,1.00`].join("\n");
  const unggah = async () => {
    const f = page.getByRole("form", { name: "Unggah mutasi" });
    await f.getByLabel("Berkas CSV mutasi").setInputFiles({ name: "mutasi.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await f.getByRole("button", { name: "Unggah mutasi" }).click();
  };
  await unggah();
  await expect(page.getByRole("status").filter({ hasText: "3 mutasi masuk" })).toBeVisible();
  await page.reload();
  await unggah();
  await expect(page.getByRole("status").filter({ hasText: "0 mutasi masuk, 3 sudah ada" })).toBeVisible();

  const baris = (ket: string) => page.locator(`[data-testid=baris-mutasi][data-keterangan="${ket}"]`);
  await page.reload();
  await expect(baris(`TRSF E-BANKING CR ${nomor}`)).toContainText("nomor invoice disebut");
  await expect(baris(`TRSF E-BANKING DB PEMASOK KAS ${tanda}`)).toContainText("nama pemasok dan nominal sama");
  await expect(baris(`BIAYA ADM${tanda}`)).toContainText("aturan kata kunci");
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  await page.getByRole("form", { name: "Cocokkan semua usulan" }).getByRole("button").click();
  await expect.poll(async () => (await sb.from("invoice").select("status").eq("id", invId).single()).data?.status, { timeout: 20_000 }).toBe("lunas");
  await expect.poll(async () => (await sb.from("tagihan_beli").select("status").eq("id", tagId).single()).data?.status, { timeout: 20_000 }).toBe("lunas");
  const mutBiaya = async () => (await sb.from("mutasi_bank").select("id, status, cocok_jenis, cocok_id").eq("keterangan", `BIAYA ADM${tanda}`).single()).data;
  await expect.poll(mutBiaya, { timeout: 20_000 }).toMatchObject({ status: "cocok", cocok_jenis: "akun", cocok_id: "6-900" });

  await page.reload();
  const cocok = page.locator(`[data-testid=baris-mutasi-cocok][data-keterangan="BIAYA ADM${tanda}"]`);
  await cocok.locator("summary").click();
  await cocok.getByLabel("Alasan").fill("Uji batal e2e");
  await cocok.getByRole("button", { name: "Batalkan pencocokan" }).click();
  await expect.poll(mutBiaya, { timeout: 20_000 }).toMatchObject({ status: "belum" });
  await page.reload();
  await baris(`BIAYA ADM${tanda}`).getByLabel("Pasangan").selectOption("abaikan|");
  await baris(`BIAYA ADM${tanda}`).getByRole("button", { name: "Cocokkan" }).click();
  await expect.poll(mutBiaya, { timeout: 20_000 }).toMatchObject({ status: "abaikan" });
});
