import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F1-05: isi gaji Rp8.000.000 TK/0 di halaman Orang, siapkan gaji, PPh 21 Rp125.448 (TER A 1,5% x bruto 8.363.200), iuran
// JP terhitung tanpa peringatan, setujui, bagikan, slip terbuka tanpa akun. Memakai usaha khusus "Uji Gaji E2E" milik akun A dan bulan yang belum pernah
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
    // Neto = 8.000.000 - BPJS Kes 80.000 - JHT 160.000 - JP 80.000 (1%, batas Rp11.086.300 surat BPJS B/1226/022026) - PPh 21 125.448
    // = 7.554.552. Iuran JP usaha tidak masuk bruto PPh 21.
    await expect(slip).toContainText("Rp7.554.552");
    await expect(slip).not.toContainText("Jaminan Pensiun tahun ini belum terverifikasi");
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
    await expect(tamu.getByTestId("slip-neto")).toContainText("Rp7.554.552");
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
    // Tanpa lembur: 3.460.000 - BPJS Kes 34.600 - JHT 69.200 - JP 34.600 = 3.321.600 (bruto PPh di bawah batas TER A 0%).
    await expect(slip).toContainText("Rp3.321.600");

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
    await expect(slip).toContainText("Rp3.471.600");
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
    await expect(kartu).toContainText("Mengikuti UU 27/2026 Pasal 115 dan 118 serta PP 36/2021 Pasal 17. Total tetap 40 jam seminggu.");
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

// F4-09: cadangan pesangon di /app/gaji (pemilik). Karyawan mulai 50 bulan lalu (tanggal 1; zona usaha Indonesia di depan UTC,
// jadi masa kerja 4 tahun lebih sedikit), pokok Rp3.500.000 + tunjangan tetap Rp500.000 -> 5 bulan pesangon + 2 bulan
// penghargaan = Rp28.000.000; rentang UU 27/2026: pensiun 2 kali pesangon + 1 kali UPMK = Rp48.000.000 (Pasal 247), baris rugi 0,5 kali
// PP 35/2021 tidak ada lagi karena tutup karena rugi kini 1 kali (Pasal 237). Satu karyawan tanpa tanggal mulai belum dihitung.
// Saldo Rp4.000.000 -> kekurangan Rp24.000.000 -> sisihkan Rp2.000.000 sebulan. Usaha "Uji Gaji E2E" (akun A dekat batas 20 usaha).
test("cadangan pesangon: perkiraan skenario dasar, rentang, saran sisihan, bertanda belum final", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", NAMA_USAHA).limit(1);
    const pid = ada?.[0]?.id as string;
    expect(pid, "usaha Uji Gaji E2E dibuat tes gaji sebelumnya").toBeTruthy();
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid).eq("status", "aktif");
    const t = Date.now();
    const nama = `Pesangon Sari ${t}`;
    const tanpaMulai = `Pesangon Budi ${t}`;
    const kini = new Date();
    const awal = new Date(Date.UTC(kini.getUTCFullYear(), kini.getUTCMonth() - 50, 1)).toISOString().slice(0, 10);
    expect((await sb.from("orang").insert([{ perusahaan_id: pid, nama }, { perusahaan_id: pid, nama: tanpaMulai }])).error).toBeNull();

    await page.goto("/masuk?next=/app/orang");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/orang");
    for (const [n, mulai] of [[nama, awal], [tanpaMulai, ""]] as const) {
      const baris = page.getByRole("listitem").filter({ hasText: n });
      await baris.getByText("Gaji belum diisi").click();
      const form = baris.getByRole("form", { name: `Gaji ${n}` });
      await form.getByLabel("Gaji pokok (Rp)").fill("3500000");
      await form.getByLabel("Tunjangan tetap (Rp)").fill("500000");
      if (mulai) await form.getByLabel("Mulai kerja").fill(mulai);
      await form.getByRole("button", { name: `Simpan gaji ${n}` }).click();
      await expect(form.getByText("Tersimpan.")).toBeVisible();
    }

    await page.goto("/app/gaji");
    const kartu = page.getByTestId("cadangan-pesangon");
    await expect(kartu).toContainText("Perkiraan, belum final");
    await expect(kartu).toContainText("Rp28.000.000");
    await expect(kartu).toContainText("1 orang belum dihitung");
    await expect(kartu.getByTestId("rentang-pesangon")).toContainText("Rp48.000.000");
    await expect(kartu.getByTestId("rentang-pesangon")).not.toContainText("Rp18.000.000");
    await expect(kartu).not.toContainText("PP 35/2021 Pasal 40");
    await kartu.getByLabel("Sudah disisihkan (Rp)").fill("4000000");
    await kartu.getByRole("button", { name: "Simpan saldo" }).click();
    await expect(kartu.getByText("Saldo tersimpan.")).toBeVisible();
    await expect(kartu.getByTestId("saran-pesangon")).toContainText("Rp2.000.000");
    await kartu.getByText("Rincian per orang").click();
    const rincian = kartu.getByTestId("rincian-pesangon");
    await expect(rincian.getByRole("listitem").filter({ hasText: nama })).toContainText("5 bulan pesangon + 2 bulan penghargaan");
    await expect(rincian.getByRole("listitem").filter({ hasText: tanpaMulai })).toContainText("Tanggal mulai kerja belum diisi");
    await kartu.getByText("Dari mana angka ini?").click();
    await expect(kartu).toContainText("gaji pokok ditambah tunjangan tetap (Pasal 234)");
    await kartu.scrollIntoViewIfNeeded();
    await periksaUi(page, "pesangon");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});

