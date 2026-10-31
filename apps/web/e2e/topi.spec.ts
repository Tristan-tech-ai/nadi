import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F1-01: impor 30 karyawan dari xlsx korpus lewat Lempar Saja -> semua masuk dengan topi; kerja lintas topi tertanda otomatis.
// Memakai usaha khusus "Uji Topi E2E" milik akun uji A (dibuat sekali), lalu usaha aktif dikembalikan seperti semula.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "excel_karyawan");
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const NAMA_USAHA = "Uji Topi E2E";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(!info.project.name.startsWith("pindah-") || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (proyek pindah-*, desktop), butuh .env.local dan .env.e2e.local");
});

test("impor 30 karyawan dari Excel: semua bertopi, kerja lintas topi tertanda, tampil di halaman Orang", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;

  try {
    // Usaha khusus uji, paket F&B.
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
    await sb.rpc("pasang_paket", { p_kode: "fnb" });

    // Lempar xlsx korpus; bila sudah pernah dilempar di usaha ini, berkas lama dipakai (impor ulang aman).
    const isi = readFileSync(join(KORPUS, "karyawan-30.xlsx"));
    const sha = createHash("sha256").update(isi).digest("hex");
    const { data: d, error: e1 } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: "karyawan-30.xlsx", p_mime: XLSX, p_ukuran: isi.length });
    expect(e1).toBeNull();
    if (d.status === "unggah") {
      expect((await sb.storage.from("berkas").upload(d.jalur, isi, { contentType: XLSX })).error).toBeNull();
      await sb.functions.invoke("baca-berkas", { body: { berkas_id: d.id } });
    }
    const { data: usulan } = await sb.from("usulan").select("id, aksi, status").eq("berkas_id", d.id);
    expect(usulan?.[0]?.aksi).toBe("orang.impor");
    for (const u of usulan ?? []) if (u.status === "menunggu") expect((await sb.rpc("putuskan_usulan", { p_usulan: u.id, p_setuju: true })).error).toBeNull();

    // Semua 30 nama ada dan memakai topi; porsi tiap orang 100%.
    const benar = JSON.parse(readFileSync(join(KORPUS, "karyawan-30.json"), "utf8")).bidang.baris as { nama: string; jabatan: string }[];
    const { data: orang } = await sb.from("orang").select("id, nama, pakai_topi(porsi, topi(kode))").eq("perusahaan_id", pid);
    const perNama = new Map((orang ?? []).map((o) => [o.nama.toLowerCase(), o]));
    const tanpaTopi = benar.filter((b) => !(perNama.get(b.nama.toLowerCase())?.pakai_topi ?? []).length).map((b) => b.nama);
    expect(tanpaTopi).toEqual([]);
    for (const b of benar) {
      const porsi = (perNama.get(b.nama.toLowerCase())!.pakai_topi as { porsi: number }[]).reduce((s, p) => s + Number(p.porsi), 0);
      expect(porsi, b.nama).toBe(100);
    }

    // Kerja lintas topi: tugas koki dikerjakan seorang kasir.
    const kasir = benar.find((b) => b.jabatan === "Kasir")!;
    const { data: topiKoki } = await sb.from("topi").select("id").eq("perusahaan_id", pid).eq("kode", "koki").single();
    const { data: kerja, error: e2 } = await sb.from("kerja").insert({ perusahaan_id: pid, judul: "Ganti juru masak sejam", topi_id: topiKoki!.id, pelaksana_id: perNama.get(kasir.nama.toLowerCase())!.id }).select("lintas_topi").single();
    expect(e2).toBeNull();
    expect(kerja!.lintas_topi).toBe(true);

    // Layar Orang menampilkan topi (usaha aktif akun A sekarang usaha uji ini).
    await page.goto("/masuk?next=/app/orang");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL(/\/app\/orang/);
    await expect(page.getByTestId("topi-orang").first()).toBeVisible();
    expect(await page.getByTestId("topi-orang").count()).toBeGreaterThanOrEqual(30);
    await expect(page.getByTestId("topi-orang").first()).toContainText("%");
    for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: lebar, height: tinggi });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(400);
        const axe = await new AxeBuilder({ page }).analyze();
        expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${lebar} ${skema}`).toEqual([]);
        await page.screenshot({ path: test.info().outputPath(`orang-${lebar}-${skema}.png`) });
      }
    }
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
