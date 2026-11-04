import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hitungThr } from "../src/lib/gaji/thr";

// M-10: pemilik (akun A) menghitung THR 3 karyawan (masa kerja >= 12 bulan, 8 bulan, < 1 bulan) untuk Hari Raya setahun lagi,
// angka di layar sama dengan rumus Permenaker 6/2016, lalu THR diajukan ke Feed. Orang uji dinonaktifkan di akhir.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const geser = (iso: string, bulan: number, hari = 0) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + bulan);
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
};

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("THR 3 karyawan: angka sama dengan Permenaker 6/2016 Pasal 3, diajukan ke Feed", async ({ page }) => {
  test.setTimeout(120_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const masuk = await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI });
  expect(masuk.error).toBeNull();
  const pid = (masuk.data.session!.user.app_metadata as { pid: string }).pid;
  const hariRaya = geser(new Date().toISOString().slice(0, 10), 12);
  const data = [
    { nama: `THR Lama ${tanda}`, mulai: geser(hariRaya, -30), pokok: 3_200_000, tunjangan: 400_000 },
    { nama: `THR Delapan ${tanda}`, mulai: geser(hariRaya, -8), pokok: 3_000_000, tunjangan: 0 },
    { nama: `THR Baru ${tanda}`, mulai: geser(hariRaya, 0, -10), pokok: 2_900_000, tunjangan: 0 },
  ];
  const id: string[] = [];
  for (const o of data) {
    const r = await sb.from("orang").insert({ perusahaan_id: pid, nama: o.nama, data: { mulai: o.mulai } }).select("id").single();
    expect(r.error).toBeNull();
    id.push(r.data!.id as string);
    expect((await sb.from("orang_rahasia").upsert({ orang_id: r.data!.id, perusahaan_id: pid, gaji: { pokok: o.pokok, tunjangan_tetap: o.tunjangan } }, { onConflict: "orang_id" })).error).toBeNull();
  }

  try {
    await page.goto(`/masuk?next=${encodeURIComponent(`/app/gaji/thr?hari=${hariRaya}`)}`);
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app/gaji/thr");
    const tabel = page.getByTestId("tabel-thr");
    for (const o of data) {
      const h = hitungThr({ mulai: o.mulai, hariRaya, pokok: o.pokok, tunjanganTetap: o.tunjangan });
      const baris = tabel.locator(`tr[data-orang="${o.nama}"]`);
      if (h.thr > 0) await expect(baris).toContainText(`Rp${h.thr.toLocaleString("id-ID")}`);
      else await expect(baris).toContainText("masa kerja kurang dari 1 bulan");
    }
    // Pasal 3: 30 bulan = 1 bulan upah (3.600.000), 8 bulan = 2.000.000, < 1 bulan = 0.
    await expect(tabel.locator(`tr[data-orang="${data[0].nama}"]`)).toContainText("Rp3.600.000");
    await expect(tabel.locator(`tr[data-orang="${data[1].nama}"]`)).toContainText("Rp2.000.000");
    for (const [w, hgt] of [[390, 844], [1440, 900]]) {
      await page.setViewportSize({ width: w, height: hgt });
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    }
    await page.getByRole("button", { name: "Ajukan THR ke Feed" }).click();
    await expect(page.getByRole("status")).toContainText("diajukan");
    const { data: u } = await sb.from("usulan").select("judul, dampak_rp, payload").eq("aksi", "uang.thr").order("dibuat_at", { ascending: false }).limit(1).single();
    const baris = (u!.payload as { baris: { nama: string; thr: number }[] }).baris;
    expect(baris.find((b) => b.nama === data[0].nama)?.thr).toBe(3_600_000);
    expect(baris.find((b) => b.nama === data[1].nama)?.thr).toBe(2_000_000);
    expect(baris.some((b) => b.nama === data[2].nama)).toBe(false);
  } finally {
    await sb.from("orang").update({ status: "nonaktif" }).in("id", id);
  }
});