// M-10B: kasbon dicatat pemilik, cicilannya masuk slip saat gaji disiapkan, sisa berkurang saat disetujui, lalu berkas payroll
// CIMB Niaga OCTO Biz (inhouse dan SKN) diunduh dan lolos pemeriksa format resmi. Usaha sendiri "Uji Kasbon E2E", bulan baru.
test("kasbon: cicilan di slip, sisa berkurang saat disetujui, berkas transfer CIMB Niaga", async ({ page }) => {
  test.setTimeout(180_000);
  const { periksaPayroll } = await import("../src/lib/gaji/transfer");
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", "Uji Kasbon E2E").limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: "Uji Kasbon E2E", p_industri: "fnb" });
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
    const tanda = Date.now().toString(36).toUpperCase();
    const nama = `Kasbon Cimb ${tanda}`;
    const nama2 = `Kasbon Bca ${tanda}`;
    expect((await sb.from("orang").insert({ perusahaan_id: pid, nama, data: { mulai: `${bulan}-15` } })).error).toBeNull();
    const { data: o2 } = await sb.from("orang").insert({ perusahaan_id: pid, nama: nama2, data: { mulai: `${bulan}-15` } }).select("id").single();
    expect((await sb.from("orang_rahasia").upsert({ orang_id: o2!.id, perusahaan_id: pid, gaji: { pokok: 3_000_000 }, bank: "BCA (BANK CENTRAL ASIA)", rekening: "0987654321", atas_nama: "KASBON BCA" }, { onConflict: "orang_id" })).error).toBeNull();

    // Rekening dan gaji lewat formulir di halaman Orang.
    await page.goto("/masuk?next=/app/orang");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL(/\/app\/orang/);
    const baris = page.getByRole("listitem").filter({ hasText: nama });
    await baris.getByText("Gaji belum diisi").click();
    const form = baris.getByRole("form", { name: `Gaji ${nama}` });
    await form.getByLabel("Gaji pokok (Rp)").fill("4000000");
    await form.getByLabel("Bank", { exact: true }).fill("CIMB NIAGA");
    await form.getByLabel("Nomor rekening").fill("8001-5342-3700");
    await form.getByLabel("Atas nama rekening").fill("Kasbon Cimb");
    await form.getByRole("button", { name: `Simpan gaji ${nama}` }).click();
    await expect(form.getByText("Tersimpan.")).toBeVisible();
    const { data: r1 } = await sb.from("orang_rahasia").select("rekening, rekening_akhir, orang:orang_id!inner(nama)").eq("orang.nama", nama).single();
    expect(r1).toMatchObject({ rekening: "800153423700", rekening_akhir: "3700" });

    // Kasbon Rp1.000.000, cicilan Rp300.000.
    await page.goto("/app/gaji/kasbon");
    const fk = page.getByRole("form", { name: "Beri kasbon" });
    await fk.getByLabel("Karyawan").selectOption({ label: nama });
    await fk.getByLabel("Jumlah (Rp)").fill("1000000");
    await fk.getByLabel("Cicilan per bulan (Rp)").fill("300000");
    await fk.getByLabel("Alasan").fill("Biaya sekolah anak");
    await fk.getByRole("button", { name: "Catat kasbon" }).click();
    await expect(page.getByRole("status")).toContainText("Kasbon tercatat");
    await page.reload();
    await expect(page.getByTestId("daftar-kasbon").locator(`li[data-orang="${nama}"]`)).toContainText("Rp1.000.000");
    await periksaUi(page, "kasbon");

    await page.goto(`/app/gaji?bulan=${bulan}`);
    await page.getByRole("button", { name: "Siapkan gaji bulan ini" }).click();
    await expect(page.getByText("Draf gaji siap untuk 2 orang.")).toBeVisible();
    await page.reload();
    const slip = page.getByTestId("daftar-slip").getByRole("listitem").filter({ hasText: nama });
    await slip.getByText("Rincian").click();
    await expect(slip.getByText("Potongan Cicilan kasbon")).toBeVisible();
    await expect(slip).toContainText("-Rp300.000");
    await page.getByRole("button", { name: "Setujui gaji bulan ini" }).click();
    await expect(page.getByTestId("berkas-transfer")).toBeVisible();
    await periksaUi(page, "gaji-transfer");

    // Sisa kasbon berkurang setelah disetujui.
    await page.goto("/app/gaji/kasbon");
    const kb = page.getByTestId("daftar-kasbon").locator(`li[data-orang="${nama}"]`);
    await expect(kb).toContainText("Rp700.000");
    await expect(kb).toContainText("1 kali dipotong gaji");

    // Berkas inhouse diunduh lewat formulir; SKN lewat permintaan langsung. Neto sama dengan slip di database.
    const { data: s } = await sb.from("slip_gaji").select("neto, orang:orang_id!inner(nama), periode_gaji!inner(bulan)").eq("periode_gaji.bulan", `${bulan}-01`);
    const neto = (n: string) => ((s ?? []) as unknown as { neto: number; orang: { nama: string } }[]).find((x) => x.orang.nama === n)!.neto;
    await page.goto(`/app/gaji?bulan=${bulan}`);
    const ft = page.getByTestId("berkas-transfer");
    await ft.getByLabel("Rekening sumber usaha").fill("763340048300");
    await ft.getByLabel("Nama rekening sumber").fill("Uji Kasbon");
    await ft.getByLabel("Tanggal transfer").fill(`${bulan}-25`);
    const [unduh] = await Promise.all([page.waitForEvent("download"), ft.getByRole("button", { name: "Unduh berkas" }).click()]);
    expect(unduh.suggestedFilename()).toBe(`payroll-cimb-inhouse-${bulan}.csv`);
    const csv = readFileSync(await unduh.path(), "utf8");
    expect(periksaPayroll("inhouse", csv)).toMatchObject({ ok: true, baris: 1, total: neto(nama) });
    expect(csv.split("\r\n")[1]).toBe(`800153423700,KASBON CIMB,IDR,${neto(nama)},Gaji ${bulan},,`);
    const skn = await page.request.get(`/app/gaji/transfer?bulan=${bulan}&jalur=skn&rekening=763340048300&nama=Uji%20Kasbon&tanggal=${bulan}-25`);
    expect(skn.status()).toBe(200);
    const csv2 = await skn.text();
    expect(periksaPayroll("skn", csv2)).toMatchObject({ ok: true, baris: 1, total: neto(nama2), peringatan: [] });
    expect(csv2).toContain("0987654321,KASBON BCA,IDR,");
    expect(csv2).toContain(",BCA (BANK CENTRAL ASIA),Y,Y,,1,");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});

