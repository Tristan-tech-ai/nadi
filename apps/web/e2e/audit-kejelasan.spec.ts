import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ruangUntuk } from "../src/lib/ruang";

// U-11 audit kejelasan: buka setiap halaman /app sebagai pemilik, kumpulkan semua tombol di isi halaman beserta judul bagian
// terdekat, lalu tandai label yang tidak menyebut apa yang terjadi (satu kata kerja umum tanpa objek) dan tombol ikon tanpa nama.
// Hanya membaca. Hasil ditulis ke test-results/audit-kejelasan.json untuk docs/quality/audit-kejelasan.md.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const UMUM = /^(simpan|kirim|ok|ya|tidak|proses|lanjut|submit|tambah|hapus|ubah|buat|terapkan|setujui|tolak|pilih|unggah|cari|buka|tutup|batal|kembali|cek|hitung|jalankan|catat|perbarui|selesai)$/i;

type Temuan = { jalur: string; judul: string; tombol: { label: string; bagian: string; jenis: string }[] };

async function kumpulkan(page: Page, jalur: string): Promise<Temuan> {
  await page.goto(jalur);
  await page.waitForLoadState("networkidle");
  const judul = (await page.locator("main h1").first().textContent().catch(() => "")) ?? "";
  const tombol = await page.locator("main").evaluate((main) => {
    const hasil: { label: string; bagian: string; jenis: string }[] = [];
    for (const el of Array.from(main.querySelectorAll("button, [role=button], input[type=submit], summary"))) {
      const e = el as HTMLElement;
      if (e.closest("[hidden], [aria-hidden=true]") || e.offsetParent === null) continue;
      const nama = (e.getAttribute("aria-label") || e.textContent || (e as HTMLInputElement).value || e.getAttribute("title") || "").replace(/\s+/g, " ").trim();
      let bagian = "";
      let n: Element | null = e;
      while (n && n !== main && !bagian) {
        let s: Element | null = n;
        while (s && !bagian) { s = s.previousElementSibling; if (s && /^H[2-4]$/.test(s.tagName)) bagian = s.textContent?.trim() ?? ""; else if (s) { const h = s.querySelector("h2,h3,h4"); if (h) bagian = h.textContent?.trim() ?? ""; } }
        n = n.parentElement;
        if (n) { const h = n.querySelector(":scope > h2, :scope > h3, :scope > header h2, :scope > header h3"); if (h && !bagian) bagian = h.textContent?.trim() ?? ""; }
      }
      hasil.push({ label: nama, bagian: bagian.slice(0, 80), jenis: e.tagName.toLowerCase() });
    }
    return hasil;
  });
  return { jalur, judul: judul.trim(), tombol };
}

test("audit kejelasan tombol di semua halaman pemilik", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/masuk?next=${encodeURIComponent("/app")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_B);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app");
  const semua: Temuan[] = [];
  for (const r of ruangUntuk("pemilik")) for (const h of r.halaman) semua.push(await kumpulkan(page, h.href));
  const ringkas = semua.map((t) => ({
    ...t,
    umum: t.tombol.filter((x) => UMUM.test(x.label)).map((x) => `${x.label} (${x.bagian || "tanpa judul bagian"})`),
    tanpaNama: t.tombol.filter((x) => !x.label).length,
  }));
  writeFileSync(join(__dirname, "..", "test-results", "audit-kejelasan.json"), JSON.stringify(ringkas, null, 1));
  expect(semua.length).toBeGreaterThan(50);
});

test("audit kejelasan tombol di semua halaman staf", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B, "sekali (desktop), butuh .env.e2e.local");
  test.setTimeout(600_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pid = (await sb.auth.getUser()).data.user?.app_metadata?.pid as string;
  const { data: o, error } = await sb.from("orang").insert({ perusahaan_id: pid, nama: `Audit Staf ${Date.now().toString(36).replace(/\d/g, "")}` }).select("id").single();
  expect(error).toBeNull();
  const pin = String(100000 + Math.floor(Math.random() * 899999));
  try {
    expect((await sb.rpc("buat_akun_staf", { p_orang: o!.id, p_pin: pin })).error).toBeNull();
    const { data: os } = await sb.from("orang").select("id_staf").eq("id", o!.id).single();
    const { data: us } = await sb.from("perusahaan").select("kode").eq("id", pid).single();
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto("/masuk/staf");
    await page.getByLabel("Kode usaha").fill(us!.kode as string);
    await page.getByLabel("ID kamu").fill(os!.id_staf as string);
    await page.getByLabel("PIN").fill(pin);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/app"));
    const semua: Temuan[] = [];
    for (const r of ruangUntuk("staf")) for (const h of r.halaman) semua.push(await kumpulkan(page, h.href));
    writeFileSync(join(__dirname, "..", "test-results", "audit-kejelasan-staf.json"), JSON.stringify(semua.map((t) => ({
      ...t, umum: t.tombol.filter((x) => UMUM.test(x.label)).map((x) => `${x.label} (${x.bagian || "tanpa judul bagian"})`), tanpaNama: t.tombol.filter((x) => !x.label).length })), null, 1));
    expect(semua.length).toBeGreaterThan(8);
  } finally {
    await sb.from("orang").update({ status: "nonaktif" }).eq("id", o!.id);
  }
});
