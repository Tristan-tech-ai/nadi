import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F2-06: pemilik mengisi Dana Rekrutmen (Rp30.000/jam), membuat rencana magang tanpa uang saku (peringatan lunak tampil dengan
// sumber dan status belum terverifikasi), mencatat 90 menit bimbingan, lalu Biaya per rekrutmen menunjukkan Rp45.000 untuk
// rencana itu dan total tabel sama dengan jumlah barisnya. Memakai usaha bawaan akun A (tanpa pindah usaha); orang uji dibuat
// baru setiap jalan dan dinonaktifkan di akhir, rencananya ditandai batal (tanpa penghapusan).
// Foto disimpan ke E2E_FOTO_DIR bila diisi, selain itu ke folder keluaran Playwright.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));
const angkaRp = (t: string) => Number(t.replace(/[^\d-]/g, ""));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function axeDanFoto(p: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await p.setViewportSize({ width: lebar, height: tinggi });
      await p.emulateMedia({ colorScheme: skema });
      await p.waitForTimeout(300);
      const axe = await new AxeBuilder({ page: p }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      const lebarHalaman = await p.evaluate(() => document.documentElement.scrollWidth);
      expect(lebarHalaman, `${nama} ${lebar}: tanpa gulir mendatar`).toBeLessThanOrEqual(lebar);
      await p.screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.emulateMedia({ colorScheme: "light" });
}

test("magang: Dana Rekrutmen, rencana tanpa uang saku berperingatan, 90 menit mentor = Rp45.000", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  expect(pid).toBeTruthy();
  const jejak = String(Date.now());
  const namaPeserta = `Peserta Magang ${jejak}`;
  const namaMentor = `Mentor Magang ${jejak}`;
  const { data: dibuat, error: eo } = await sb.from("orang").insert([
    { perusahaan_id: pid, nama: namaPeserta, data: {} },
    { perusahaan_id: pid, nama: namaMentor, data: { mulai: "2024-01-01" } },
  ]).select("id");
  expect(eo).toBeNull();
  const idOrang = (dibuat ?? []).map((o) => o.id as string);

  try {
    await page.goto("/masuk?next=/app/magang");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/magang");
    await expect(page.getByRole("link", { name: "Magang" })).toHaveAttribute("aria-current", "page");

    // Dana Rekrutmen.
    const dana = page.getByTestId("dana-rekrutmen");
    const formDana = dana.getByRole("form", { name: "Atur Dana Rekrutmen" });
    await formDana.getByLabel("Tarif waktu rekrutmen per jam (Rp)").fill("30.000");
    await formDana.getByLabel("Anggaran per bulan (Rp)").fill("500.000");
    await formDana.getByRole("button", { name: "Simpan dana" }).click();
    await expect(formDana.getByRole("status")).toContainText("Dana Rekrutmen tersimpan.");
    await expect(dana.getByTestId("tarif-jam")).toHaveText("Rp30.000");
    const terpakaiAwal = angkaRp((await dana.getByTestId("dana-terpakai").textContent()) ?? "");

    // Rencana magang tanpa uang saku, dua baris mingguan (baris ketiga ditambah lalu dihapus).
    const form = page.getByRole("form", { name: "Buat rencana magang" });
    await form.getByRole("combobox", { name: /^Peserta magang/ }).selectOption({ label: namaPeserta });
    await form.getByRole("combobox", { name: /^Mentor/ }).selectOption({ label: namaMentor });
    const selesai = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
    await form.getByLabel("Selesai").fill(selesai);
    await form.getByLabel("Tujuan magang").fill("Bisa menyiapkan espresso dan susu sendiri di jam ramai");
    await form.getByLabel("Keahlian, baris 1").fill("Kenal mesin espresso");
    await form.getByLabel("Target, baris 1").fill("Membersihkan grup head sendiri");
    await form.getByRole("button", { name: "Tambah minggu" }).click();
    await expect(form.getByLabel("Minggu ke, baris 2")).toHaveValue("2");
    await form.getByLabel("Keahlian, baris 2").fill("Espresso tunggal");
    await form.getByRole("button", { name: "Tambah minggu" }).click();
    await form.getByLabel("Keahlian, baris 3").fill("Baris dihapus");
    await form.getByRole("button", { name: "Hapus baris 3" }).click();
    await expect(form.getByLabel("Keahlian, baris 3")).toHaveCount(0);
    await form.getByLabel("Uji akhir (boleh kosong)").fill("Membuat 10 cangkir dalam 30 menit");
    await form.getByRole("button", { name: "Simpan rencana" }).click();
    await expect(form.getByRole("status")).toContainText("Rencana magang tersimpan.");

    const kartu = page.locator(`[data-testid="rencana-magang"][data-peserta="${namaPeserta}"]`);
    await expect(kartu).toBeVisible();
    const saku = kartu.locator('[data-kode="uang_saku"]');
    await expect(saku).toContainText("Uang saku belum diisi");
    await expect(saku).toContainText("Permenaker 6/2020 Pasal 10 dan Pasal 13 ayat (2)");
    await expect(saku).toContainText("belum terverifikasi");
    await expect(kartu.locator('[data-kode="durasi"]')).toHaveCount(0);
    await expect(kartu.locator('[data-kode="mentor_baru"]')).toHaveCount(0);
    await kartu.getByText("Rencana per minggu (2 baris)").click();
    await expect(kartu).toContainText("Minggu 2: Espresso tunggal");

    // Mentor 90 menit.
    const sesi = kartu.getByRole("form", { name: `Catat sesi bimbingan ${namaPeserta}` });
    await sesi.getByLabel("Menit").fill("90");
    await sesi.getByLabel("Catatan (boleh kosong)").fill("Latihan espresso");
    await sesi.getByRole("button", { name: "Catat sesi" }).click();
    await expect(sesi.getByRole("status")).toHaveText("Sesi 1 jam 30 menit tercatat.");
    await expect(kartu.getByTestId("menit-mentor")).toHaveText("1 jam 30 menit");

    // Biaya per rekrutmen dan Dana Rekrutmen bulan ini.
    const baris = page.locator(`[data-testid="baris-biaya"][data-nama="${namaPeserta}"]`);
    await expect(baris).toContainText("1 jam 30 menit");
    await expect(baris.locator("td").last()).toHaveText("Rp45.000");
    const semua = await page.getByTestId("baris-biaya").locator("td:last-child").allTextContents();
    const total = angkaRp((await page.getByTestId("total-biaya").textContent()) ?? "");
    expect(total).toBe(semua.reduce((n, t) => n + angkaRp(t), 0));
    await expect(page.getByTestId("dana-terpakai")).toHaveText(new Intl.NumberFormat("id-ID").format(terpakaiAwal + 45_000).replace(/^/, "Rp"));

    // Angka yang sama dari database.
    const bulan = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date()).slice(0, 7);
    const { data: lap, error: el } = await sb.rpc("laporan_rekrut", { p_bulan: `${bulan}-01` });
    expect(el).toBeNull();
    const b = (lap as { baris: { nama: string; menit_mentor: number; biaya_total: number }[]; total_biaya: number }).baris.find((x) => x.nama === namaPeserta);
    expect(b).toMatchObject({ menit_mentor: 90, biaya_total: 45_000 });
    expect((lap as { total_biaya: number }).total_biaya).toBe(total);

    await axeDanFoto(page, "magang");
  } finally {
    // Bersihkan tanpa menghapus: rencana uji ditandai batal, orang uji dinonaktifkan.
    const { data: r } = await sb.from("rencana_magang").select("*").in("orang_id", idOrang);
    for (const x of r ?? []) {
      await sb.rpc("simpan_rencana_magang", {
        p_id: x.id, p_orang: x.orang_id, p_mentor: x.mentor_id, p_topi: x.topi_id, p_mulai: x.mulai, p_selesai: x.selesai,
        p_uang_saku: x.uang_saku, p_tujuan: x.tujuan, p_minggu: x.minggu, p_uji_akhir: x.uji_akhir, p_status: "batal", p_nilai_akhir: null,
      });
    }
    if (idOrang.length) await sb.from("orang").update({ status: "nonaktif" }).in("id", idOrang);
  }
});
