import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F1-05: isi gaji Rp8.000.000 TK/0 di halaman Orang, siapkan gaji, PPh 21 Rp125.448 (TER A 1,5% x bruto 8.363.200) dan peringatan
// JP tampil, setujui, bagikan, slip terbuka tanpa akun. Memakai usaha khusus "Uji Gaji E2E" milik akun A dan bulan yang belum pernah
// dipakai (periode yang disetujui terkunci), lalu usaha aktif dikembalikan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const NAMA_USAHA = "Uji Gaji E2E";
const NAMA_USAHA_LEMBUR = "Uji Lembur E2E";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(!info.project.name.startsWith("pindah-") || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (proyek pindah-*, desktop), butuh .env.local dan .env.e2e.local");
});
// Berurutan: usaha aktif melekat di akun A (klaim JWT), jadi dua tes yang memanggil pindah_perusahaan tidak boleh jalan bersamaan.
test.describe.configure({ mode: "serial" });

async function periksaUi(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("gaji: isi gaji, siapkan, PPh 21 sesuai TER, setujui, bagikan, slip terbuka tanpa akun", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", NAMA_USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: NAMA_USAHA, p_industri: "fnb" });
      expect(error).toBeNull();
      pid = data as string;
    } else {
      expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    }
    await sb.auth.refreshSession();
    // Orang dari jalan sebelumnya tidak ikut digaji lagi; bulan baru yang belum punya periode (bukan Desember: masa Pasal 17).
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const { data: per } = await sb.from("periode_gaji").select("bulan").eq("perusahaan_id", pid);
    const dipakai = new Set((per ?? []).map((p) => (p.bulan as string).slice(0, 7)));
    let bulan = "";
    for (let i = 2026 * 12 + 10; !bulan; i++) {
      const b = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
      if (!b.endsWith("-12") && !dipakai.has(b)) bulan = b;
    }
    const nama = `Karyawan Gaji ${Date.now()}`;
    // Mulai bekerja pertengahan bulan itu: belum 30 hari, jadi Gerbang Gaji tidak menuntut absen.
    expect((await sb.from("orang").insert({ perusahaan_id: pid, nama, data: { mulai: `${bulan}-15` } })).error).toBeNull();

    await page.goto("/masuk?next=/app/orang");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL(/\/app\/orang/);
    const baris = page.getByRole("listitem").filter({ hasText: nama });
    await baris.getByText("Gaji belum diisi").click();
    const form = baris.getByRole("form", { name: `Gaji ${nama}` });
    await form.getByLabel("Gaji pokok (Rp)").fill("8000000");
    await form.getByLabel("Status PTKP").selectOption("TK/0");
    await form.getByRole("button", { name: `Simpan gaji ${nama}` }).click();
    await expect(form.getByText("Tersimpan.")).toBeVisible();

    await page.goto(`/app/gaji?bulan=${bulan}`);
    await page.getByRole("button", { name: "Siapkan gaji bulan ini" }).click();
    await expect(page.getByText("Draf gaji siap untuk 1 orang.")).toBeVisible();
    await page.reload();
    const slip = page.getByTestId("daftar-slip").getByRole("listitem").filter({ hasText: nama });
    // Neto = 8.000.000 - BPJS Kes 80.000 - JHT 160.000 - PPh 21 125.448 = 7.634.552.
    await expect(slip).toContainText("Rp7.634.552");
    await expect(slip).toContainText("Jaminan Pensiun tahun ini belum terverifikasi");
    await slip.getByText("Rincian").click();
    await expect(slip.getByText("Potongan PPh 21")).toBeVisible();
    await expect(slip).toContainText("-Rp125.448");
    await periksaUi(page, "gaji-draf");

    await page.getByRole("button", { name: "Setujui gaji bulan ini" }).click();
    // Setelah disetujui halaman dirender ulang: formulir Setujui hilang, tombol Bagikan muncul, periode bercap Disetujui.
    const bagikan = page.getByRole("button", { name: `Bagikan slip ${nama}` });
    await expect(bagikan).toBeVisible();
    await expect(page.getByRole("button", { name: "Setujui gaji bulan ini" })).toHaveCount(0);
    await bagikan.click();
    const tautan = (await page.getByTestId("tautan-slip-isi").textContent())!;
    expect(tautan).toMatch(/\/slip#nms_[0-9a-f]{64}$/);

    const tamu = await (await browser.newContext()).newPage();
    await tamu.goto(new URL(tautan).pathname + new URL(tautan).hash);
    await expect(tamu.getByTestId("slip-neto")).toContainText("Rp7.634.552");
    await expect(tamu.getByTestId("slip")).toContainText(nama);
    await periksaUi(tamu, "slip-publik");
    await tamu.goto("/slip#nms_" + "0".repeat(64));
    await tamu.reload();
    await expect(tamu.getByTestId("slip-galat")).toContainText("tidak berlaku lagi");
    await tamu.context().close();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});

