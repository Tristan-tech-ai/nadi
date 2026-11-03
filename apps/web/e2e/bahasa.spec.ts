import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// I-02: bahasa id/en. Landing berganti bahasa lewat navigasi klien (tanpa muat ulang halaman), pilihan diingat cookie;
// di aplikasi pilihan tersimpan di akun (user_metadata) sehingga ikut ke sesi lain.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.describe.configure({ mode: "serial" });

test("landing: ganti ke English tanpa muat ulang, cookie diingat, format angka en, axe bersih", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nadi yang merapikan");
  await page.evaluate(() => ((window as unknown as { __tanda: number }).__tanda = 7));
  await page.getByTestId("pemilih-bahasa").click();
  await page.waitForURL((u) => u.pathname === "/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nadi sorts it out.");
  // Navigasi klien: objek window yang sama, jadi halaman tidak dimuat ulang.
  expect(await page.evaluate(() => (window as unknown as { __tanda?: number }).__tanda)).toBe(7);
  await expect(page.locator("#harga li").nth(1)).toContainText("Rp149,000");
  await expect(page.locator("#harga li").nth(1)).toContainText("Business");
  await expect(page.locator("[lang=en]").first()).toBeVisible();

  // Cookie: beranda Indonesia mengalihkan ke /en sampai pengguna memilih Bahasa Indonesia lagi.
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(2600);
      const r = await new AxeBuilder({ page }).analyze();
      expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${w} ${skema}`).toEqual([]);
      await page.screenshot({ path: info.outputPath(`en-${w}-${skema}.png`) });
    }
  }
  await page.getByTestId("pemilih-bahasa").click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Nadi yang merapikan");
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
});

/** Teks isi layar aplikasi tanpa bagian bertanda lang="id" (isi yang memang ditulis dalam bahasa Indonesia) dan tanpa
 *  data pengguna bertanda data-pengguna (nama orang, nama usaha). */
async function teksTanpaId(page: Page) {
  return page.locator("#isi").evaluate((el) => {
    const salin = el.cloneNode(true) as HTMLElement;
    salin.querySelectorAll('[lang="id"], [data-pengguna]').forEach((x) => x.remove());
    document.body.appendChild(salin);
    const t = salin.innerText;
    salin.remove();
    return t;
  });
}
const KATA_ID = /\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau|usulan|setujui|tolak|berkas|lempar|izin|cuti|sakit|hari|pengajuan|gaji|lembur|potongan|orang|bulan|jadwal|minggu|jam|menit|senin|selasa|rabu|kamis|jumat|sabtu|kebutuhan|lowongan|pelamar|topi|staf|akun)\b/i;

/** Baris teks yang memuat kata Indonesia umum; kosong berarti lulus (pesan gagal langsung menyebut barisnya). */
function barisIndonesia(teks: string) {
  return teks.split(/\n/).map((b) => b.trim()).filter((b) => KATA_ID.test(b));
}

async function masuk(page: Page) {
  await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
}

test("aplikasi: pilihan bahasa tersimpan di akun dan ikut ke sesi lain, Feed dan Lempar berbahasa Inggris @bahasa-akun", async ({ browser }) => {
  test.skip(!E.E2E_SANDI, "butuh .env.e2e.local");
  // Delapan layar aplikasi diperiksa berurutan (pindai teks + axe), jadi batas 30 dtk bawaan tidak cukup.
  test.setTimeout(120_000);
  const k1 = await browser.newContext();
  const p1 = await k1.newPage();
  await masuk(p1);
  const nav = p1.getByRole("navigation", { name: /Navigasi utama|Main navigation/ });
  if ((await p1.getByTestId("pemilih-bahasa-app").innerText()) === "Bahasa Indonesia") {
    // Sisa jalan sebelumnya yang gagal: kembalikan ke Indonesia dulu.
    await p1.getByTestId("pemilih-bahasa-app").click();
    await expect(p1.getByTestId("pemilih-bahasa-app")).toHaveText("English");
  }
  await expect(nav).toContainText("Feed");
  await expect(p1.getByRole("button", { name: "Keluar" })).toBeVisible();
  await p1.getByTestId("pemilih-bahasa-app").click();
  await expect(p1.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(p1.getByRole("navigation", { name: "Main navigation" })).toBeVisible();

  // I-03 (b): Feed mode Inggris. Teks yang ditulis Nadi dalam bahasa Indonesia (isi usulan, insight) bertanda lang="id"
  // dan dikecualikan dari pemindaian; sisanya tidak boleh memuat kata Indonesia umum.
  await expect(p1.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await expect(p1.getByTestId("peran")).toHaveText("You are signed in as owner.");
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axe = await new AxeBuilder({ page: p1 }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Lempar mode Inggris: berkas berjenis asing ditolak di perangkat dengan pesan Inggris, tanpa Coba lagi.
  await p1.goto("/app/lempar");
  await expect(p1.getByRole("heading", { level: 1, name: "Drop it" })).toBeVisible();
  await p1.getByTestId("input-berkas").setInputFiles({ name: "catatan.txt", mimeType: "text/plain", buffer: Buffer.from("halo") });
  await expect(p1.getByTestId("daftar-lempar")).toContainText("This file type cannot be read yet");
  await expect(p1.getByTestId("coba-lagi")).toHaveCount(0);
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeLempar = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeLempar.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Izin mode Inggris (pemilik tanpa data karyawan sendiri: daftar pengajuan tim).
  await p1.goto("/app/izin");
  await expect(p1.getByRole("heading", { level: 1, name: "Leave and time off" })).toBeVisible();
  await expect(p1.getByRole("heading", { level: 2, name: "Team requests" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeIzin = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeIzin.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Gaji mode Inggris: label khusus Indonesia tampil; istilah PPh 21/BPJS dan cadangan pesangon bertanda lang="id".
  await p1.goto("/app/gaji");
  await expect(p1.getByRole("heading", { level: 1, name: "Payroll" })).toBeVisible();
  await expect(p1.getByTestId("khusus-indonesia")).toContainText("Indonesia only");
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeGaji = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeGaji.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Jadwal mode Inggris (pemilik): nama hari, total jam, kebutuhan; nama orang dan topi bertanda data-pengguna.
  await p1.goto("/app/jadwal");
  await expect(p1.getByRole("heading", { level: 1, name: "Schedule" })).toBeVisible();
  await expect(p1.getByRole("link", { name: "Next week" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeJadwal = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeJadwal.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Orang mode Inggris: daftar, akun staf, gaji per orang, lowongan, belajar dari rekrutmen.
  await p1.goto("/app/orang");
  await expect(p1.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
  await expect(p1.getByRole("heading", { level: 2, name: "Job openings" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeOrang = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeOrang.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Usahamu mode Inggris: daftar usaha, pemberitahuan, aturan kerja, aturan izin, keputusan otomatis, tablet, AI, alur.
  await p1.goto("/app/perusahaan");
  await expect(p1.getByRole("heading", { level: 1, name: "Your business" })).toBeVisible();
  await expect(p1.getByRole("heading", { level: 2, name: "Work rules" })).toBeVisible();
  await expect(p1.getByTestId("pemberitahuan")).not.toHaveAttribute("data-keadaan", "memeriksa");
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeUsaha = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeUsaha.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Kerja mode Inggris (papan hari ini): status kolom, kartu, tombol Tambah kerja; judul kerja data pengguna.
  await p1.goto("/app/kerja");
  await expect(p1.getByRole("heading", { level: 1, name: "Today's work" })).toBeVisible();
  await expect(p1.getByRole("button", { name: "Add work" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeKerja = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeKerja.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Tab beban dan kinerja mode Inggris.
  for (const [tab, judul] of [["beban", "This week's workload"], ["kpi", "This week's performance"], ["peta", "Org map"], ["bonus", "Workload bonus pool"]] as const) {
    await p1.goto(`/app/kerja?tab=${tab}`);
    await expect(p1.getByRole("heading", { level: 2, name: judul })).toBeVisible();
    expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
    const axeTab = await new AxeBuilder({ page: p1 }).analyze();
    expect(axeTab.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  }

  // Invoice mode Inggris: umur tagihan, pengingat, cocok mutasi, formulir; halaman /i/ dan pesan WA pelanggan tetap Indonesia.
  await p1.goto("/app/invoice");
  await expect(p1.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
  await expect(p1.getByRole("heading", { level: 2, name: "New invoice" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeInvoice = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeInvoice.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Agenda surat mode Inggris; isi surat dan perihal adalah data pengguna.
  await p1.goto("/app/surat");
  await expect(p1.getByRole("heading", { level: 1, name: "Incoming letter log" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeSurat = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeSurat.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Surat keluar mode Inggris; isi surat adalah dokumen resmi Indonesia (lang=id).
  await p1.goto("/app/surat-keluar");
  await expect(p1.getByRole("heading", { level: 1, name: "Outgoing letters" })).toBeVisible();
  await expect(p1.getByTestId("khusus-indonesia")).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeSuratKeluar = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeSuratKeluar.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Ruang Akuntan mode Inggris; BPMP berlabel Indonesia only.
  await p1.goto("/app/akuntan");
  await expect(p1.getByRole("heading", { level: 1, name: "Accountant room" })).toBeVisible();
  await expect(p1.getByTestId("khusus-indonesia")).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeAkuntan = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeAkuntan.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Kompas Pajak mode Inggris; kutipan pasal dan kalimat hitungan bertanda lang=id, label Indonesia only.
  await p1.goto("/app/pajak");
  await expect(p1.getByRole("heading", { level: 1, name: "Tax Compass" })).toBeVisible();
  await expect(p1.getByTestId("khusus-indonesia")).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axePajak = await new AxeBuilder({ page: p1 }).analyze();
  expect(axePajak.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Mata dan Peta usaha mode Inggris; nama zona adalah data pengguna.
  for (const [jalur, judul] of [["/app/mata", "Eyes"], ["/app/peta-usaha", "Business map"]] as const) {
    await p1.goto(jalur);
    await expect(p1.getByRole("heading", { level: 1, name: judul })).toBeVisible();
    expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
    const axeMata = await new AxeBuilder({ page: p1 }).analyze();
    expect(axeMata.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  }

  // Mulai (buat usaha) mode Inggris.
  await p1.goto("/app/mulai");
  await expect(p1.getByRole("heading", { level: 1, name: "What business do you run?" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeMulai = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeMulai.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Serah terima mode Inggris; judul butir dan nama orang bertanda lang=id/data-pengguna.
  await p1.goto("/app/serah-terima");
  await expect(p1.getByRole("heading", { level: 1, name: "Handover" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeSerah = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeSerah.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Wawancara pelamar mode Inggris (lamaran pertama yang punya jawaban suara di usaha aktif akun A).
  const sbW = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sbW.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const lamaranW = (await sbW.from("jawaban_wawancara").select("lamaran_id").eq("status", "masuk").limit(1).maybeSingle()).data?.lamaran_id;
  if (lamaranW) {
    await p1.goto(`/app/wawancara/${lamaranW}`);
    await expect(p1.getByRole("heading", { level: 2, name: "Summary" })).toBeVisible();
    await expect(p1.getByTestId("khusus-indonesia")).toBeVisible();
    expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
    const axeW = await new AxeBuilder({ page: p1 }).analyze();
    expect(axeW.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  }

  // Kepala aplikasi mode Inggris: tautan lompat dan logo.
  await expect(p1.locator("a.lompat-isi")).toHaveText("Skip to content");
  await expect(p1.getByRole("link", { name: "App home" })).toBeVisible();

  // Magang mode Inggris: dana rekrutmen, rencana, formulir, tabel biaya; isi rencana dan nama data pengguna.
  await p1.goto("/app/magang");
  await expect(p1.getByRole("heading", { level: 1, name: "Internships" })).toBeVisible();
  await expect(p1.getByRole("heading", { level: 2, name: "Cost per hire" })).toBeVisible();
  expect(barisIndonesia(await teksTanpaId(p1))).toEqual([]);
  const axeMagang = await new AxeBuilder({ page: p1 }).analyze();
  expect(axeMagang.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);

  // Sesi baru tanpa cookie bahasa: pilihan datang dari akun.
  const k2 = await browser.newContext();
  const p2 = await k2.newPage();
  await masuk(p2);
  await expect(p2.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect((await k2.cookies()).some((c) => c.name === "nadi_bahasa")).toBe(false);

  // Kembalikan ke Indonesia agar spec lain tetap memakai teks Indonesia.
  await p2.getByTestId("pemilih-bahasa-app").click();
  await expect(p2.getByRole("button", { name: "Keluar" })).toBeVisible();
  await k1.close();
  await k2.close();
});

test("harga dua bahasa: /en/harga berbahasa Inggris, pemilih bolak-balik ke /harga, axe bersih", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  await page.goto("/en/harga");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pricing");
  await expect(page.locator("main")).toContainText("Rp149,000");
  await expect(page.getByRole("table")).toContainText("20 people");
  const teks = await page.locator("main").innerText();
  expect(teks).not.toMatch(/\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i);
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByTestId("pemilih-bahasa").click();
  await page.waitForURL((u) => u.pathname === "/harga");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harga");
});

test("keamanan dua bahasa: /en/keamanan berbahasa Inggris dan axe bersih", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sekali (desktop)");
  await page.goto("/en/keamanan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data security");
  await expect(page.locator("main h2")).toHaveCount(6);
  expect(await page.locator("main").innerText()).not.toMatch(/\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i);
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.getByTestId("pemilih-bahasa").click();
  await page.waitForURL((u) => u.pathname === "/keamanan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Keamanan data");
});

for (const [jalur, judul, idJudul] of [["/en/privasi", "Privacy policy", "Kebijakan privasi"], ["/en/syarat", "Terms of service", "Syarat layanan"]]) {
  test(`${jalur} berbahasa Inggris, tanda draf ada, axe bersih`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sekali (desktop)");
    await page.goto(jalur);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(judul);
    await expect(page.getByRole("note")).toContainText("not yet reviewed by a lawyer");
    expect(await page.locator("main").innerText()).not.toMatch(/\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i);
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.getByTestId("pemilih-bahasa").click();
    await page.waitForURL((u) => u.pathname === jalur.replace("/en", ""));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(idJudul);
  });
}

for (const [jalur, judul, idJudul, h2] of [["/en/tentang", "About Nadi", "Tentang Nadi", 3], ["/en/panduan", "Nadi guide", "Panduan Nadi", 4]] as const) {
  test(`${jalur} berbahasa Inggris dan axe bersih`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "sekali (desktop)");
    await page.goto(jalur);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(judul);
    await expect(page.locator("main h2")).toHaveCount(h2);
    expect(await page.locator("main").innerText()).not.toMatch(/\b(dan|yang|untuk|dengan|tidak|kamu|usaha|karyawan|belum|sudah|atau)\b/i);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Guide by role" })).toHaveAttribute("href", "/en/panduan");
    const r = await new AxeBuilder({ page }).analyze();
    expect(r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
    await page.getByTestId("pemilih-bahasa").click();
    await page.waitForURL((u) => u.pathname === jalur.replace("/en", ""));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(idJudul);
  });
}
