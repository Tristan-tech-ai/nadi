import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-13B: satu kursus sampai sertifikat. Pemilik (akun B, usaha "Uji Kinerja E2E" milik spec kinerja karena akun B sudah di batas 20 usaha) membuat kursus dan dua soal di layar, Budi masuk
// dengan akun stafnya, gagal sekali (dinilai server), lalu lulus dan membuka sertifikat publik; pemilik melihat progres Budi.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Kinerja E2E";

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
      const lebarLebih = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(-3).map((e) => `${e.tagName}.${String(e.className).slice(0, 60)}`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping: ${lebarLebih.join(" | ")}`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("kursus: buat kursus dan kuis, staf gagal lalu lulus, sertifikat publik, progres untuk pemilik", async ({ page, browser }) => {
  test.setTimeout(240_000);
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
    await sb.from("anggota").update({ aktif: false }).eq("perusahaan_id", pid).neq("peran", "pemilik").eq("aktif", true);
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const tanda = Date.now().toString(36).toUpperCase();
    const nama = `Budi ${tanda}`;
    const judul = `Tutup kasir ${tanda}`;
    const { data: o, error: eo } = await sb.from("orang").insert({ perusahaan_id: pid, nama }).select("id").single();
    expect(eo).toBeNull();
    const pin = "579135";
    expect((await sb.rpc("buat_akun_staf", { p_orang: o!.id, p_pin: pin })).error).toBeNull();
    const { data: os } = await sb.from("orang").select("id_staf").eq("id", o!.id).single();
    const { data: us } = await sb.from("perusahaan").select("kode").eq("id", pid).single();

    await page.goto(`/masuk?next=${encodeURIComponent("/app/kursus")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/kursus");
    await page.waitForLoadState("networkidle");
    const fk = page.getByRole("form", { name: "Kursus baru" });
    await fk.getByLabel("Judul (kosong = judul Rekam ilmu)").fill(judul);
    await fk.getByLabel("Materi (satu paragraf per baris)").fill("Cocokkan uang laci dengan rekap kasir.\nCatat selisih di buku selisih.");
    await fk.getByRole("button", { name: "Buat kursus" }).click();
    await expect(fk.getByRole("status")).toHaveText("Kursus dibuat. Tambahkan soal kuisnya.", { timeout: 30_000 });
    const soal = [["Apa yang dicocokkan saat tutup kasir?", "Rekap kasir\nDaftar gaji", "1"], ["Selisih kas dicatat di mana?", "Tidak dicatat\nBuku selisih", "2"]];
    for (const [q, pil, k] of soal) {
      const fs = page.getByRole("form", { name: `Tambah soal ${judul}` });
      await fs.getByLabel("Pertanyaan").fill(q);
      await fs.getByLabel("Pilihan jawaban (satu per baris)").fill(pil);
      await fs.getByLabel("Nomor jawaban benar").fill(k);
      await fs.getByRole("button", { name: "Tambah soal" }).click();
      await expect(fs.getByRole("status")).toHaveText("Soal ditambahkan.", { timeout: 30_000 });
    }
    await expect(page.getByTestId("kursus").filter({ hasText: judul })).toContainText("2 soal, lulus bila nilai minimal 70");

    // Budi mengerjakan kuis dari akun stafnya.
    const staf = await (await browser.newContext()).newPage();
    await staf.goto("/masuk/staf");
    await staf.getByLabel("Kode usaha").fill(us!.kode as string);
    await staf.getByLabel("ID kamu").fill(os!.id_staf as string);
    await staf.getByLabel("PIN").fill(pin);
    await staf.getByRole("button", { name: "Masuk" }).click();
    await staf.waitForURL((u) => u.pathname.startsWith("/app"));
    await staf.goto("/app/kursus");
    const kuis = staf.getByRole("form", { name: `Kuis ${judul}` });
    // Kunci jawaban tidak pernah dikirim ke peramban.
    expect(await staf.content()).not.toMatch(/\\?"kunci\\?":\s*\d/);
    await kuis.getByLabel("Daftar gaji").check();
    await kuis.getByLabel("Buku selisih").check();
    await kuis.getByRole("button", { name: "Kirim jawaban" }).click();
    await expect(kuis.getByTestId("hasil-kuis")).toHaveAttribute("data-lulus", "false", { timeout: 30_000 });
    await expect(kuis.getByTestId("hasil-kuis")).toContainText("Nilai 50 (1 dari 2 benar). Butuh minimal 70.");
    await kuis.getByLabel("Rekap kasir").check();
    await kuis.getByLabel("Buku selisih").check();
    await kuis.getByRole("button", { name: "Kirim jawaban" }).click();
    // Lulus: kuis diganti tautan sertifikat.
    const tautan = staf.getByTestId("kursus").filter({ hasText: judul }).getByTestId("sertifikatku").getByRole("link");
    await expect(tautan).toContainText(/\/SERT\//, { timeout: 30_000 });
    await tautan.click();
    await staf.waitForURL(/\/sertifikat\/[0-9A-F]{12}$/);
    await expect(staf.getByTestId("sertifikat")).toContainText(nama);
    await expect(staf.getByTestId("sertifikat")).toContainText(judul);
    await expect(staf.getByTestId("sertifikat")).toContainText("dengan nilai 100");
    const url = staf.url();
    await staf.context().close();

    // Sertifikat bisa diperiksa siapa saja yang memegang kodenya.
    const publik = await (await browser.newContext()).newPage();
    await publik.goto(url);
    await expect(publik.getByTestId("sertifikat")).toContainText(nama);
    await expect(publik.getByRole("button", { name: "Cetak atau simpan PDF" })).toBeVisible();
    await periksaUi(publik, "sertifikat");
    await publik.goto("/sertifikat/000000000000");
    await expect(publik.getByTestId("sertifikat-tidak-ada")).toBeVisible();
    await publik.context().close();

    await page.reload();
    const baris = page.getByTestId("kursus").filter({ hasText: judul }).getByTestId("progres-kursus").filter({ hasText: nama });
    await expect(baris).toContainText("100");
    await expect(baris).toContainText("2");
    await periksaUi(page, "kursus");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
