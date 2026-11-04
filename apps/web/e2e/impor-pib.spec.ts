import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// B-EKSIM3: PIB yang dilempar terbaca sebagai usulan jurnal impor di Feed; menyetujuinya memposting jurnal persediaan, PPN
// masukan impor, PPh 22 impor dibayar di muka, utang pemasok valas, dan bank (trigger app.jurnal_pib).
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "pabean");

async function periksa(page: Page, nama: string, el: Locator) {
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await el.evaluate((x) => x.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${w} ${skema}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${nama} ${w} tanpa gulir datar`).toBeLessThanOrEqual(w);
      await el.screenshot({ path: test.info().outputPath(`${nama}-${w}-${skema}.png`) });
    }
  }
}

test("PIB dilempar menjadi usulan jurnal impor; disetujui = jurnal tercatat", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const benar = JSON.parse(readFileSync(join(KORPUS, "pib-02.json"), "utf8")).bidang;
  // Usulan PIB uji lama yang masih menunggu ditolak dulu agar kartu yang diuji tidak tertukar.
  const { data: lama } = await sb.from("usulan").select("id").eq("aksi", "uang.impor").eq("status", "menunggu");
  for (const u of lama ?? []) await sb.rpc("putuskan_usulan", { p_usulan: u.id, p_setuju: false });

  // Lempar lewat jalur yang sama dengan layar Lempar (daftar, unggah, baca); byte unik supaya diproses sebagai berkas baru.
  const isi = Buffer.concat([readFileSync(join(KORPUS, "pib-02.pdf")), Buffer.from(`\n%${Date.now()}`)]);
  const sha = createHash("sha256").update(isi).digest("hex");
  const { data: d, error: e1 } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: "pib-02.pdf", p_mime: "application/pdf", p_ukuran: isi.length });
  expect(e1).toBeNull();
  expect((await sb.storage.from("berkas").upload(d.jalur, isi, { contentType: "application/pdf" })).error).toBeNull();
  const { data: r, error: e3 } = await sb.functions.invoke("baca-berkas", { body: { berkas_id: d.id } });
  expect(e3).toBeNull();
  expect(r.jenis).toBe("pib");
  const usulanId = r.usulan_id as string;
  expect(usulanId).toBeTruthy();

  await page.goto("/masuk?next=/app");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((x) => x.pathname === "/app");
  const kartu = page.locator("article").filter({ hasText: `Catat impor PIB ${benar.nomor_daftar} dari ${benar.pemasok}` }).first();
  await expect(kartu).toBeVisible();
  await expect(kartu).toContainText("PPN impor Rp9.634.133 (pajak masukan)");
  await expect(kartu).toContainText("PPh 22 impor Rp6.568.727 (kredit pajak)");
  await periksa(page, "pib-feed", kartu);
  await kartu.getByRole("button", { name: "Setujui" }).click();
  await expect(kartu).toHaveAttribute("data-tersimpan", "ya");

  const { data: j } = await sb.from("jurnal").select("id, tanggal, keterangan").eq("sumber", "pib").eq("sumber_id", usulanId).single();
  expect(j?.keterangan).toBe(`Impor PIB ${benar.nomor_daftar} ${benar.pemasok}`);
  // FK jurnal_baris -> akun komposit (perusahaan_id, akun_id): ambil akun terpisah, bukan embed PostgREST.
  const { data: b, error: eb } = await sb.from("jurnal_baris").select("debit, kredit, akun_id").eq("jurnal_id", j!.id);
  expect(eb).toBeNull();
  const { data: akun } = await sb.from("akun").select("id, kode").in("id", (b ?? []).map((x) => x.akun_id));
  const kode = new Map((akun ?? []).map((a) => [a.id, a.kode]));
  const per = Object.fromEntries((b ?? []).map((x) => [kode.get(x.akun_id), Number(x.debit) - Number(x.kredit)]));
  expect(per).toEqual({
    "1-300": benar.nilai_pabean_rp + benar.bm, "1-410": benar.ppn, "1-420": benar.pph, "2-110": -benar.nilai_pabean_rp, "1-110": -(benar.bm + benar.ppn + benar.pph),
  });
});