// M-18: staf menempel teks e-struk parkir (jumlah, tanggal, kategori terisi), klaim di atas batas ditolak, pemilik menyetujui di
// Feed, klaim ikut slip gaji sebagai penggantian biaya, setelah gaji disetujui klaim berstatus Dibayar. Usaha "Uji Klaim E2E".
test("klaim: e-struk, batas kategori, disetujui di Feed, dibayar lewat slip", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", "Uji Klaim E2E").limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: "Uji Klaim E2E", p_industri: "fnb" });
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
    const tanda = Date.now().toString(36).toUpperCase();
    const nama = `Sales Klaim ${tanda}`;
    const kategori = `Parkir ${tanda}`;

    await page.goto("/masuk?next=/app/orang");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL(/\/app\/orang/);
    const kode = (await page.getByTestId("kode-usaha").textContent())!.trim();
    await page.getByLabel("Nama orang").fill(nama);
    await page.getByRole("button", { name: "Tambah" }).click();
    const baris = page.getByRole("listitem").filter({ hasText: nama });
    await baris.getByPlaceholder("PIN 6 angka").fill("778899");
    await baris.getByRole("button", { name: "Buat akun staf" }).click();
    const id = (await baris.getByTestId("info-akun").textContent())!.match(/ID (S\d{3})/)![1];
    await baris.getByText("Gaji belum diisi").click();
    const fg = baris.getByRole("form", { name: `Gaji ${nama}` });
    await fg.getByLabel("Gaji pokok (Rp)").fill("3000000");
    await fg.getByRole("button", { name: `Simpan gaji ${nama}` }).click();
    await expect(fg.getByText("Tersimpan.")).toBeVisible();

    await page.goto("/app/klaim");
    const fk = page.getByRole("form", { name: "Tambah kategori klaim" });
    await fk.getByLabel("Nama kategori").fill(kategori);
    await fk.getByLabel(/^Batas per orang/).fill("100000");
    await fk.getByLabel("Wajib foto struk").uncheck();
    await fk.getByRole("button", { name: "Tambah kategori" }).click();
    await expect(page.getByTestId("daftar-kategori")).toContainText(kategori);
    await periksaUi(page, "klaim-pemilik");

    const s = await (await browser.newContext()).newPage();
    await s.goto("/masuk/staf");
    await s.getByLabel("Kode usaha").fill(kode);
    await s.getByLabel("ID kamu").fill(id);
    await s.getByLabel("PIN").fill("778899");
    await s.getByRole("button", { name: "Masuk" }).click();
    await expect(s.getByTestId("peran")).toContainText("staf");
    await s.goto("/app/klaim");
    const hari = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
    const [th, bl, hr] = hari.split("-");
    const fm = s.getByRole("form", { name: "Ajukan klaim" });
    await fm.getByLabel(/^Tempel teks e-struk/).fill(`PARKIR MAL SENTRAL\nMasuk : ${hr}/${bl}/${th} 09:12\nKeluar : ${hr}/${bl}/${th} 12:40\nTotal Bayar Rp 15.000\nTerima kasih`);
    await expect(fm.getByLabel("Jumlah (Rp)")).toHaveValue("15000");
    await expect(fm.getByLabel("Tanggal struk")).toHaveValue(hari);
    await fm.getByLabel("Kategori").selectOption({ label: kategori });
    await fm.getByLabel("Untuk apa").fill("Parkir antar barang ke pelanggan");
    await fm.getByRole("button", { name: "Ajukan klaim" }).click();
    await expect(s.getByTestId("daftar-klaim").locator('li[data-keterangan="Parkir antar barang ke pelanggan"]')).toContainText("Menunggu");
    await expect(s.getByTestId("sisa-batas")).toContainText("Rp85.000");
    await fm.getByLabel("Kategori").selectOption({ label: kategori });
    await fm.getByLabel("Jumlah (Rp)").fill("90000");
    await fm.getByLabel("Untuk apa").fill("Parkir menginap");
    await fm.getByRole("button", { name: "Ajukan klaim" }).click();
    await expect(s.getByRole("alert").filter({ hasText: "Melebihi batas" })).toContainText("Rp85.000");
    await periksaUi(s, "klaim-staf");

    await page.goto("/app");
    const kartu = page.locator("article").filter({ hasText: `Ganti biaya ${kategori} ${nama}` }).last();
    await kartu.getByRole("button", { name: "Setujui" }).click();
    await expect(kartu).toHaveAttribute("data-tersimpan", "ya");

    await page.goto(`/app/gaji?bulan=${bulan}`);
    await page.getByRole("button", { name: "Siapkan gaji bulan ini" }).click();
    await expect(page.getByText("Draf gaji siap untuk 1 orang.")).toBeVisible();
    await page.reload();
    const slip = page.getByTestId("daftar-slip").getByRole("listitem").filter({ hasText: nama });
    await slip.getByText("Rincian").click();
    await expect(slip.getByText("Penggantian biaya (klaim)")).toBeVisible();
    await expect(slip).toContainText("Rp15.000");
    await page.getByRole("button", { name: "Setujui gaji bulan ini" }).click();
    // Slip boleh ditahan Gerbang Gaji (orang baru); penggantian tetap lunas saat periode disetujui.
    await expect(page.getByRole("button", { name: "Setujui gaji bulan ini" })).toHaveCount(0);

    await s.reload();
    await expect(s.getByTestId("daftar-klaim").locator('li[data-keterangan="Parkir antar barang ke pelanggan"]')).toContainText("Dibayar");
    await s.context().close();
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});

