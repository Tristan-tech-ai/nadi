import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ruangUntuk } from "../src/lib/ruang";

// U-05 Mulai di Nadi: akun A memakai usaha uji kosong "Uji Mulai E2E" (paket F&B). Pengguna mengerjakan 3 langkah sendiri (tambah
// orang, tambah barang, buat invoice) dan daftarnya tercentang dari data; daftar ditutup lalu dipanggil lagi dari bantuan "?";
// tur singkat hanya muncul dari bantuan. Sesudahnya data uji dikembalikan (orang nonaktif, barang nonaktif, invoice batal),
// sehingga jalan berikutnya mulai dari kosong lagi. Audit keadaan kosong: setiap halaman pemilik dibuka di usaha kosong ini,
// dan setiap keadaan kosong wajib menyebut gunanya dan memberi satu langkah pertama (tautan, tombol, atau isian di halaman itu).
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const NAMA_USAHA = "Uji Mulai E2E";

test.describe.configure({ mode: "serial" });
test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL || !E.E2E_EMAIL_A, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function siapkan(): Promise<{ sb: SupabaseClient; pid: string; awal?: string }> {
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  const awal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const { data } = await sb.from("perusahaan").select("id").eq("nama", NAMA_USAHA).limit(1);
  let pid = data?.[0]?.id as string | undefined;
  if (!pid) {
    // Dibuat sekali; jalan berikutnya memakai ulang (dikosongkan lagi di akhir setiap tes).
    const r = await sb.rpc("buat_perusahaan", { p_nama: NAMA_USAHA, p_industri: "fnb" });
    expect(r.error).toBeNull();
    pid = r.data as string;
    await sb.auth.refreshSession();
    await sb.rpc("pasang_paket", { p_kode: "fnb" });
  } else {
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
  }
  await sb.auth.refreshSession();
  return { sb, pid: pid!, awal: awal === pid ? undefined : awal };
}

/** Kembalikan usaha uji ke keadaan kosong tanpa menghapus: orang dan barang dinonaktifkan, invoice dibatalkan. */
async function kosongkan(sb: SupabaseClient, pid: string) {
  const { data: orang } = await sb.from("orang").select("id").eq("perusahaan_id", pid).eq("status", "aktif");
  for (const o of orang ?? []) await sb.from("orang").update({ status: "nonaktif" }).eq("id", o.id);
  const { data: produk } = await sb.from("produk").select("id, kode, nama").eq("perusahaan_id", pid).eq("aktif", true);
  for (const p of produk ?? []) await sb.rpc("simpan_produk", { p: { id: p.id, kode: p.kode, nama: p.nama, aktif: false } });
  const { data: inv } = await sb.from("invoice").select("id").eq("perusahaan_id", pid).neq("status", "batal");
  for (const i of inv ?? []) await sb.rpc("batal_invoice", { p_id: i.id, p_alasan: "uji Mulai di Nadi" });
}

