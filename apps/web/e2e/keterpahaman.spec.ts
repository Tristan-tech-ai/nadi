import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// U-08: ukur 5 tugas umum. Metrik: klik navigasi dari halaman pertama setelah masuk sampai layar tugas terbuka, dan jumlah tautan
// yang harus dipindai di setiap titik keputusan. Langkah mengisi formulir tidak dihitung karena tidak berubah oleh rombakan.
// Jalan di HP (390x844) dan desktop (1440x900). Hasil ditulis ke test-results/keterpahaman-<lebar>.json untuk docs/quality/keterpahaman.md.
// Jalur di skrip ini adalah jalur UI saat diukur; setelah rombakan U-01..U-06 jalurnya diganti dan angkanya dibandingkan.
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

type Hasil = { tugas: string; klik: number; pilihanDipindai: number[]; jalur: string[] };

async function pilihan(page: Page) {
  // Tunggu isi halaman (Suspense) selesai mengalir sebelum menghitung.
  await page.waitForLoadState("networkidle");
  await page.locator("main h1").first().waitFor();
  return page.locator("main a[href^='/app'], nav a[href^='/app']").filter({ visible: true }).count();
}

for (const [lebar, tinggi] of [[390, 844], [1440, 900]] as const) {
  test(`keterpahaman ${lebar} px: klik dan pilihan untuk 5 tugas umum`, async ({ page, browser }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: lebar, height: tinggi });
    const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
    const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
    const hasil: Hasil[] = [];
    try {
      const { data: ada } = await sb.from("perusahaan").select("id, kode").eq("nama", USAHA).limit(1);
      const pid = ada?.[0]?.id as string;
      expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
      await sb.auth.refreshSession();
      const tanda = Date.now().toString(36).toUpperCase();
      // Usulan untuk tugas 1.
      await sb.rpc("propose_migration", { p_format: "produk", p_berkas: `ukur-${tanda}.csv`, p_baris: [{ kode: `UK-${tanda}`, nama: `Ukur ${tanda}`, harga_jual: 1000 }] });

      await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
      await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
      await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
      await page.getByRole("button", { name: "Masuk" }).click();
      await page.waitForURL((u) => u.pathname === "/app");
      await page.waitForLoadState("networkidle");

      // 1. Setujui satu usulan: Feed adalah halaman pertama.
      const p1 = [await pilihan(page)];
      await expect(page.locator("article", { hasText: `ukur-${tanda}.csv` }).getByRole("button", { name: "Setujui" })).toBeVisible();
      hasil.push({ tugas: "Setujui satu usulan", klik: 0, pilihanDipindai: p1, jalur: ["/app"] });

      // 2. Buat invoice: Usaha -> Invoice.
      const nav = page.getByRole("navigation", { name: "Navigasi utama" });
      const p2 = [await pilihan(page)];
      await nav.getByRole("link", { name: "Usaha" }).click();
      await page.waitForURL((u) => u.pathname === "/app/perusahaan");
      p2.push(await pilihan(page));
      await page.locator("main").getByRole("link", { name: "Invoice", exact: true }).click();
      await page.waitForURL((u) => u.pathname === "/app/invoice");
      hasil.push({ tugas: "Buat invoice", klik: 2, pilihanDipindai: p2, jalur: ["/app", "/app/perusahaan", "/app/invoice"] });

      // 3. Tambah karyawan: Orang.
      await page.goto("/app");
      const p3 = [await pilihan(page)];
      await nav.getByRole("link", { name: "Orang" }).click();
      await page.waitForURL((u) => u.pathname === "/app/orang");
      hasil.push({ tugas: "Tambah karyawan", klik: 1, pilihanDipindai: p3, jalur: ["/app", "/app/orang"] });

      // 4. Lihat laba bulan ini: Usaha -> Laporan keuangan -> Laba rugi.
      await page.goto("/app");
      const p4 = [await pilihan(page)];
      await nav.getByRole("link", { name: "Usaha" }).click();
      await page.waitForURL((u) => u.pathname === "/app/perusahaan");
      p4.push(await pilihan(page));
      await page.locator("main").getByRole("link", { name: "Laporan keuangan", exact: true }).click();
      await page.waitForURL((u) => u.pathname === "/app/buku");
      p4.push(await pilihan(page));
      await page.locator("main").getByRole("link", { name: "Laba rugi", exact: true }).click();
      await page.waitForURL((u) => u.searchParams.get("jenis") === "laba_rugi");
      hasil.push({ tugas: "Lihat laba bulan ini", klik: 3, pilihanDipindai: p4, jalur: ["/app", "/app/perusahaan", "/app/buku", "/app/buku?jenis=laba_rugi"] });

      // 5. Staf mengajukan izin: Izin.
      const { data: o } = await sb.from("orang").insert({ perusahaan_id: pid, nama: `Staf Ukur ${tanda}` }).select("id").single();
      const pin = String(100000 + Math.floor(Math.random() * 899999));
      expect((await sb.rpc("buat_akun_staf", { p_orang: o!.id, p_pin: pin })).error).toBeNull();
      const { data: os } = await sb.from("orang").select("id_staf").eq("id", o!.id).single();
      const staf = await (await browser.newContext({ viewport: { width: lebar, height: tinggi } })).newPage();
      await staf.goto("/masuk/staf");
      await staf.getByLabel("Kode usaha").fill(ada![0].kode as string);
      await staf.getByLabel("ID kamu").fill(os!.id_staf as string);
      await staf.getByLabel("PIN").fill(pin);
      await staf.getByRole("button", { name: "Masuk" }).click();
      await staf.waitForURL((u) => u.pathname.startsWith("/app"));
      await staf.waitForLoadState("networkidle");
      const p5 = [await pilihan(staf)];
      const awal = new URL(staf.url()).pathname;
      let k5 = 0;
      if (awal !== "/app/izin") {
        await staf.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Izin" }).click();
        await staf.waitForURL((u) => u.pathname === "/app/izin");
        k5 = 1;
      }
      hasil.push({ tugas: "Staf mengajukan izin", klik: k5, pilihanDipindai: p5, jalur: k5 ? [awal, "/app/izin"] : [awal] });
      await staf.context().close();
      await sb.from("orang").update({ status: "nonaktif" }).eq("id", o!.id);
    } finally {
      writeFileSync(test.info().outputPath(`keterpahaman-${lebar}.json`), JSON.stringify(hasil, null, 2));
      console.log(`KETERPAHAMAN_${lebar}`, JSON.stringify(hasil));
      if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
    }
  });
}
