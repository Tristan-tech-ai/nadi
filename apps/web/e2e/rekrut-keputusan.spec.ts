import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F2-05: pemilik membuat lowongan Pelayan; tamu 1 melamar dengan izin dihubungi lagi dan mendapat tautan status; pemilik
// menawarkan kerja dengan pesan dari layar penilai (tombol wa.me berisi nomor tamu); halaman status tamu ikut berubah. Tamu 2
// melamar tanpa izin. Lowongan Pelayan kedua menampilkan tamu 1 di Bank Talenta, bukan tamu 2.
// CV memakai berkas korpus apa adanya: sha256 sama, jadi setelah jalan pertama berkasnya dipakai ulang tanpa dibaca AI lagi.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const CV = join(__dirname, "..", "..", "..", "fixtures", "korpus", "cv", "cv-01.pdf");

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function axeDanFoto(p: Page, target: Locator, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await p.setViewportSize({ width: lebar, height: tinggi });
      await p.emulateMedia({ colorScheme: skema });
      await p.waitForTimeout(300);
      const axe = await new AxeBuilder({ page: p }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await target.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`) });
    }
  }
}

async function buatLowongan(page: Page, judul: string) {
  const kartu = page.getByTestId("kartu-lowongan");
  await kartu.getByLabel("Judul lowongan").fill(judul);
  await kartu.getByLabel("Topi (posisi)").selectOption({ label: "Pelayan" });
  await kartu.getByRole("button", { name: "Buat lowongan" }).click();
  const baris = kartu.getByTestId("daftar-lowongan").getByRole("listitem").filter({ hasText: judul });
  await expect(baris).toBeVisible();
  return baris;
}

async function lamar(tamu: Page, tautan: string, nama: string, hp: string, izin: boolean) {
  await tamu.goto(new URL(tautan).pathname);
  await tamu.getByLabel("Nama lengkap").fill(nama);
  await tamu.getByLabel("Nomor HP (WhatsApp)").fill(hp);
  await tamu.getByLabel(/CV: foto atau PDF/).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: readFileSync(CV) });
  const centang = tamu.getByLabel(/Boleh dihubungi lagi untuk lowongan lain di /);
  await expect(centang).not.toBeChecked();
  if (izin) await centang.check();
  await tamu.getByRole("button", { name: "Kirim lamaran" }).click();
  await expect(tamu.getByTestId("lamaran-terkirim")).toBeVisible({ timeout: 60_000 });
}

test("keputusan rekrut: status tanpa akun, tawaran lewat wa.me, Bank Talenta berbasis izin", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  expect((await sb.rpc("pasang_paket", { p_kode: "fnb" })).error).toBeNull();
  await page.goto("/masuk?next=/app/orang");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/app\/orang/);

  const jejak = String(Date.now());
  const baris1 = await buatLowongan(page, `Pelayan keputusan ${jejak}`);
  const tautan1 = (await baris1.getByTestId("tautan-lamar").textContent())!.trim();

  // Tamu 1: melamar dengan izin, mendapat tautan status.
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tamu1 = await ctx1.newPage();
  const nama1 = `Pelamar Izin ${jejak}`;
  const hp1 = `0815${jejak.slice(-8)}`;
  await lamar(tamu1, tautan1, nama1, hp1, true);
  const kotak = tamu1.getByTestId("tautan-status");
  await expect(kotak).toContainText("Simpan tautan ini untuk melihat kabar lamaranmu.");
  const tautanStatus = (await kotak.getByTestId("tautan-status-isi").textContent())!.trim();
  expect(tautanStatus).toMatch(/\/lamar\/status#nml_[0-9a-f]{64}$/);
  await kotak.screenshot({ path: test.info().outputPath("tautan-status-390.png") });

  await tamu1.goto(new URL(tautanStatus).pathname + new URL(tautanStatus).hash);
  await expect(tamu1.getByTestId("status-tahap")).toHaveText("Lamaran diterima Nadi, menunggu dibaca");
  await expect(tamu1.getByTestId("status-lamaran")).toContainText(`Pelayan keputusan ${jejak}`);

  // Token salah dan tautan terpotong memberi pesan jelas.
  const tamuLain = await ctx1.newPage();
  await tamuLain.goto(`/lamar/status#nml_${"0".repeat(64)}`);
  await expect(tamuLain.getByTestId("status-galat")).toContainText("tidak berlaku");
  await tamuLain.goto("/lamar/status#nml_123");
  await expect(tamuLain.getByTestId("status-galat")).toContainText("tidak lengkap");
  await tamuLain.close();

  // Pemilik menawarkan kerja dari layar penilai.
  const { data: la } = await sb.from("lamaran").select("id, telepon, boleh_dihubungi, token_status").eq("nama", nama1).single();
  expect(la!.boleh_dihubungi).toBe(true);
  expect(la!.token_status).toMatch(/^[0-9a-f]{64}$/);
  expect(tautanStatus).not.toContain(la!.token_status);
  await page.goto(`/app/wawancara/${la!.id}`);
  const keputusan = page.getByTestId("keputusan");
  await expect(keputusan.getByTestId("tahap-sekarang")).toHaveText("Belum ditinjau");
  await expect(keputusan.getByTestId("wa-kandidat")).toHaveCount(0);
  const pesan = "Datang Senin 09.00 ke warung, bawa KTP.";
  await keputusan.getByLabel(/Pesan untuk /).fill(pesan);
  await keputusan.getByRole("button", { name: "Tawarkan kerja" }).click();
  await expect(keputusan.getByTestId("tahap-sekarang")).toHaveText("Sudah ditawari kerja");
  const wa = keputusan.getByTestId("wa-kandidat");
  await expect(wa).toHaveAttribute("href", new RegExp(`^https://wa\\.me/62${hp1.slice(1)}\\?text=`));
  const teks = decodeURIComponent((await wa.getAttribute("href"))!.split("?text=")[1]);
  expect(teks).toContain("Kami ingin menawarkan pekerjaan ini kepadamu.");
  expect(teks).toContain(pesan);
  await axeDanFoto(page, keputusan, "keputusan");

  // Halaman status tamu ikut berubah.
  await tamu1.reload();
  await expect(tamu1.getByTestId("status-tahap")).toHaveText("Kamu ditawari pekerjaan");
  await expect(tamu1.getByTestId("status-pesan")).toContainText(pesan);
  await axeDanFoto(tamu1, tamu1.locator("main"), "status-lamaran");
  await ctx1.close();

  // Tamu 2 melamar tanpa izin.
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const tamu2 = await ctx2.newPage();
  const nama2 = `Pelamar Tanpa Izin ${jejak}`;
  await lamar(tamu2, tautan1, nama2, `0816${jejak.slice(-8)}`, false);
  await expect(tamu2.getByTestId("tautan-status")).toBeVisible();
  await ctx2.close();
  const { data: la2 } = await sb.from("lamaran").select("boleh_dihubungi").eq("nama", nama2).single();
  expect(la2!.boleh_dihubungi).toBe(false);

  // Lowongan Pelayan kedua: Bank Talenta berisi tamu 1, tidak berisi tamu 2.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/app/orang");
  const baris2 = await buatLowongan(page, `Pelayan keputusan kedua ${jejak}`);
  const bank = baris2.getByTestId("bank-talenta");
  await expect(bank).toContainText(nama1);
  await expect(bank).not.toContainText(nama2);
  await expect(bank.getByRole("link", { name: `Undang ${nama1} lewat WhatsApp` })).toHaveAttribute("href", new RegExp(`^https://wa\\.me/62${hp1.slice(1)}\\?text=`));
  // Lowongan asal tidak menawarkan pelamarnya sendiri.
  await expect(baris1.getByTestId("bank-talenta").filter({ hasText: nama1 })).toHaveCount(0);
  await axeDanFoto(page, bank, "bank-talenta");
});
