import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-03: tiga staf sintetis di Warung Uji A dengan kerja selesai minggu ini (satu lewat tenggat, satu tepat, satu lintas topi).
// Staf melihat "Kerjamu minggu ini" dengan penjelasan yang menyebut judul kerja nyata dan tanpa nama rekan; menandai satu kerja
// keliru menjadi usulan untuk pemilik yang muncul di Feed; pemilik melihat tabel buku kas dan mengetuk orang ke cerminnya.
// Pola pembuatan data sama dengan bagi-adil.spec. Bersih tanpa penghapusan: usulan banding ditolak, staf dan topi dinonaktifkan.
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

test("kpi: cermin staf dengan penjelasan dari kerja nyata, tanpa nama rekan; banding ke Feed pemilik; tabel pemilik", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pid = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  expect(pid).toBeTruthy();
  const { data: usaha } = await sb.from("perusahaan").select("nama, kode").eq("id", pid!).single();
  expect(usaha?.nama, "usaha aktif akun A harus Warung Uji A").toBe("Warung Uji A");

  const jejak = String(Date.now()).slice(-6);
  const { data: t, error: et } = await sb.from("topi").insert({ perusahaan_id: pid, kode: `kasir_kpi_${jejak}`, nama: `Kasir KPI ${jejak}` }).select("id").single();
  expect(et).toBeNull();
  const { data: t2, error: et2 } = await sb.from("topi").insert({ perusahaan_id: pid, kode: `cuci_kpi_${jejak}`, nama: `Pencuci KPI ${jejak}` }).select("id").single();
  expect(et2).toBeNull();
  const idTopi = t!.id as string;
  const idCuci = t2!.id as string;
  const nama = { saya: `Sari KPI ${jejak}`, rekan1: `Budi KPI ${jejak}`, rekan2: `Dewi KPI ${jejak}` };
  const id: Record<keyof typeof nama, string> = { saya: "", rekan1: "", rekan2: "" };
  const judul = { lewat: `Cek stok beras ${jejak}`, tepat: `Setor kas ${jejak}`, lintas: `Cuci gelas ${jejak}`, rekan: `Rekap rekan ${jejak}` };
  const kerjaId: Record<string, string> = {};
  const pin = "246813";
  let idUsulan: string | null = null;

  try {
    for (const k of Object.keys(nama) as (keyof typeof nama)[]) {
      const { data: o, error: eo } = await sb.from("orang").insert({ perusahaan_id: pid, nama: nama[k], data: {} }).select("id").single();
      expect(eo).toBeNull();
      id[k] = o!.id as string;
      expect((await sb.from("pakai_topi").insert({ perusahaan_id: pid, orang_id: id[k], topi_id: idTopi })).error).toBeNull();
    }
    // Sari: lewat tenggat (tenggat 1 jam lalu), tepat tenggat (tenggat besok), lintas topi (topi pencuci yang tidak ia pakai).
    const jam = 60 * 60 * 1000;
    const rencana: [string, keyof typeof nama, string, string | null, number][] = [
      ["lewat", "saya", idTopi, new Date(Date.now() - jam).toISOString(), 2],
      ["tepat", "saya", idTopi, new Date(Date.now() + 24 * jam).toISOString(), 3],
      ["lintas", "saya", idCuci, null, 1],
      ["rekan", "rekan1", idTopi, null, 2],
      ["rekan2", "rekan2", idTopi, null, 1],
    ];
    for (const [kunci, siapa, topi, tenggat, poin] of rencana) {
      const j = kunci === "rekan2" ? `Rekap rekan dua ${jejak}` : judul[kunci as keyof typeof judul];
      const { data: r, error: eb } = await sb.rpc("buat_kerja", { p_judul: j, p_topi: topi, p_pelaksana: id[siapa], p_tenggat: tenggat });
      expect(eb, j).toBeNull();
      const idKerja = (r as { id: string }).id;
      kerjaId[kunci] = idKerja;
      expect((await sb.rpc("simpan_estimasi_kerja", { p_kerja: idKerja, p_menit: poin * 15, p_sumber: "manual", p_alasan: "Data uji KPI" })).error).toBeNull();
      expect((await sb.rpc("ubah_status_kerja", { p_kerja: idKerja, p_aksi: "selesai" })).error).toBeNull();
    }
    expect((await sb.rpc("buat_akun_staf", { p_orang: id.saya, p_pin: pin })).error).toBeNull();
    const { data: s } = await sb.from("orang").select("id_staf").eq("id", id.saya).single();
    const idStaf = s!.id_staf as string;

    // Database langsung: setiap ukuran Sari membawa id kerja nyata.
    const { data: km } = await sb.rpc("kpi_minggu", { p_mulai: null });
    const baris = (km as { orang: { id: string; poin_selesai: { nilai: number; ids: string[] }; tepat: { nilai: number; dari: number }; lintas: { ids: string[] } }[] }).orang.find((o) => o.id === id.saya)!;
    expect(baris.poin_selesai).toMatchObject({ nilai: 6 });
    expect(baris.poin_selesai.ids.sort()).toEqual([kerjaId.lewat, kerjaId.tepat, kerjaId.lintas].sort());
    expect(baris.tepat).toMatchObject({ nilai: 1, dari: 2 });
    expect(baris.lintas.ids).toEqual([kerjaId.lintas]);

    // Staf: cermin miliknya sendiri.
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
    await staf.getByRole("navigation", { name: "Bagian kerja" }).getByRole("link", { name: "Kerjamu minggu ini" }).click();
    await staf.waitForURL((x) => x.searchParams.get("tab") === "kpi");
    const cermin = staf.getByTestId("cermin-kpi");
    await expect(cermin.getByRole("heading", { name: "Kerjamu minggu ini" })).toBeVisible();
    const ukuran = (k: string) => cermin.locator(`[data-testid="ukuran-kpi"][data-kunci="${k}"]`);
    await expect(ukuran("poin").getByTestId("angka-kpi")).toHaveText("6 poin");
    await expect(ukuran("poin").getByTestId("penjelasan-kpi")).toHaveText(`6 poin dari 3 kerja selesai: ${judul.tepat} (3 poin), ${judul.lewat} (2 poin), ${judul.lintas} (1 poin).`);
    await expect(ukuran("tepat").getByTestId("angka-kpi")).toHaveText("1 dari 2");
    await expect(ukuran("tepat").getByTestId("penjelasan-kpi")).toHaveText(new RegExp(`^Tepat tenggat 1 dari 2\\. Satu yang lewat: ${judul.lewat} \\((Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu), lewat 1 jam( \\d+ menit)?\\)\\.$`));
    await expect(ukuran("lintas").getByTestId("penjelasan-kpi")).toContainText(`kerja lintas topi: ${judul.lintas}. Dihitung sebagai bantuan`);
    await expect(ukuran("hadir").getByTestId("penjelasan-kpi")).toHaveText("Hadir sesuai jadwal muncul setelah jadwal shift diisi.");
    await expect(ukuran("poin").getByTestId("banding-minggu")).toHaveText("belum cukup kerja untuk dibandingkan");
    expect(await ukuran("poin").getAttribute("data-ids")).toContain(kerjaId.lewat);
    await ukuran("tepat").getByText("lihat rinciannya").click();
    await expect(ukuran("tepat").getByTestId("rincian-kerja")).toHaveCount(2);
    const isiStaf = await staf.locator("body").innerText();
    expect(isiStaf).not.toContain(nama.rekan1);
    expect(isiStaf).not.toContain(nama.rekan2);
    expect(isiStaf).not.toContain(judul.rekan);
    await axeDanFoto(staf, "kpi-staf");

    // Banding: tandai kerja yang lewat, pemilik akan melihat.
    await staf.getByRole("button", { name: "Tandai kerja yang keliru" }).click();
    const form = staf.getByRole("form", { name: "Tandai kerja yang keliru" });
    await form.getByLabel("Kerja").selectOption({ value: kerjaId.lewat });
    await form.getByLabel("Apa yang keliru?").fill("Tenggatnya diundur pemilik tadi pagi");
    await axeDanFoto(staf, "kpi-banding");
    await form.getByRole("button", { name: "Kirim ke pemilik" }).click();
    await expect(staf.getByTestId("hasil-banding")).toHaveText("Terkirim ke pemilik. Pemilik akan melihat tandamu di Feed.", { timeout: 20_000 });
    await staf.reload();
    await ukuran("tepat").getByText("lihat rinciannya").click();
    await expect(ukuran("tepat").locator(`[data-testid="rincian-kerja"][data-id="${kerjaId.lewat}"]`).getByTestId("status-banding")).toHaveText("Sudah ditandai keliru, menunggu pemilik.");
    await konteksStaf.close();

    const { data: u } = await sb.from("usulan").select("id, aksi, judul, status, untuk_peran, payload").eq("aksi", "kpi.banding").eq("payload->>kerja_id", kerjaId.lewat);
    expect(u).toHaveLength(1);
    idUsulan = u![0].id as string;
    expect(u![0]).toMatchObject({ status: "menunggu", untuk_peran: ["pemilik"], payload: { kerja_id: kerjaId.lewat, alasan: "Tenggatnya diundur pemilik tadi pagi" } });
    const judulUsulan = `Tinjau hitungan kerja ${nama.saya}: ${judul.lewat}`;
    expect(u![0].judul).toBe(judulUsulan);

    // Pemilik: usulan banding di Feed (jenis Lainnya, terbaru di atas).
    await page.goto("/masuk?next=/app");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((x) => x.pathname === "/app");
    await page.goto("/app?jenis=lainnya&urut=terbaru");
    await expect(page.getByText(judulUsulan)).toBeVisible();
    await expect(page.getByText("Dari karyawan").first()).toBeVisible();

    // Pemilik: tabel kinerja, ketuk orang ke cerminnya.
    await page.goto("/app/kerja");
    await page.getByRole("navigation", { name: "Bagian kerja" }).getByRole("link", { name: "Kinerja minggu ini" }).click();
    await page.waitForURL((x) => x.searchParams.get("tab") === "kpi");
    const barisSaya = page.locator(`[data-testid="baris-kpi"][data-nama="${nama.saya}"]`);
    await expect(barisSaya.getByTestId("kpi-poin")).toContainText("6 poin");
    await expect(barisSaya.getByTestId("kpi-tepat")).toContainText("1 dari 2");
    await expect(page.locator(`[data-testid="baris-kpi"][data-nama="${nama.rekan1}"]`).getByTestId("kpi-poin")).toContainText("2 poin");
    await axeDanFoto(page, "kpi-pemilik");
    await barisSaya.getByRole("link").click();
    await page.waitForURL((x) => x.searchParams.get("orang") === id.saya);
    await expect(page.getByRole("heading", { name: `Kerja ${nama.saya} minggu ini` })).toBeVisible();
    await expect(page.getByTestId("banding-kpi")).toHaveCount(0);
    await page.locator('[data-testid="ukuran-kpi"][data-kunci="tepat"]').getByText("lihat rinciannya").click();
    await axeDanFoto(page, "kpi-pemilik-cermin");
  } finally {
    if (idUsulan) await sb.rpc("putuskan_usulan", { p_usulan: idUsulan, p_setuju: false });
    for (const o of Object.values(id)) if (o) await sb.from("orang").update({ status: "nonaktif" }).eq("id", o);
    await sb.from("topi").update({ aktif: false }).in("id", [idTopi, idCuci]);
  }
});