// F1-05B: gaji pokok Rp3.460.000 (upah sejam Rp20.000), lembur 4 jam di hari kerja menambah Rp150.000 ke slip
// (1,5 x 20.000 + 3 x 2 x 20.000, PP 35/2021 Pasal 31). Usaha sendiri "Uji Lembur E2E", bulan yang belum pernah dipakai.
test("lembur 4 jam hari kerja menambah Rp150.000 ke slip", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", NAMA_USAHA_LEMBUR).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: NAMA_USAHA_LEMBUR, p_industri: "fnb" });
      expect(error).toBeNull();
      pid = data as string;
    } else {
      expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    }
    await sb.auth.refreshSession();
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const { data: per } = await sb.from("periode_gaji").select("bulan").eq("perusahaan_id", pid);
    const dipakai = new Set((per ?? []).map((p) => (p.bulan as string).slice(0, 7)));
    let bulan = "";
    for (let i = 2026 * 12 + 10; !bulan; i++) {
      const b = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
      if (!b.endsWith("-12") && !dipakai.has(b)) bulan = b;
    }
    const nama = `Karyawan Lembur ${Date.now()}`;
    const { data: o, error: eo } = await sb.from("orang").insert({ perusahaan_id: pid, nama, data: { mulai: `${bulan}-15` } }).select("id").single();
    expect(eo).toBeNull();
    expect((await sb.from("orang_rahasia").insert({ orang_id: o!.id, perusahaan_id: pid, gaji: { pokok: 3_460_000, tunjangan_tetap: 0, ptkp: "TK/0", risiko_jkk: "sangat_rendah" } })).error).toBeNull();

    await page.goto(`/masuk?next=/app/gaji?bulan=${bulan}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    // Tunggu pathname, bukan pola URL: "/masuk?next=/app/gaji" sudah cocok dengan /\/app\/gaji/ sebelum masuk selesai.
    await page.waitForURL((u) => u.pathname === "/app/gaji");
    await page.goto(`/app/gaji?bulan=${bulan}`);
    await expect(page.getByTestId("lembur-kosong")).toBeVisible();
    await page.getByRole("button", { name: "Siapkan gaji bulan ini" }).click();
    const slip = page.getByTestId("daftar-slip").getByRole("listitem").filter({ hasText: nama });
    // Tanpa lembur: 3.460.000 - BPJS Kes 34.600 - JHT 69.200 = 3.356.200 (bruto PPh di bawah batas TER A 0%).
    await expect(slip).toContainText("Rp3.356.200");

    const form = page.getByRole("form", { name: "Catat lembur" });
    await form.getByLabel("Orang").selectOption({ label: nama });
    await form.getByLabel("Tanggal").fill(`${bulan}-03`);
    await form.getByLabel("Jenis hari").selectOption("hari_kerja");
    await form.getByLabel("Jam lembur").fill("5");
    await form.getByRole("button", { name: "Catat lembur" }).click();
    await expect(form.getByRole("alert")).toContainText("paling lama 4 jam");
    await form.getByLabel("Jam lembur").fill("4");
    await form.getByRole("button", { name: "Catat lembur" }).click();
    const daftar = page.getByTestId("daftar-lembur");
    await expect(daftar.getByRole("listitem").filter({ hasText: nama })).toContainText("4 jam, hari kerja");

    await page.getByRole("button", { name: "Hitung ulang draf" }).click();
    await expect(slip).toContainText("Rp3.506.200");
    await slip.getByText("Rincian").click();
    await expect(slip.getByText("Lembur 4 jam")).toBeVisible();
    await expect(slip).toContainText("Rp150.000");

    for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: lebar, height: tinggi });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(400);
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
        await page.getByTestId("lembur").screenshot({ path: test.info().outputPath(`lembur-${lebar}-${skema}.png`) });
      }
    }
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});

// Q-22 (docs/design/aturan-kerja.md): pola kerja satu sumber per usaha. Usaha sendiri "Uji Aturan Kerja E2E" milik akun A, mulai dari
// 6 hari. Dua lembur libur pola 6 dicatat lewat RPC; pemilik memilih 5 hari, lembar dampak menyebut jumlah lembur libur yang nyata
// (dihitung dari database), simpan, audit mencatat lama dan baru, lembur lama tidak berubah; di halaman Gaji lembur libur pola 6
// ditolak dengan pesan yang menyebut pola usaha, libur pola 5 diterima. Admin (akun staf yang dinaikkan pemilik) melihat kartu
// baca saja; staf tidak melihat kartu. Pola dikembalikan ke 6 hari lewat kartu. Bersih tanpa penghapusan: orang dan anggota uji
// dinonaktifkan, pola 6 hari, usaha aktif dikembalikan.
const NAMA_USAHA_POLA = "Uji Aturan Kerja E2E";

async function axeKartu(p: Page, kartu: ReturnType<Page["getByTestId"]>, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await p.setViewportSize({ width: lebar, height: tinggi });
      await p.emulateMedia({ colorScheme: skema });
      await p.waitForTimeout(400);
      const axe = await new AxeBuilder({ page: p }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema}`).toEqual([]);
      expect(await p.evaluate(() => document.documentElement.scrollWidth), `${nama} ${lebar}: tanpa gulir mendatar`).toBeLessThanOrEqual(lebar);
      await kartu.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`) });
    }
  }
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.emulateMedia({ colorScheme: "light" });
}

test("aturan kerja: pemilik ganti pola lewat lembar dampak, lembur libur pola lain ditolak, admin baca saja, staf tidak melihat", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  let pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  // Jalan sebelumnya yang terhenti bisa meninggalkan usaha uji ini aktif: kembalikan ke usaha utama akun A.
  const { data: utama } = await sb.from("perusahaan").select("id, nama").in("nama", [NAMA_USAHA_POLA, "Warung Uji A"]);
  if (utama?.find((u) => u.id === pidAwal)?.nama === NAMA_USAHA_POLA) pidAwal = utama.find((u) => u.nama === "Warung Uji A")?.id as string | undefined;
  const id: Record<string, string> = {};
  let pid: string | undefined;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", NAMA_USAHA_POLA).limit(1);
    pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: NAMA_USAHA_POLA, p_industri: "toko" });
      expect(error).toBeNull();
      pid = data as string;
    } else {
      expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    }
    await sb.auth.refreshSession();
    // Sisa jalan sebelumnya yang terhenti: pola 5 hari, orang, dan anggota uji.
    expect((await sb.rpc("atur_pola_kerja", { p_pola: "6_hari", p_diatur_sendiri: false })).error).toBeNull();
    await sb.from("anggota").update({ aktif: false }).eq("perusahaan_id", pid).neq("peran", "pemilik").eq("aktif", true);
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const { data: usaha } = await sb.from("perusahaan").select("kode, zona_waktu").eq("id", pid).single();
    // Bulan berjalan di zona usaha; gaji tidak pernah disetujui di usaha ini, jadi lembur bulan ini tidak terkunci.
    const bulan = new Intl.DateTimeFormat("en-CA", { timeZone: usaha!.zona_waktu as string, year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);

    const jejak = String(Date.now()).slice(-6);
    const nama = { rina: `Rina Pola ${jejak}`, admin: `Admin Pola ${jejak}`, staf: `Staf Pola ${jejak}` };
    for (const [k, n] of Object.entries(nama)) {
      const { data: o, error } = await sb.from("orang").insert({ perusahaan_id: pid, nama: n, data: {} }).select("id").single();
      expect(error).toBeNull();
      id[k] = o!.id as string;
    }
    // Lembur lama di pola 6 hari.
    expect((await sb.rpc("catat_lembur", { p_orang: id.rina, p_tanggal: `${bulan}-02`, p_jenis: "libur_pola_6_hari", p_jam: 3 })).error).toBeNull();
    expect((await sb.rpc("catat_lembur", { p_orang: id.rina, p_tanggal: `${bulan}-03`, p_jenis: "libur_pola_6_hari_jatuh_hari_kerja_terpendek", p_jam: 2 })).error).toBeNull();
    const { count: liburLama } = await sb.from("lembur").select("id", { count: "exact", head: true }).eq("perusahaan_id", pid).neq("jenis", "hari_kerja").gt("jam", 0);
    expect(liburLama).toBeGreaterThanOrEqual(2);
    const { data: lemburSebelum } = await sb.from("lembur").select("id, jenis, jam, diubah_at").eq("perusahaan_id", pid).order("id");

    const pin = { admin: "864213", staf: "753124" };
    for (const k of ["admin", "staf"] as const) expect((await sb.rpc("buat_akun_staf", { p_orang: id[k], p_pin: pin[k] })).error).toBeNull();
    expect((await sb.from("anggota").update({ peran: "admin" }).eq("perusahaan_id", pid).eq("orang_id", id.admin)).error).toBeNull();
    const { data: idStaf } = await sb.from("orang").select("id, id_staf").in("id", [id.admin, id.staf]);
    const kodeStaf = (k: "admin" | "staf") => idStaf!.find((o) => o.id === id[k])!.id_staf as string;

    // Pemilik.
    await page.goto("/masuk?next=/app/perusahaan");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/perusahaan");
    const kartu = page.getByTestId("aturan-kerja");
    await expect(kartu.getByTestId("pola-6_hari")).toContainText("dipakai sekarang");
    await expect(kartu.getByTestId("pola-5_hari")).not.toContainText("dipakai sekarang");
    await expect(kartu).toContainText("Mengikuti PP 35/2021 Pasal 21 dan 22 serta PP 36/2021 Pasal 17. Total tetap 40 jam seminggu.");
    await axeKartu(page, kartu, "aturan-kerja-pemilik");

    await kartu.getByRole("radio", { name: /5 hari seminggu/ }).check();
    await kartu.getByRole("button", { name: "Simpan aturan kerja" }).click();
    const lembar = page.getByTestId("lembar-dampak");
    await expect(lembar).toBeVisible();
    await expect(lembar).toContainText(`Lembur hari libur yang sudah tercatat (${liburLama} baris) tidak berubah.`);
    await expect(lembar).toContainText("Mulai sekarang, lembur hari libur dicatat dengan aturan pola 5 hari.");
    await axeKartu(page, lembar, "aturan-kerja-lembar");
    // Batal tidak menyimpan apa pun.
    await lembar.getByRole("button", { name: "Batal" }).click();
    await expect(lembar).toBeHidden();
    await expect(kartu.getByTestId("pola-6_hari")).toContainText("dipakai sekarang");
    await kartu.getByRole("button", { name: "Simpan aturan kerja" }).click();
    await lembar.getByRole("button", { name: "Ganti ke 5 hari" }).click();
    await expect(kartu.getByTestId("aturan-kerja-hasil")).toHaveText("Tersimpan. Usahamu bekerja 5 hari seminggu.");
    await expect(kartu.getByTestId("pola-5_hari")).toContainText("dipakai sekarang");
    await expect(kartu.getByTestId("pola-6_hari")).not.toContainText("dipakai sekarang");

    const { data: audit } = await sb.from("audit_log").select("sebelum, sesudah").eq("perusahaan_id", pid).eq("aksi", "atur_pola_kerja").order("terjadi_at", { ascending: false }).limit(1);
    expect(audit![0]).toMatchObject({ sebelum: { pola_kerja: "6_hari" }, sesudah: { pola_kerja: "5_hari" } });
    const { data: lemburSesudah } = await sb.from("lembur").select("id, jenis, jam, diubah_at").eq("perusahaan_id", pid).order("id");
    expect(lemburSesudah).toEqual(lemburSebelum);

    // Halaman Gaji: libur pola 6 ditolak dengan pesan pola usaha, libur pola 5 diterima.
    await page.goto(`/app/gaji?bulan=${bulan}`);
    const form = page.getByRole("form", { name: "Catat lembur" });
    await form.getByLabel("Orang").selectOption({ label: nama.rina });
    await form.getByLabel("Tanggal").fill(`${bulan}-04`);
    await form.getByLabel("Jenis hari").selectOption("libur_pola_6_hari");
    await form.getByLabel("Jam lembur").fill("3");
    await form.getByRole("button", { name: "Catat lembur" }).click();
    await expect(form.getByRole("alert")).toContainText("Usahamu bekerja 5 hari seminggu");
    const { count: ditolak } = await sb.from("lembur").select("id", { count: "exact", head: true }).eq("orang_id", id.rina).eq("tanggal", `${bulan}-04`);
    expect(ditolak).toBe(0);
    await form.getByLabel("Jenis hari").selectOption("libur_pola_5_hari");
    await form.getByRole("button", { name: "Catat lembur" }).click();
    await expect(page.getByTestId("daftar-lembur").getByRole("listitem").filter({ hasText: nama.rina }).filter({ hasText: "kerja 5 hari seminggu" })).toBeVisible();

    // Admin: baca saja.
    const konteksAdmin = await browser.newContext({ locale: "id-ID", timezoneId: "Asia/Makassar" });
    const admin = await konteksAdmin.newPage();
    await admin.goto("/masuk/staf");
    await admin.getByLabel("Kode usaha").fill(usaha!.kode as string);
    await admin.getByLabel("ID kamu").fill(kodeStaf("admin"));
    await admin.getByLabel("PIN").fill(pin.admin);
    await admin.getByRole("button", { name: "Masuk" }).click();
    await expect(admin.getByTestId("peran")).toContainText("admin");
    await admin.goto("/app/perusahaan");
    const kartuAdmin = admin.getByTestId("aturan-kerja");
    await expect(kartuAdmin.getByTestId("pola-5_hari")).toContainText("dipakai sekarang");
    await expect(kartuAdmin.getByTestId("aturan-kerja-baca")).toHaveText("Hanya pemilik yang bisa mengubah aturan kerja. Kamu melihatnya saja.");
    await expect(kartuAdmin.getByRole("radio", { name: /6 hari seminggu/ })).toBeDisabled();
    await expect(kartuAdmin.getByRole("button", { name: "Simpan aturan kerja" })).toHaveCount(0);
    await axeKartu(admin, kartuAdmin, "aturan-kerja-admin");
    await konteksAdmin.close();

    // Staf: kartu tidak ada.
    const konteksStaf = await browser.newContext({ locale: "id-ID", timezoneId: "Asia/Makassar" });
    const staf = await konteksStaf.newPage();
    await staf.goto("/masuk/staf");
    await staf.getByLabel("Kode usaha").fill(usaha!.kode as string);
    await staf.getByLabel("ID kamu").fill(kodeStaf("staf"));
    await staf.getByLabel("PIN").fill(pin.staf);
    await staf.getByRole("button", { name: "Masuk" }).click();
    await expect(staf.getByTestId("peran")).toContainText("staf");
    await staf.goto("/app/perusahaan");
    await expect(staf.getByRole("listitem").filter({ hasText: NAMA_USAHA_POLA })).toBeVisible();
    await expect(staf.getByTestId("aturan-kerja")).toHaveCount(0);
    await konteksStaf.close();

    // Kembalikan ke 6 hari lewat kartu (lembar dampak muncul lagi karena ada lembur libur).
    await page.goto("/app/perusahaan");
    await kartu.getByRole("radio", { name: /6 hari seminggu/ }).check();
    await kartu.getByRole("button", { name: "Simpan aturan kerja" }).click();
    await expect(lembar).toContainText("aturan pola 6 hari");
    await lembar.getByRole("button", { name: "Ganti ke 6 hari" }).click();
    await expect(kartu.getByTestId("aturan-kerja-hasil")).toHaveText("Tersimpan. Usahamu bekerja 6 hari seminggu.");
    await expect(kartu.getByTestId("pola-6_hari")).toContainText("dipakai sekarang");
  } finally {
    if (pid) await sb.rpc("atur_pola_kerja", { p_pola: "6_hari", p_diatur_sendiri: false });
    for (const o of Object.values(id)) {
      await sb.from("anggota").update({ aktif: false }).eq("orang_id", o);
      await sb.from("orang").update({ status: "nonaktif" }).eq("id", o);
    }
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