async function masuk(page: Page, jalur = "/app") {
  await page.goto(`/masuk?next=${encodeURIComponent(jalur)}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === jalur);
}

async function axeBersih(page: Page, nama: string) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id), nama).toEqual([]);
}

test("pengguna baru mengerjakan 3 langkah Mulai di Nadi; daftar ditutup, dipanggil lagi, dan tur dari bantuan", async ({ page }) => {
  test.setTimeout(240_000);
  const { sb, pid, awal } = await siapkan();
  try {
    await kosongkan(sb, pid);
    await masuk(page);
    const mulai = page.getByTestId("mulai-nadi");
    await expect(mulai).toBeVisible();
    await expect(page.getByTestId("mulai-progres")).toHaveText("0 dari 6 selesai");
    await axeBersih(page, "daftar kosong");
    await page.screenshot({ path: test.info().outputPath("mulai-1440.png") });

    // Langkah 1: tambah orang, dibuka dari daftar.
    const tag = Date.now().toString(36).toUpperCase();
    await mulai.getByRole("link", { name: /Tambah orang yang bekerja/ }).click();
    await page.waitForURL((u) => u.pathname === "/app/orang");
    await page.getByLabel("Nama orang").fill(`Sari Mulai ${tag}`);
    await page.getByRole("button", { name: "Tambah orang" }).click();
    await expect(page.getByText(`Sari Mulai ${tag}`)).toBeVisible();

    // Langkah 2: tambah barang.
    await page.goto("/app");
    await mulai.getByRole("link", { name: /Tambah barang yang kamu jual/ }).click();
    await page.waitForURL((u) => u.pathname === "/app/barang");
    const fp = page.getByRole("form", { name: "Tambah produk" });
    await fp.getByLabel("Nama produk").fill(`Es teh ${tag}`);
    await fp.getByLabel("Kode", { exact: true }).fill(`M-${tag}`);
    await fp.getByLabel("Harga jual").fill("5.000");
    await fp.getByRole("button", { name: "Simpan produk" }).click();
    await expect(page.getByTestId("baris-produk").filter({ hasText: `Es teh ${tag}` })).toBeVisible();

    // Langkah 3: buat invoice.
    await page.goto("/app");
    await mulai.getByRole("link", { name: /Buat invoice pertama/ }).click();
    await page.waitForURL((u) => u.pathname === "/app/invoice");
    const fi = page.getByRole("form", { name: "Invoice baru" });
    await fi.getByLabel("Pelanggan", { exact: true }).fill(`Pelanggan Mulai ${tag}`);
    await fi.getByLabel("Uraian baris 1").fill("Nasi kotak");
    await fi.getByLabel("Harga satuan baris 1").fill("25.000");
    await fi.getByRole("button", { name: "Terbitkan invoice" }).click();
    await expect(fi.getByRole("status")).toContainText("Terbit:");

    // Tercentang dari data.
    await page.goto("/app");
    await expect(page.getByTestId("mulai-progres")).toHaveText("3 dari 6 selesai");
    for (const id of ["orang", "produk", "invoice"]) await expect(mulai.locator(`[data-langkah="${id}"]`)).toHaveAttribute("data-selesai", "ya");
    await expect(mulai.locator('[data-langkah="lempar"]')).toHaveAttribute("data-selesai", "belum");
    for (const [lebar, tinggi] of [[390, 844], [1440, 900]]) {
      for (const skema of ["light", "dark"] as const) {
        await page.setViewportSize({ width: lebar, height: tinggi });
        await page.emulateMedia({ colorScheme: skema });
        await page.waitForTimeout(400);
        await axeBersih(page, `${lebar} ${skema}`);
        await page.screenshot({ path: test.info().outputPath(`mulai-${lebar}-${skema}.png`) });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });

    // Ditutup, lalu dipanggil lagi dari bantuan "?".
    await mulai.getByRole("button", { name: "Tutup Mulai di Nadi" }).click();
    await expect(page.getByTestId("mulai-nadi")).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("mulai-nadi")).toHaveCount(0);
    await page.locator('[data-tur="bantuan"]').first().click();
    await page.getByRole("button", { name: "Daftar Mulai di Nadi" }).click();
    await expect(page.getByTestId("mulai-nadi")).toBeVisible();
    await expect(page.getByTestId("mulai-progres")).toHaveText("3 dari 6 selesai");

    // Tur singkat hanya dari bantuan: tidak ada di /app biasa, 5 langkah, Selesai menutupnya.
    await expect(page.getByTestId("tur-singkat")).toHaveCount(0);
    await page.locator('[data-tur="bantuan"]').first().click();
    await page.getByRole("link", { name: "Tur singkat 60 detik" }).click();
    const tur = page.getByRole("dialog", { name: "Cari apa saja" });
    await expect(tur).toBeVisible();
    await axeBersih(page, "tur");
    await page.screenshot({ path: test.info().outputPath("tur-1.png") });
    for (let i = 1; i < 5; i++) {
      await page.getByTestId("tur-singkat").getByRole("button", { name: "Lanjut" }).click();
      await expect(page.getByTestId("tur-langkah")).toHaveText(`Langkah ${i + 1} dari 5`);
    }
    await page.screenshot({ path: test.info().outputPath("tur-5.png") });
    await page.getByTestId("tur-singkat").getByRole("button", { name: "Selesai" }).click();
    await expect(page.getByTestId("tur-singkat")).toHaveCount(0);
    await page.waitForURL((u) => u.pathname === "/app" && !u.search.includes("tur"));
  } finally {
    await kosongkan(sb, pid);
    if (awal) await sb.rpc("pindah_perusahaan", { p_perusahaan: awal });
  }
});

type Kosong = { jalur: string; teks: string; langkah: boolean; kalimat: number };

test("audit keadaan kosong: setiap daftar kosong menyebut gunanya dan memberi satu langkah pertama", async ({ page }) => {
  test.setTimeout(600_000);
  const { sb, pid, awal } = await siapkan();
  const temuan: Kosong[] = [];
  const tanpaKosong: string[] = [];
  const rinciHalaman: Record<string, unknown> = {};
  try {
    await kosongkan(sb, pid);
    await masuk(page);
    const halaman = ruangUntuk("pemilik").flatMap((r) => r.halaman.map((h) => h.href)).filter((h) => !h.includes("["));
    for (const jalur of halaman) {
      await page.goto(jalur);
      await page.waitForLoadState("networkidle");
      // Keadaan kosong = elemen bertanda (data-kosong, data-testid *-kosong) atau paragraf "Belum ada ...". Langkah pertama = tautan,
      // tombol, atau isian di dalamnya, target data-langkah yang ada, atau kontrol di bagian (section) yang sama dengan keadaan kosong itu.
      const hasil = await page.locator("main").evaluate((main) => {
        const tanda = Array.from(main.querySelectorAll<HTMLElement>('[data-testid$="-kosong"], [data-kosong]'));
        const belum = Array.from(main.querySelectorAll<HTMLElement>("p")).filter((p) => /^Belum ada /.test(p.textContent?.trim() ?? "") && !tanda.some((t) => t.contains(p)));
        return [...tanda, ...belum].filter((e) => e.offsetParent !== null).map((e) => {
          const target = e.getAttribute("data-langkah");
          const kontrol = "a[href], button, input:not([type=hidden]), select, textarea";
          const bagian = e.closest("section, form, details") as HTMLElement | null;
          const lain = bagian && bagian !== main ? Array.from(bagian.querySelectorAll<HTMLElement>(kontrol)).some((k) => !e.contains(k) && k.offsetParent !== null && !k.closest("[data-kepala-halaman]")) : false;
          const ada = Boolean(e.querySelector(kontrol)) || Boolean(target && document.querySelector(target)) || lain;
          const teks = (e.textContent ?? "").replace(/\s+/g, " ").trim();
          return { teks, langkah: ada, kalimat: teks.split(/[.!?](?:\s|$)/).filter((x) => x.trim().length > 2).length };
        });
      });
      if (!hasil.length) tanpaKosong.push(jalur);
      if (process.env.AUDIT_RINCI) {
        const rinci = await page.locator("main").evaluate((main) => ({
          form: Array.from(main.querySelectorAll("form")).filter((f) => f.offsetParent !== null).map((f) => `${f.id || "-"}|${f.getAttribute("aria-label") ?? f.getAttribute("aria-labelledby") ?? ""}`),
          h2: Array.from(main.querySelectorAll("h2")).map((h) => `${h.id || "-"}|${h.textContent?.trim()}`),
          belum: Array.from(main.querySelectorAll("p")).map((x) => x.textContent?.trim() ?? "").filter((x) => /^(Belum|Tidak ada)/.test(x)).slice(0, 6),
        }));
        rinciHalaman[jalur] = rinci;
      }
      for (const h of hasil) temuan.push({ jalur, ...h });
    }
  } finally {
    await kosongkan(sb, pid);
    if (awal) await sb.rpc("pindah_perusahaan", { p_perusahaan: awal });
  }
  writeFileSync(test.info().outputPath("audit-kosong.json"), JSON.stringify({ temuan, tanpaKosong, rinciHalaman }, null, 2));
  const gagal = temuan.filter((t) => !t.langkah || t.kalimat < 2).map((t) => `${t.jalur}: ${t.langkah ? "" : "[tanpa langkah] "}${t.teks.slice(0, 90)}`);
  expect(gagal, "keadaan kosong tanpa guna atau langkah pertama").toEqual([]);
});