// M-18B: staf memotret struk SPBU yang buram (fixtures/korpus/struk-foto/sulit/struk-01.jpg). OCR di HP kurang yakin, jadi foto
// diunggah dan dibaca baca-berkas mode struk: jumlah, tanggal, kategori bensin, dan keterangan (nama SPBU) terisi; klaim diajukan
// dengan struk yang sama (tanpa unggah ulang) dan tidak ada usulan nota dari berkas itu. Ekor byte unik agar bukan berkas yang sama.
test("klaim: foto struk buram dibaca AI sampai formulir terisi, klaim diajukan dengan struk", async ({ browser }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", "Uji Klaim E2E").limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: "Uji Klaim E2E", p_industri: "fnb" });
      expect(error).toBeNull();
      pid = data as string;
    } else {
      expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    }
    await sb.auth.refreshSession();
    const tanda = Date.now().toString(36).toUpperCase();
    const kategori = `Bensin dinas ${tanda}`;
    expect((await sb.rpc("simpan_kategori_klaim", { p_id: null, p_nama: kategori, p_batas: null, p_akun: "", p_butuh_struk: true, p_aktif: true })).error).toBeNull();
    const { data: o, error: eO } = await sb.from("orang").insert({ perusahaan_id: pid, nama: `Kurir Foto ${tanda}`, data: {} }).select("id").single();
    expect(eO).toBeNull();
    expect((await sb.rpc("buat_akun_staf", { p_orang: o!.id, p_pin: "246813" })).error).toBeNull();
    const { data: info } = await sb.from("orang").select("id_staf").eq("id", o!.id).single();
    const { data: usaha } = await sb.from("perusahaan").select("kode").eq("id", pid).single();

    const s = await (await browser.newContext()).newPage();
    await s.goto("/masuk/staf");
    await s.getByLabel("Kode usaha").fill(usaha!.kode as string);
    await s.getByLabel("ID kamu").fill(info!.id_staf as string);
    await s.getByLabel("PIN").fill("246813");
    await s.getByRole("button", { name: "Masuk" }).click();
    await expect(s.getByTestId("peran")).toContainText("staf");
    await s.goto("/app/klaim");
    const fm = s.getByRole("form", { name: "Ajukan klaim" });
    // Tunggu hidrasi: onChange input berkas baru terpasang setelah React aktif.
    await s.waitForLoadState("networkidle");
    const foto = readFileSync(join(__dirname, "..", "..", "..", "fixtures", "korpus", "struk-foto", "sulit", "struk-01.jpg"));
    await s.getByTestId("foto-struk").setInputFiles({ name: "struk-spbu.jpg", mimeType: "image/jpeg", buffer: Buffer.concat([foto, Buffer.from(`e2e-${tanda}`)]) });
    // T-01B: bacaan model ikut mempelajari tata letaknya bila teks OCR cukup (pesan belajar); setelah aturannya aktif, struk SPBU
    // yang sama dibaca tanpa AI. Keduanya sah di usaha uji yang dipakai berulang.
    await expect(fm.getByRole("status")).toContainText(/Dibaca Nadi dengan AI|tanpa AI/, { timeout: 90_000 });
    await expect(fm.getByLabel("Jumlah (Rp)")).toHaveValue("64800");
    await expect(fm.getByLabel("Tanggal struk")).toHaveValue("2026-10-04");
    // Tebakan kategori: kategori bensin pertama di usaha ini (jalan sebelumnya meninggalkan kategori bensin lain).
    await expect(fm.getByLabel("Kategori").locator("option:checked")).toHaveText(/^Bensin dinas \w+ \(wajib struk\)$/);
    await fm.getByLabel("Kategori").selectOption({ label: `${kategori} (wajib struk)` });
    await expect(fm.getByLabel("Untuk apa")).toHaveValue(/SPBU 34\.520\.88/);
    // Klaim hanya boleh untuk struk 60 hari terakhir; setelah itu tanggal korpus terlalu lama, staf mengganti ke hari ini.
    const hari = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
    if (Date.parse(hari) - Date.parse("2026-10-04") > 55 * 86_400_000) await fm.getByLabel("Tanggal struk").fill(hari);
    await fm.getByLabel("Untuk apa").fill(`Bensin antar pesanan ${tanda}`);
    await fm.getByRole("button", { name: "Ajukan klaim" }).click();
    await expect(s.getByTestId("daftar-klaim").locator(`li[data-keterangan="Bensin antar pesanan ${tanda}"]`)).toContainText("Menunggu");
    await s.context().close();

    const { data: kl } = await sb.from("klaim").select("jumlah, berkas_id").eq("perusahaan_id", pid).eq("keterangan", `Bensin antar pesanan ${tanda}`).single();
    expect(kl!.jumlah).toBe(64800);
    expect(kl!.berkas_id).toBeTruthy();
    const { data: b } = await sb.from("berkas").select("status, jenis_terdeteksi, token_ai").eq("id", kl!.berkas_id).single();
    expect(b).toMatchObject({ status: "dibaca", jenis_terdeteksi: "struk" });
    expect(b!.token_ai).toBeGreaterThan(0);
    const { count } = await sb.from("usulan").select("id", { count: "exact", head: true }).eq("berkas_id", kl!.berkas_id).neq("aksi", "klaim.setujui");
    expect(count).toBe(0);
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
