import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F3-05 Kolam Bonus Beban: di usaha uji sendiri "Uji Kolam E2E" milik akun A, tiga orang sintetis dengan kerja selesai bulan
// berjalan (5 kerja, 3 poin masing-masing). Pemilik mengisi Rp1.000.000, melihat pratinjau buku kas (333.334 + 333.333 +
// 333.333), mengunduh CSV, mengecualikan satu orang dengan alasan (sisa 4 kerja: ambang menolak) lalu mengikutkannya lagi,
// menyetujui; staf melihat bagiannya
// sendiri di cermin kinerja. Kerja dibuat lewat RPC biasa, jadi selesai_at = sekarang: bulan uji adalah bulan berjalan di zona
// usaha. Orang dari jalan sebelumnya dinonaktifkan supaya tidak ikut dihitung. Bersih tanpa penghapusan: kolam dibatalkan lewat
// batal_kolam, orang dinonaktifkan, usaha aktif dikembalikan.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const NAMA_USAHA = "Uji Kolam E2E";
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "pindah-kolam" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (proyek pindah-kolam, desktop), butuh .env.local dan .env.e2e.local");
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

test("kolam bonus: pratinjau sisa terbesar, CSV, kecualikan, setujui pemilik, staf melihat bagiannya", async ({ page, browser }) => {
  test.setTimeout(300_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  let pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  // Jalan sebelumnya yang terhenti (batas waktu) bisa meninggalkan usaha uji ini aktif: kembalikan ke usaha utama akun A.
  const { data: utama } = await sb.from("perusahaan").select("id, nama").in("nama", [NAMA_USAHA, "Warung Uji A"]);
  if (utama?.find((u) => u.id === pidAwal)?.nama === NAMA_USAHA) pidAwal = utama.find((u) => u.nama === "Warung Uji A")?.id as string | undefined;
  const id: Record<string, string> = {};
  let bulan = "";
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
    const { data: usaha } = await sb.from("perusahaan").select("kode, zona_waktu").eq("id", pid!).single();
    bulan = new Intl.DateTimeFormat("en-CA", { timeZone: usaha!.zona_waktu as string, year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
    // Sisa jalan sebelumnya: orang aktif dinonaktifkan, kolam bulan ini yang masih disetujui dibatalkan (bukan dihapus).
    await sb.from("orang").update({ status: "nonaktif" }).eq("perusahaan_id", pid!).eq("status", "aktif");
    const { data: lama } = await sb.from("kolam_bonus").select("id").eq("bulan", `${bulan}-01`).eq("status", "disetujui");
    for (const k of lama ?? []) expect((await sb.rpc("batal_kolam", { p_kolam: k.id, p_alasan: "Bersih jalan uji sebelumnya" })).error).toBeNull();

    const jejak = String(Date.now()).slice(-6);
    const nama = { sari: `Sari Kolam ${jejak}`, budi: `Budi Kolam ${jejak}`, dewi: `Dewi Kolam ${jejak}` };
    for (const [k, n] of Object.entries(nama)) {
      const { data: o, error } = await sb.from("orang").insert({ perusahaan_id: pid, nama: n, data: {} }).select("id").single();
      expect(error).toBeNull();
      id[k] = o!.id as string;
    }
    const rencana: [keyof typeof nama, string, number][] = [
      ["sari", `Buka kas ${jejak}`, 2], ["sari", `Setor bank ${jejak}`, 1],
      ["budi", `Cek stok ${jejak}`, 1], ["budi", `Rekap pemasok ${jejak}`, 2],
      ["dewi", `Inventaris dapur ${jejak}`, 3],
    ];
    for (const [siapa, judul, poin] of rencana) {
      const { data: r, error } = await sb.rpc("buat_kerja", { p_judul: judul, p_topi: null, p_pelaksana: id[siapa], p_tenggat: null });
      expect(error, judul).toBeNull();
      const idKerja = (r as { id: string }).id;
      expect((await sb.rpc("simpan_estimasi_kerja", { p_kerja: idKerja, p_menit: poin * 15, p_sumber: "manual", p_alasan: "Data uji kolam" })).error).toBeNull();
      expect((await sb.rpc("ubah_status_kerja", { p_kerja: idKerja, p_aksi: "selesai" })).error).toBeNull();
    }
    const pin = "975318";
    expect((await sb.rpc("buat_akun_staf", { p_orang: id.sari, p_pin: pin })).error).toBeNull();
    const { data: s } = await sb.from("orang").select("id_staf").eq("id", id.sari).single();

    // Database langsung: pratinjau persis.
    const { data: h, error: eh } = await sb.rpc("hitung_kolam", { p_bulan: `${bulan}-01`, p_jumlah: 1_000_000, p_dikecualikan: [] });
    expect(eh).toBeNull();
    const hb = (h as { cukup: boolean; bagian: { orang_id: string; rupiah: number }[] });
    expect(hb.cukup).toBe(true);
    expect(hb.bagian.map((b) => b.rupiah).sort()).toEqual([333_333, 333_333, 333_334]);
    const terkecil = [id.sari, id.budi, id.dewi].sort()[0];
    expect(hb.bagian.find((b) => b.orang_id === terkecil)?.rupiah).toBe(333_334);

    // Pemilik.
    await page.goto("/masuk?next=/app/kerja");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((x) => x.pathname === "/app/kerja");
    await page.getByRole("navigation", { name: "Bagian kerja" }).getByRole("link", { name: "Kolam bonus" }).click();
    await page.waitForURL((x) => x.searchParams.get("tab") === "bonus");
    await expect(page.getByTestId("kolam-kosong")).toBeVisible();
    await expect(page.getByTestId("keterangan-insentif")).toContainText("Dicatat sebagai insentif, bukan bonus.");
    await axeDanFoto(page, "kolam-kosong");

    const isian = page.getByRole("form", { name: "Isian kolam bonus" });
    await expect(isian.getByLabel("Bulan kerja")).toHaveValue(bulan);
    await isian.getByLabel("Jumlah kolam (Rp)").fill("1.000.000");
    await isian.getByRole("button", { name: "Lihat pembagian" }).click();
    // Formulir GET membawa ketikan apa adanya ("1.000.000"); halaman membacanya lewat rupiahIsian.
    await page.waitForURL((x) => x.searchParams.get("jumlah") === "1.000.000");
    const pratinjau = page.getByTestId("pratinjau-kolam");
    await expect(pratinjau.getByTestId("baris-kolam")).toHaveCount(3);
    const baris = (n: string) => pratinjau.locator(`[data-testid="baris-kolam"][data-nama="${n}"]`);
    await expect(baris(nama.sari).getByTestId("alasan-kolam")).toHaveText(`${nama.sari}: 3 poin dari 2 kerja, 33,3% kolam`);
    await expect(baris(nama.dewi).getByTestId("alasan-kolam")).toHaveText(`${nama.dewi}: 3 poin dari 1 kerja, 33,3% kolam`);
    const namaTerkecil = Object.entries(nama).find(([k]) => id[k] === terkecil)![1];
    await expect(baris(namaTerkecil)).toHaveAttribute("data-rupiah", "333334");
    await expect(baris(namaTerkecil)).toContainText("Rp333.334");
    await expect(pratinjau.getByTestId("jumlah-kolam")).toContainText("Rp1.000.000");
    await expect(page.getByRole("button", { name: "Setujui pembagian" })).toHaveCount(1);
    await expect(page.locator("button.bg-tinta")).toHaveCount(1);
    await axeDanFoto(page, "kolam-pratinjau");

    // CSV.
    const [unduh] = await Promise.all([page.waitForEvent("download"), page.getByTestId("unduh-csv-kolam").click()]);
    expect(unduh.suggestedFilename()).toBe(`kolam-insentif-beban-${bulan}.csv`);
    const csv = readFileSync((await unduh.path())!, "utf8").replace(/^﻿/, "").split("\r\n");
    expect(csv[0]).toBe("orang,id_staf,poin,persen,rupiah,sumber");
    expect(csv).toHaveLength(4);
    expect(csv.find((l) => l.startsWith(nama.sari))).toMatch(new RegExp(`^${nama.sari},${s!.id_staf},3,33\\.3,33333[34],Insentif beban kerja .+: 2 kerja selesai \\(PP 36/2021 Pasal 8 dan 10\\)$`));

    // Kecualikan Dewi dengan alasan, lalu ikutkan lagi.
    await baris(nama.dewi).getByText(`Kecualikan ${nama.dewi}`).click();
    const fk = page.getByRole("form", { name: `Kecualikan ${nama.dewi}` });
    await fk.getByLabel("Alasan tertulis").fill("Cuti panjang bulan ini");
    await fk.getByRole("button", { name: "Kecualikan dan hitung ulang" }).click();
    await expect(page.getByTestId("kolam-dikecualikan")).toContainText(`${nama.dewi}: Cuti panjang bulan ini.`);
    // Tanpa Dewi tinggal 4 kerja berpoin: di bawah ambang 5, kolam tidak dibagi dan tombol setujui tidak muncul.
    await expect(page.getByTestId("kolam-belum-cukup")).toContainText("Belum cukup kerja tercatat untuk membagi kolam dengan adil: baru 4 kerja berpoin");
    await expect(pratinjau.getByTestId("baris-kolam")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Setujui pembagian" })).toHaveCount(0);
    await axeDanFoto(page, "kolam-belum-cukup");
    await page.getByTestId("kolam-dikecualikan").getByRole("link", { name: "Ikutkan lagi" }).click();
    await expect(pratinjau.getByTestId("baris-kolam")).toHaveCount(3);

    // Setujui.
    await page.getByRole("button", { name: "Setujui pembagian" }).click();
    await expect(page.getByTestId("kolam-disetujui")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("kolam-disetujui").getByTestId("baris-kolam")).toHaveCount(3);
    await expect(page.getByTestId("kolam-disetujui").getByTestId("jumlah-kolam")).toContainText("Rp1.000.000");
    const { data: kb } = await sb.from("kolam_bonus").select("id, jumlah, kolam_bagian(rupiah)").eq("bulan", `${bulan}-01`).eq("status", "disetujui").single();
    expect(kb!.jumlah).toBe(1_000_000);
    expect((kb!.kolam_bagian as { rupiah: number }[]).reduce((t, b) => t + Number(b.rupiah), 0)).toBe(1_000_000);
    await axeDanFoto(page, "kolam-disetujui");

    // Staf: bagiannya sendiri di cermin kinerja.
    const konteksStaf = await browser.newContext({ locale: "id-ID", timezoneId: "Asia/Jakarta" });
    const staf = await konteksStaf.newPage();
    await staf.goto("/masuk/staf");
    await staf.getByLabel("Kode usaha").fill(usaha!.kode as string);
    await staf.getByLabel("ID kamu").fill(s!.id_staf as string);
    await staf.getByLabel("PIN").fill(pin);
    await staf.getByRole("button", { name: "Masuk" }).click();
    await expect(staf.getByTestId("peran")).toContainText("staf");
    await staf.goto("/app/kerja?tab=kpi");
    const saya = staf.getByTestId("insentif-saya");
    await expect(saya).toContainText(id.sari === terkecil ? "Rp333.334" : "Rp333.333");
    await expect(saya).toContainText("(3 poin dari 2 kerja selesai)");
    const isiStaf = await staf.locator("body").innerText();
    expect(isiStaf).not.toContain(nama.budi);
    expect(isiStaf).not.toContain(nama.dewi);
    expect(isiStaf).not.toContain("Rp1.000.000");
    await expect(staf.getByRole("link", { name: "Kolam bonus" })).toHaveCount(0);
    await axeDanFoto(staf, "kolam-staf");
    await konteksStaf.close();
  } finally {
    if (bulan) {
      const { data: k } = await sb.from("kolam_bonus").select("id").eq("bulan", `${bulan}-01`).eq("status", "disetujui");
      for (const x of k ?? []) await sb.rpc("batal_kolam", { p_kolam: x.id, p_alasan: "Bersih setelah uji e2e" });
    }
    for (const o of Object.values(id)) await sb.from("orang").update({ status: "nonaktif" }).eq("id", o);
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
