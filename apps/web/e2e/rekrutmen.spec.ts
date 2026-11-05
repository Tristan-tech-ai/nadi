import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// M-14: pemilik (akun B, usaha "Uji Rekrut E2E") memasang lowongan ke pencarian (JobPosting di /lamar lolos uji struktur),
// pelamar melamar lewat tautan ?src=instagram, pemilik menjadwalkan wawancara dan mendapat undangan WhatsApp + .ics,
// pelamar melihat jadwal di halaman status dan menyimpan .ics, laporan menghitung sumber, rencana kebutuhan orang tersimpan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Rekrut E2E";
const CV = join(__dirname, "..", "..", "..", "fixtures", "korpus", "cv", "cv-01.pdf");

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
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${nama} ${lebar} tanpa gulir samping`).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

const isiUnduhan = async (p: Page, klik: () => Promise<void>) => {
  const [u] = await Promise.all([p.waitForEvent("download"), klik()]);
  return readFileSync((await u.path())!, "utf8");
};

test("rekrutmen: JobPosting, sumber, undangan wawancara .ics + WhatsApp, laporan, rencana", async ({ page, browser }) => {
  test.setTimeout(240_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  try {
    const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
    let pid = ada?.[0]?.id as string | undefined;
    if (!pid) {
      const { data, error } = await sb.rpc("buat_perusahaan", { p_nama: USAHA, p_industri: "fnb" });
      expect(error).toBeNull();
      pid = data as string;
    }
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    expect((await sb.rpc("pasang_paket", { p_kode: "fnb" })).error).toBeNull();
    const tanda = Date.now().toString(36).toUpperCase();
    const judul = `Barista pagi ${tanda}`;
    const { data: lw, error: el } = await sb.from("lowongan").insert({ perusahaan_id: pid, judul, ringkasan: "Membuat kopi dan melayani tamu.\n\nShift 06.00-14.00." }).select("id, kode").single();
    expect(el).toBeNull();

    await page.goto(`/masuk?next=${encodeURIComponent("/app/rekrutmen")}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/rekrutmen");
    await page.waitForLoadState("networkidle");

    // Rincian lowongan untuk pencarian.
    const r = page.getByRole("form", { name: judul });
    await r.getByLabel("Kota").fill("Denpasar");
    await r.getByLabel("Provinsi").fill("Bali");
    await r.getByLabel("Jenis kerja").selectOption("PART_TIME");
    await r.getByLabel("Gaji dari (Rp)").fill("2.500.000");
    await r.getByLabel("Gaji sampai (Rp)").fill("3.000.000");
    await r.getByLabel("Tampilkan di pencarian kerja").check();
    await r.getByRole("button", { name: "Simpan rincian" }).click();
    await expect(r.getByRole("status")).toHaveText("Rincian lowongan tersimpan.");

    // Pelamar dari tautan Instagram; halaman membawa JobPosting yang lolos uji struktur dan boleh diindeks.
    const tamu = await (await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })).newPage();
    await tamu.goto(`/lamar/${lw!.kode}?src=instagram`);
    const ld = JSON.parse((await tamu.getByTestId("job-posting").textContent())!) as Record<string, unknown>;
    expect(ld).toMatchObject({ "@type": "JobPosting", title: judul, employmentType: "PART_TIME", hiringOrganization: { name: USAHA },
      jobLocation: { address: { addressLocality: "Denpasar", addressRegion: "Bali", addressCountry: "ID" } }, baseSalary: { currency: "IDR", value: { minValue: 2500000, maxValue: 3000000, unitText: "MONTH" } } });
    expect(String(ld.datePosted)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await tamu.locator('meta[name="robots"]').getAttribute("content")).not.toContain("noindex");
    const nama = `Pelamar Rekrut ${tanda}`;
    await tamu.getByLabel("Nama lengkap").fill(nama);
    await tamu.getByLabel("Nomor HP (WhatsApp)").fill(`0813${String(Date.now()).slice(-8)}`);
    await tamu.getByLabel(/CV: foto atau PDF/).setInputFiles({ name: "cv.pdf", mimeType: "application/pdf", buffer: Buffer.concat([readFileSync(CV), Buffer.from(`\n%uji ${nama}\n`)]) });
    await tamu.getByRole("button", { name: "Kirim lamaran" }).click();
    const statusUrl = (await tamu.getByTestId("tautan-status-isi").textContent({ timeout: 60_000 }))!.trim();

    // Pemilik menjadwalkan wawancara besok 10.00.
    await page.reload();
    const besok = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const f = page.getByRole("form", { name: "Jadwal wawancara" });
    await f.getByLabel("Pelamar", { exact: true }).selectOption({ label: `${nama}, ${judul}` });
    await f.getByLabel(/^Tanggal dan jam/).fill(`${besok}T10:00`);
    await f.getByLabel("Lama", { exact: true }).selectOption("45");
    await f.getByLabel("Tempat atau tautan").fill("Kedai Uji, Jl. Teuku Umar 5");
    await f.getByRole("button", { name: "Jadwalkan" }).click();
    await expect(f.getByRole("status")).toContainText("Wawancara dijadwalkan");
    const w = page.getByTestId("wawancara").filter({ hasText: nama });
    await expect(w).toContainText("10.00");
    const wa = await w.getByTestId("undang-wa").getAttribute("href");
    expect(wa).toMatch(/^https:\/\/wa\.me\/62813\d+\?text=/);
    expect(decodeURIComponent(wa!.split("text=")[1])).toContain(`kamu diundang wawancara ${judul} di ${USAHA}`);
    const ics = await isiUnduhan(page, () => w.getByRole("button", { name: "Unduh .ics" }).click());
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
    expect(ics).toContain("LOCATION:Kedai Uji\\, Jl. Teuku Umar 5");
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z\r\nDTEND:\d{8}T\d{6}Z/);

    // Pelamar membuka status: jadwal terlihat dan bisa disimpan ke kalender.
    await tamu.goto(new URL(statusUrl).pathname + new URL(statusUrl).hash);
    await expect(tamu.getByTestId("status-wawancara")).toContainText("Kedai Uji");
    const icsTamu = await isiUnduhan(tamu, () => tamu.getByRole("button", { name: "Simpan ke kalender" }).click());
    expect(icsTamu).toContain(`SUMMARY:Wawancara ${judul}\\, ${USAHA}`);
    await tamu.context().close();

    // Laporan menghitung sumber instagram; rencana kebutuhan orang.
    await page.reload();
    await expect(page.getByTestId("lap-sumber")).toContainText("instagram");
    const mp = page.getByRole("form", { name: /^Rencana kebutuhan orang/ });
    await mp.getByLabel("Topi").selectOption({ index: 1 });
    await mp.getByLabel("Target orang").fill("3");
    await mp.getByLabel("Anggaran gaji per bulan (Rp)").fill("9.000.000");
    await mp.getByRole("button", { name: "Simpan rencana" }).click();
    await expect(mp.getByRole("status")).toHaveText("Rencana tersimpan.");
    await expect(page.getByTestId("tabel-rencana")).toContainText("Rp9.000.000");
    await periksaUi(page, "rekrutmen");
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
