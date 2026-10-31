import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-02: tiga staf sintetis di Warung Uji A memakai topi uji baru dengan beban berbeda (6, 3, 1 poin dari 5 kerja selesai).
// Layar "Beban minggu ini" menandai yang paling berat (teks + stabilo) dan jujur soal jam sama rata; kerja baru tanpa pelaksana
// diusulkan ke yang paling ringan beserta alasannya, pemilik bisa memilih orang lain; staf hanya melihat bebannya dan rata-rata
// tim. Pola pembuatan staf/kerja sama dengan kerja.spec. Bersih tanpa penghapusan: kerja terbuka dibatalkan, staf dinonaktifkan,
// topi uji dinonaktifkan. Foto ke E2E_FOTO_DIR bila diisi.
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

async function axeDanFoto(p: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await p.setViewportSize({ width: lebar, height: tinggi });
      await p.emulateMedia({ colorScheme: skema });
      await p.waitForTimeout(400);
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

test("bagi adil: beban minggu ini, usulan ke yang paling ringan beserta alasan, staf tanpa nama rekan", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  expect(pid).toBeTruthy();
  const { data: usaha } = await sb.from("perusahaan").select("nama, kode").eq("id", pid!).single();
  expect(usaha?.nama, "usaha aktif akun A harus Warung Uji A").toBe("Warung Uji A");

  const jejak = String(Date.now()).slice(-6);
  const namaTopi = `Kasir Adil ${jejak}`;
  const { data: t, error: et } = await sb.from("topi").insert({ perusahaan_id: pid, kode: `kasir_adil_${jejak}`, nama: namaTopi }).select("id").single();
  expect(et).toBeNull();
  const idTopi = t!.id as string;
  const nama = { berat: `Sari Adil ${jejak}`, sedang: `Budi Adil ${jejak}`, ringan: `Dewi Adil ${jejak}` };
  const id: Record<keyof typeof nama, string> = { berat: "", sedang: "", ringan: "" };
  const judulBaru = `Rekap kas sore ${jejak}`;
  const pin = "246813";

  try {
    for (const k of Object.keys(nama) as (keyof typeof nama)[]) {
      const { data: o, error: eo } = await sb.from("orang").insert({ perusahaan_id: pid, nama: nama[k], data: {} }).select("id").single();
      expect(eo).toBeNull();
      id[k] = o!.id as string;
      expect((await sb.from("pakai_topi").insert({ perusahaan_id: pid, orang_id: id[k], topi_id: idTopi })).error).toBeNull();
    }
    // Lima kerja selesai berpoin manual: Sari 3 + 3, Budi 2 + 1, Dewi 1.
    const beban: [keyof typeof nama, number][] = [["berat", 3], ["berat", 3], ["sedang", 2], ["sedang", 1], ["ringan", 1]];
    for (const [i, [k, poin]] of beban.entries()) {
      const { data: r, error: eb } = await sb.rpc("buat_kerja", { p_judul: `Kerja adil ${jejak} ${i + 1}`, p_topi: idTopi, p_pelaksana: id[k], p_tenggat: null });
      expect(eb).toBeNull();
      const idKerja = (r as { id: string }).id;
      expect((await sb.rpc("simpan_estimasi_kerja", { p_kerja: idKerja, p_menit: poin * 15, p_sumber: "manual", p_alasan: "Data uji bagi adil" })).error).toBeNull();
      expect((await sb.rpc("ubah_status_kerja", { p_kerja: idKerja, p_aksi: "selesai" })).error).toBeNull();
    }
    expect((await sb.rpc("buat_akun_staf", { p_orang: id.berat, p_pin: pin })).error).toBeNull();
    const { data: s } = await sb.from("orang").select("id_staf").eq("id", id.berat).single();
    const idStaf = s!.id_staf as string;

    // Database langsung: usulan ke Dewi (1 poin) dengan alasan satu kalimat.
    const { data: u } = await sb.rpc("usulan_pelaksana", { p_topi: idTopi, p_poin: null });
    const alasan = `${nama.ringan}: 1 poin minggu ini, paling ringan di antara ${namaTopi.toLowerCase()}.`;
    expect(u).toMatchObject({ orang_id: id.ringan, kandidat: 3, alasan });

    // Pemilik: tab Beban minggu ini.
    await page.goto("/masuk?next=/app/kerja");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((x) => x.pathname === "/app/kerja");
    await page.getByRole("navigation", { name: "Bagian kerja" }).getByRole("link", { name: "Beban minggu ini" }).click();
    await page.waitForURL((x) => x.searchParams.get("tab") === "beban");
    const bagian = page.getByTestId("beban-minggu");
    await expect(bagian).toBeVisible();
    await expect(page.getByTestId("jam-sama-rata")).toHaveText("Jam kerja belum diatur, jadi semua orang dianggap punya jam yang sama (40 jam seminggu).");
    expect(Number(await bagian.getAttribute("data-selesai"))).toBeGreaterThanOrEqual(5);
    await expect(page.getByTestId("beban-belum")).toHaveCount(0);
    const baris = (n: string) => page.locator(`[data-testid="baris-beban"][data-nama="${n}"]`);
    await expect(baris(nama.berat).getByTestId("beban-poin")).toContainText("6 poin");
    await expect(baris(nama.sedang).getByTestId("beban-poin")).toContainText("3 poin");
    await expect(baris(nama.ringan).getByTestId("beban-poin")).toContainText("1 poin");
    // Paling berat: teks di atas stabilo, satu orang, yaitu Sari (staf lain di usaha uji paling banyak 2 poin dan dinonaktifkan).
    await expect(page.getByTestId("paling-berat")).toHaveCount(1);
    await expect(baris(nama.berat).getByTestId("paling-berat")).toHaveText("paling berat");
    await expect(page.getByTestId("kalimat-beban")).toHaveText(new RegExp(`^${nama.berat} memikul \\d+% kerja minggu ini dengan \\d+% jam kerja\\.$`));
    await axeDanFoto(page, "beban-pemilik");

    // Tambah kerja tanpa pelaksana: usulan ke Dewi beserta alasan; memilih orang lain menyembunyikan usulan.
    await page.getByRole("button", { name: "Tambah kerja" }).click();
    const form = page.getByRole("form", { name: "Tambah kerja" });
    await form.getByLabel("Judul kerja").fill(judulBaru);
    await form.getByRole("combobox", { name: /^Topi/ }).selectOption({ label: namaTopi });
    const usulan = form.getByTestId("usulan-pelaksana");
    await expect(usulan).toBeVisible({ timeout: 20_000 });
    await expect(usulan.getByTestId("usulan-nama")).toHaveText(nama.ringan);
    await expect(usulan.getByTestId("usulan-alasan")).toHaveText(alasan);
    const pilihPelaksana = form.getByRole("combobox", { name: /^Pelaksana/ });
    await expect(pilihPelaksana).toHaveValue("");
    await axeDanFoto(page, "beban-usulan");
    await pilihPelaksana.selectOption({ label: nama.sedang });
    await expect(usulan).toBeHidden();
    await pilihPelaksana.selectOption("");
    await expect(usulan).toBeVisible();
    await usulan.getByRole("button", { name: `Pilih ${nama.ringan}` }).click();
    await expect(pilihPelaksana).toHaveValue(id.ringan);
    await expect(usulan.getByRole("button", { name: `${nama.ringan} dipilih` })).toBeDisabled();
    await form.getByRole("button", { name: "Simpan kerja" }).click();
    await expect(page.getByTestId("hasil-tambah")).toContainText("Tersimpan.", { timeout: 40_000 });
    const { data: baru } = await sb.from("kerja").select("pelaksana_id, topi_id, status").eq("judul", judulBaru).single();
    expect(baru).toMatchObject({ pelaksana_id: id.ringan, topi_id: idTopi, status: "baru" });

    // Kerja baru Dewi masuk antre di layar beban (bukan poin minggu ini).
    await page.reload();
    await expect(baris(nama.ringan).getByTestId("beban-poin")).toContainText("1 poin");

    // Staf: bebannya sendiri dan rata-rata tim, tanpa nama rekan.
    const konteksStaf = await browser.newContext({ locale: "id-ID", timezoneId: "Asia/Jakarta" });
    const staf = await konteksStaf.newPage();
    await staf.goto("/masuk/staf");
    await staf.getByLabel("Kode usaha").fill(usaha!.kode as string);
    await staf.getByLabel("ID kamu").fill(idStaf);
    await staf.getByLabel("PIN").fill(pin);
    await staf.getByRole("button", { name: "Masuk" }).click();
    await expect(staf.getByTestId("peran")).toContainText("staf");
    await staf.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Kerja" }).click();
    await staf.waitForURL((x) => x.pathname === "/app/kerja");
    await expect(staf.getByTestId("beban-saya-teks")).toHaveText(/^Minggu ini 6 poin\. Rata-rata tim \d+(,\d+)?\.$/);
    const isiStaf = await staf.locator("body").innerText();
    expect(isiStaf).not.toContain(nama.sedang);
    expect(isiStaf).not.toContain(nama.ringan);
    await expect(staf.getByRole("link", { name: "Beban minggu ini" })).toHaveCount(0);
    await axeDanFoto(staf, "beban-staf");
    await konteksStaf.close();
  } finally {
    const { data: sisa } = await sb.from("kerja").select("id, status").eq("judul", judulBaru);
    for (const k of sisa ?? []) if (k.status !== "selesai" && k.status !== "batal") await sb.rpc("ubah_status_kerja", { p_kerja: k.id, p_aksi: "batal" });
    for (const o of Object.values(id)) if (o) await sb.from("orang").update({ status: "nonaktif" }).eq("id", o);
    await sb.from("topi").update({ aktif: false }).eq("id", idTopi);
  }
});
