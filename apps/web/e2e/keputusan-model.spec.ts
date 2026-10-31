import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// F1-06B: usulan `catatan` sintetis tanpa aturan di Warung Uji A dirute model sungguhan (trigger -> pg_net -> Edge Function putuskan).
// Isinya jelas urusan pemilik (komitmen sewa), satu-satunya rute yang boleh dipersempit model. Tes menunggu keputusan tingkat model
// tercatat, memeriksa kartu Keputusan otomatis (label "Dirute Nadi ... yakin N%", alasan, tombol batal), membatalkan, memastikan rute
// kembali ke pemilik dan admin, lalu menolak usulan uji lewat putuskan_usulan. Tidak ada yang dihapus.
function envUji(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...envUji(".env.local"), ...envUji(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
});

async function periksaTampilan(page: Page, nama: string) {
  for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
    for (const skema of ["light", "dark"] as const) {
      await page.setViewportSize({ width: lebar, height: tinggi });
      await page.emulateMedia({ colorScheme: skema });
      await page.waitForTimeout(400); // transisi warna 150 ms selesai dulu, axe membaca warna akhir
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), `${nama} ${lebar} ${skema} ${JSON.stringify(axe.violations.map((v) => v.nodes.map((n) => [n.target, n.failureSummary?.slice(0, 160)])))}`).toEqual([]);
      await page.getByTestId("keputusan-otomatis").screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("usulan tanpa aturan dirute model, tampil di kartu Keputusan, dan bisa dibatalkan", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const { data: klaim } = await sb.auth.getClaims();
  const pid = (klaim?.claims.app_metadata as { pid: string }).pid;
  const { data: usaha } = await sb.from("perusahaan").select("nama").eq("id", pid).single();
  expect(usaha?.nama).toBe("Warung Uji A");

  const judul = `Tawaran sewa ruko 3 tahun untuk cabang kedua (uji ${Date.now()})`;
  // diberitahu_at diisi agar pg_cron push tidak mengabari HP pemilik untuk usulan uji.
  const { data: u, error } = await sb.from("usulan").insert({
    perusahaan_id: pid, sumber: "mcp", aksi: "catatan", judul,
    penjelasan: "Pemilik ruko menawarkan kontrak sewa 3 tahun, dibayar di muka per tahun, perlu tanda tangan perjanjian minggu ini. Usulan sintetis untuk uji.",
    payload: { uji: "keputusan-model" }, diberitahu_at: new Date().toISOString(),
  }).select("id").single();
  expect(error).toBeNull();
  const id = u!.id as string;

  try {
    // Model dipanggil di latar (pg_net); tunggu keputusan tingkat model, paling lama 60 detik.
    type K = { id: string; pilihan: string; yakin: number; alasan: string; latensi_ms: number };
    let k: K | null = null;
    await expect.poll(async () => {
      const { data } = await sb.from("keputusan").select("id, pilihan, yakin, alasan, latensi_ms").eq("subjek_id", id).eq("tingkat", "model").maybeSingle();
      k = data as K | null;
      return k?.pilihan ?? null;
    }, { timeout: 60_000, intervals: [1000, 2000] }).not.toBeNull();
    const kp = k as unknown as K;
    expect(kp.pilihan, `model memilih ${kp.pilihan} yakin ${kp.yakin}: ${kp.alasan}`).toBe("pemilik");
    expect(kp.yakin).toBeGreaterThanOrEqual(0.85);
    expect(kp.latensi_ms).toBeGreaterThan(0);
    expect(kp.alasan).toContain(judul.slice(0, 40));
    const { data: dirute } = await sb.from("usulan").select("untuk_peran").eq("id", id).single();
    expect(dirute?.untuk_peran).toEqual(["pemilik"]);

    await page.goto("/masuk?next=/app/perusahaan");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((x) => x.pathname === "/app/perusahaan");

    const kartu = page.getByTestId("keputusan-otomatis");
    await expect(kartu).toContainText("dinilai model");
    const baris = page.locator(`[data-keputusan="${kp.id}"]`);
    await expect(baris.getByTestId("label-model")).toHaveText(`Dirute Nadi ke pemilik saja, yakin ${Math.round(kp.yakin * 100)}%`);
    await expect(baris).toContainText(judul.slice(0, 40));
    await baris.scrollIntoViewIfNeeded();
    await periksaTampilan(page, "keputusan-model");

    await baris.getByRole("button", { name: "Batalkan" }).click();
    await baris.getByLabel("Alasan membatalkan").fill("Admin juga perlu melihat tawaran ini");
    await baris.getByRole("button", { name: "Batalkan keputusan" }).click();
    await expect(page.locator(`[data-keputusan="${kp.id}"]`)).toContainText("Alasan batal: Admin juga perlu melihat tawaran ini");

    const { data: kembali } = await sb.from("usulan").select("untuk_peran").eq("id", id).single();
    expect(kembali?.untuk_peran).toEqual(["pemilik", "admin"]);
    const { data: kb } = await sb.from("keputusan").select("dibatalkan_at").eq("id", kp.id).single();
    expect(kb?.dibatalkan_at).not.toBeNull();
  } finally {
    await sb.rpc("putuskan_usulan", { p_usulan: id, p_setuju: false });
  }
});
