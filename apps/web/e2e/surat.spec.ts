import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { tolakUsulanLama } from "./bersih";

// F4-03: usulan dokumen.surat (bentuk yang dibuat Lempar dari surat bernomor; dimasukkan langsung supaya tanpa token AI)
// disetujui di Feed -> agenda bernomor muncul di /app/surat; pihak yang namanya jelas cocok ditaut otomatis, pihak yang ragu
// menampilkan dua kandidat dan ditaut manual; status tindak lanjut disimpan. Usaha aktif akun A; nama dan nomor unik per jalan.
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

test("agenda surat: setujui di Feed, nomor agenda, pihak ditaut otomatis atau dipilih saat ragu, status", async ({ page }) => {
  test.setTimeout(150_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  expect(pid).toBeTruthy();
  await tolakUsulanLama(sb);
  const t = Date.now().toString(36).toUpperCase();
  const jelas = `Rahma Surat ${t}`;
  const ragu1 = `Bayu ${t} Santoso`;
  const ragu2 = `Bayu ${t} Saputra`;
  expect((await sb.from("orang").insert([jelas, ragu1, ragu2].map((nama) => ({ perusahaan_id: pid, nama })))).error).toBeNull();
  const surat = (nomor: string, jenis: string, pihak: string) => ({
    perusahaan_id: pid, sumber: "lempar", aksi: "dokumen.surat", judul: `Arsipkan ${jenis} ${nomor}`, penjelasan: `Untuk ${pihak}. Dibaca dari surat, yakin 90%.`,
    keyakinan: 0.9, payload: { jenis: "surat", bidang: { nomor, jenis, tanggal: "2026-10-28", pihak }, ringkasan: `${jenis} untuk ${pihak}` },
  });
  const nomor1 = `012/SK/${t}/2026`;
  const nomor2 = `07/ST/${t}/2026`;
  expect((await sb.from("usulan").insert([surat(nomor1, "Surat Keputusan Mutasi", jelas), surat(nomor2, "Surat Tugas", `Bayu ${t}`)])).error).toBeNull();

  await page.goto("/masuk?next=/app");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  for (const nomor of [nomor1, nomor2]) {
    const kartu = page.locator("article", { hasText: nomor }).first();
    await kartu.getByRole("button", { name: "Setujui" }).click();
    await expect(kartu.getByTestId("hasil-putusan")).toContainText(/Masuk agenda surat \d{3}\/AG\/\d{4}/);
  }

  await page.goto(`/app/surat?q=${encodeURIComponent(t)}`);
  const daftar = page.getByTestId("daftar-agenda");
  const s1 = daftar.getByRole("listitem").filter({ hasText: nomor1 });
  const s2 = daftar.getByRole("listitem").filter({ hasText: nomor2 });
  await expect(s1).toContainText(/\d{3}\/AG\/\d{4}/);
  await expect(s1.getByTestId("pihak-surat")).toContainText(`Pihak: ${jelas} (ditaut otomatis, yakin 100%)`);
  await expect(s2.getByTestId("pihak-surat")).toContainText("Nadi ragu di antara dua nama");
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, `surat-${lebar}-${skema}.png`) : test.info().outputPath(`surat-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });

  await s2.getByRole("button", { name: new RegExp(`Taut ke ${ragu2}`) }).click();
  // Setelah tertaut, formulir pilihan hilang dan barisnya sendiri yang menjadi tanda berhasil.
  await expect(s2.getByTestId("pihak-surat")).toContainText(`Pihak: ${ragu2} (dipilih manual)`);
  await page.reload();
  await expect(daftar.getByRole("listitem").filter({ hasText: nomor2 }).getByTestId("pihak-surat")).toContainText(`Pihak: ${ragu2} (dipilih manual)`);

  await s1.getByText("Ubah status atau catatan").click();
  const f1 = s1.getByRole("form", { name: /Tindak lanjut surat/ });
  await f1.getByLabel("Status").selectOption("selesai");
  await f1.getByLabel("Catatan").fill("Sudah diterima Rahma");
  await f1.getByRole("button", { name: "Simpan" }).click();
  await expect(f1.getByText("Tersimpan.")).toBeVisible();
  await expect(s1).toContainText("Catatan: Sudah diterima Rahma");
  await page.goto(`/app/surat?status=selesai&q=${encodeURIComponent(t)}`);
  await expect(page.getByTestId("daftar-agenda").getByRole("listitem")).toHaveCount(1);
  await expect(page.getByTestId("daftar-agenda")).toContainText(nomor1);
});
