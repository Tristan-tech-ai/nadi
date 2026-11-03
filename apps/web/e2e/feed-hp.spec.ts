import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { tolakUsulanLama } from "./bersih";

// D-12: pemilik menyetujui 5 usulan dengan satu tangan di HP 390 px dalam < 30 dtk. Jempol hanya menjangkau 60% bawah layar
// (zona jempol); setiap kali tombol Setujui berikutnya di luar zona itu, "pengguna" harus menggulir dan jaraknya dijumlah.
// Klik memakai koordinat (tanpa gulir otomatis Playwright). Hasil dicetak sebagai baris UKUR untuk banding sebelum/sesudah.
function envUji(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...envUji(".env.local"), ...envUji(".env.e2e.local") };
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));
const TINGGI = 844;
const ZONA_ATAS = TINGGI * 0.4;
const ZONA_BAWAH = TINGGI - 24;

test("setujui 5 usulan dengan satu tangan di 390 px dalam < 30 dtk", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(120_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  await tolakUsulanLama(sb, 0);
  const { data: klaim } = await sb.auth.getClaims();
  const pid = (klaim?.claims.app_metadata as { pid: string }).pid;
  const tanda = `Uji Feed HP ${Date.now()}`;
  const baris = Array.from({ length: 5 }, (_, k) => ({
    perusahaan_id: pid, sumber: "aturan", aksi: "berkas.tinjau", judul: `${tanda} #${k + 1}`,
    penjelasan: "Usulan sintetis untuk mengukur persetujuan satu tangan. Disetujui oleh uji.", payload: { uji: "feed-hp", bidang: { uji: "feed-hp" } },
    tenggat: new Date(Date.now() + (k + 1) * 60_000).toISOString(), diberitahu_at: new Date().toISOString(),
  }));
  const { data: dibuat, error } = await sb.from("usulan").insert(baris).select("id");
  expect(error).toBeNull();
  const ids = (dibuat ?? []).map((d) => d.id as string);

  await page.setViewportSize({ width: 390, height: TINGGI });
  await page.goto("/masuk?next=/app");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  await expect(page.locator("article", { hasText: `${tanda} #1` })).toBeVisible();
  await page.screenshot({ path: foto("feed-hp-awal.png") });

  let gulir = 0;
  const yKlik: number[] = [];
  const mulai = Date.now();
  for (let k = 1; k <= 5; k++) {
    const kartu = page.locator("article", { hasText: `${tanda} #${k}` });
    const tombol = kartu.getByRole("button", { name: "Setujui" });
    await expect(tombol).toBeVisible();
    // Setelah keputusan sebelumnya, Nadi menggeser halaman lalu memfokuskan tombol Setujui berikutnya; tunggu itu selesai.
    if (k > 1 && process.env.FEED_LAMA !== "1") await expect(tombol).toBeFocused();
    let kotak = (await tombol.boundingBox())!;
    if (kotak.y < ZONA_ATAS || kotak.y + kotak.height > ZONA_BAWAH) {
      // Pengguna menggulir sampai tombol berada di tengah zona jempol.
      const sasaran = (ZONA_ATAS + ZONA_BAWAH) / 2 - kotak.height / 2;
      const d = kotak.y - sasaran;
      await page.evaluate((x) => window.scrollBy({ top: x, behavior: "instant" }), d);
      gulir += Math.abs(d);
      kotak = (await tombol.boundingBox())!;
    }
    yKlik.push(Math.round(kotak.y));
    await page.mouse.click(kotak.x + kotak.width / 2, kotak.y + kotak.height / 2);
    await expect(kartu.getByTestId("hasil-putusan")).toBeVisible();
    if (k === 1) await page.screenshot({ path: foto("feed-hp-setelah-1.png") });
  }
  const detik = (Date.now() - mulai) / 1000;
  console.log(`UKUR feed-hp: ${detik.toFixed(1)} dtk, gulir pengguna ${Math.round(gulir)} px, y tombol ${yKlik.join(",")}`);
  expect(detik).toBeLessThan(30);

  // Semua benar-benar tersimpan setelah jendela Batalkan habis.
  await expect.poll(async () => {
    const { data } = await sb.from("usulan").select("status").in("id", ids);
    return (data ?? []).filter((u) => u.status === "diterima").length;
  }, { timeout: 20_000 }).toBe(5);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await page.screenshot({ path: foto("feed-hp-akhir.png") });
});

test("batalkan dalam jendela: usulan tetap menunggu", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI, "sekali (desktop), butuh .env.e2e.local");
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const { data: klaim } = await sb.auth.getClaims();
  const pid = (klaim?.claims.app_metadata as { pid: string }).pid;
  const judul = `Uji Batalkan ${Date.now()}`;
  const { data: u } = await sb.from("usulan").insert({ perusahaan_id: pid, sumber: "aturan", aksi: "berkas.tinjau", judul, penjelasan: "Sintetis.", payload: { uji: "feed-hp", bidang: { uji: "feed-hp" } }, tenggat: new Date(Date.now() + 30_000).toISOString(), diberitahu_at: new Date().toISOString() }).select("id").single();
  await page.setViewportSize({ width: 390, height: TINGGI });
  await page.goto("/masuk?next=/app");
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((x) => x.pathname === "/app");
  const kartu = page.locator("article", { hasText: judul });
  await kartu.getByRole("button", { name: "Setujui" }).click();
  await kartu.getByTestId("batalkan-putusan").click();
  await expect(page.locator("article", { hasText: judul }).getByRole("button", { name: "Setujui" })).toBeVisible();
  await page.waitForTimeout(5000);
  const { data: s } = await sb.from("usulan").select("status").eq("id", u!.id).single();
  expect(s?.status).toBe("menunggu");
  await sb.rpc("putuskan_usulan", { p_usulan: u!.id, p_setuju: false });
});
