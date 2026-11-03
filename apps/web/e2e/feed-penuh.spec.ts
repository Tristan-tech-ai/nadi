import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { tolakUsulanLama } from "./bersih";

// D-05: Feed tidak menyembunyikan usulan. 25 usulan sintetis menunggu di Warung Uji A; Feed menyebut sisanya, halaman berikut
// membuka sisanya, pil jenis menyaring, "Terbaru" mengurutkan menurut waktu masuk. Semua usulan uji ditolak lagi di akhir
// (tombol Tolak di Feed untuk satu, RPC putuskan_usulan untuk sisanya), tidak pernah dihapus.
function envUji(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...envUji(".env.local"), ...envUji(".env.e2e.local") };
// Foto disimpan ke E2E_FOTO_DIR bila diisi, selain itu ke folder keluaran Playwright.
const foto = (nama: string) => (process.env.E2E_FOTO_DIR ? join(process.env.E2E_FOTO_DIR, nama) : test.info().outputPath(nama));
const N = 25;
const nomor = (i: number) => String(i).padStart(2, "0");

// Kedua tes menyisipkan usulan dokumen ke usaha yang sama dan menghitung halaman; paralel akan saling menggeser.
test.describe.configure({ mode: "serial" });

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
      await page.screenshot({ path: foto(`${nama}-${lebar}-${skema}.png`), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("Feed menyebut sisa usulan, membuka halaman berikut, dan menyaring per jenis", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  await tolakUsulanLama(sb);
  const { data: klaim } = await sb.auth.getClaims();
  const pid = (klaim?.claims.app_metadata as { pid: string }).pid;
  const { data: usaha } = await sb.from("perusahaan").select("nama").eq("id", pid).single();
  expect(usaha?.nama).toBe("Warung Uji A");
  const { count: dokumenLain } = await sb.from("usulan").select("id", { count: "exact", head: true }).eq("status", "menunggu").like("aksi", "dokumen.%");

  // 25 usulan dokumen sintetis tanpa tenggat. Hanya #01 berdampak (Rp1.000), sehingga urutan bawaan (dampak dulu) berbeda dari
  // "Terbaru". Waktu dibuat dimundurkan 10 menit (masih di bawah batas tolakUsulanLama 15 menit) agar usulan uji spec lain yang
  // berjalan paralel tetap di atas mereka di Feed tanpa saringan; diberitahu_at diisi agar tidak memicu push ke HP pemilik.
  const tanda = `Uji Feed penuh ${Date.now()}`;
  const awal = Date.now() - 10 * 60_000;
  const baris = Array.from({ length: N }, (_, k) => ({
    perusahaan_id: pid, sumber: "aturan", aksi: "dokumen.surat", judul: `${tanda} #${nomor(k + 1)}`,
    penjelasan: "Usulan sintetis untuk uji Feed. Ditolak lagi setelah uji.", payload: { uji: "feed-penuh" },
    dampak_rp: k === 0 ? 1000 : null, dibuat_at: new Date(awal + k * 1000).toISOString(), diberitahu_at: new Date().toISOString(),
  }));
  const { data: dibuat, error } = await sb.from("usulan").insert(baris).select("id");
  expect(error).toBeNull();
  expect(dibuat).toHaveLength(N);
  const judulUji = baris.map((b) => b.judul);

  try {
    await page.goto("/masuk?next=/app");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app");

    // Tanpa saringan: jumlah persis di kartu ringkasan, 20 kartu, dan baris sisa yang menyebut angkanya.
    const daftar = page.getByTestId("daftar-usulan");
    await expect(daftar.locator("article")).toHaveCount(20);
    const total = Number(await page.getByTestId("jumlah-usulan").textContent());
    expect(total).toBeGreaterThanOrEqual(N);
    await expect(page.getByTestId("pil-semua")).toContainText(String(total));
    await expect(page.getByTestId("sisa-usulan")).toHaveText(`Masih ada ${total - 20} usulan lagi.`);
    await expect(page.getByTestId("lihat-berikutnya")).toHaveText(`Lihat ${Math.min(20, total - 20)} berikutnya`);

    // Pil Dokumen menyaring ke usulan dokumen saja.
    const dok = N + (dokumenLain ?? 0);
    await expect(page.getByTestId("pil-dokumen")).toContainText(String(dok));
    await page.getByTestId("pil-dokumen").click();
    await page.waitForURL((u) => u.searchParams.get("jenis") === "dokumen" && !u.searchParams.has("lagi"));
    await expect(page.getByTestId("pil-dokumen")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("pil-semua")).not.toHaveAttribute("aria-current", "page");
    await expect(daftar.locator("article")).toHaveCount(20);
    await expect(page.getByTestId("posisi-feed")).toHaveText(`Usulan 1 sampai 20 dari ${dok} jenis Dokumen, yang paling mendesak di atas.`);
    await expect(page.getByTestId("sisa-usulan")).toHaveText(`Masih ada ${dok - 20} usulan Dokumen lagi.`);
    const kartuPertama = daftar.locator("article").first();
    await expect(kartuPertama.locator("h3")).toHaveText(`${tanda} #01`); // satu-satunya yang berdampak
    await expect(kartuPertama.getByTestId("penanda-baru")).toHaveText("Baru");
    await expect(daftar.locator("article").nth(1).locator("h3")).toHaveText(`${tanda} #${nomor(N)}`); // lalu yang terbaru
    const halaman1 = await daftar.locator("article h3").allTextContents();
    await periksaTampilan(page, "feed-saring");

    // Halaman berikut membuka sisanya, dan ada jalan kembali.
    await page.getByTestId("lihat-berikutnya").click();
    await page.waitForURL((u) => u.searchParams.get("lagi") === "20" && u.searchParams.get("jenis") === "dokumen");
    await expect(daftar.locator("article")).toHaveCount(dok - 20);
    await expect(page.getByTestId("posisi-feed")).toContainText(`Usulan 21 sampai ${dok} dari ${dok}`);
    await expect(page.getByTestId("sisa-usulan")).toHaveCount(0);
    await expect(page.getByTestId("lihat-berikutnya")).toHaveCount(0);
    await expect(page.getByTestId("akhir-usulan")).toHaveText("Itu semua usulan Dokumen yang menunggu.");
    const halaman2 = await daftar.locator("article h3").allTextContents();
    const terlihat = [...halaman1, ...halaman2].filter((j) => j.startsWith(tanda));
    expect([...terlihat].sort()).toEqual([...judulUji].sort()); // semua 25 muncul tepat sekali
    await periksaTampilan(page, "feed-halaman-2");
    await page.getByTestId("ke-awal").click();
    await page.waitForURL((u) => u.searchParams.get("jenis") === "dokumen" && !u.searchParams.has("lagi"));
    await expect(kartuPertama.locator("h3")).toHaveText(`${tanda} #01`);

    // Terbaru: urut waktu masuk, saringan jenis tetap, offset kembali ke awal.
    await page.getByTestId("urut-terbaru").click();
    await page.waitForURL((u) => u.searchParams.get("urut") === "terbaru" && u.searchParams.get("jenis") === "dokumen");
    await expect(page.getByTestId("urut-terbaru")).toHaveAttribute("aria-current", "page");
    await expect(kartuPertama.locator("h3")).toHaveText(`${tanda} #${nomor(N)}`);
    await expect(daftar.locator("article", { hasText: `${tanda} #01` })).toHaveCount(0); // yang tertua pindah ke halaman 2
    await expect(page.getByTestId("posisi-feed")).toContainText("yang terbaru di atas");

    // Tolak satu lewat tombol biasa di Feed.
    await kartuPertama.getByRole("button", { name: "Tolak" }).click();
    await expect(kartuPertama.getByTestId("hasil-putusan")).toContainText("Ditolak");
    await expect(daftar.getByTestId("kartu-diputuskan").first()).toHaveAttribute("data-tersimpan", "ya"); // jendela Batalkan habis
    await page.reload();
    await expect(page.getByTestId("pil-dokumen")).toContainText(String(dok - 1));
  } finally {
    // Sisanya ditolak lewat RPC yang sama dengan tombol Tolak (bukan dihapus).
    for (const u of dibuat ?? []) await sb.rpc("putuskan_usulan", { p_usulan: u.id, p_setuju: false });
    const { count: sisa } = await sb.from("usulan").select("id", { count: "exact", head: true }).eq("status", "menunggu").like("judul", `${tanda}%`);
    expect(sisa).toBe(0);
  }
});

// D-05B: kartu yang diputuskan tetap tampil di halaman 1, tetapi sudah tidak menunggu. Tautan halaman berikut harus mundur
// sebanyak itu; dulu offset tetap 20 dan usulan yang bergeser ke posisi 18-20 tidak pernah tampil.
test("memutuskan usulan di halaman 1 tidak membuat sisanya terlewat di halaman 2", async ({ page }) => {
  test.setTimeout(180_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();
  await tolakUsulanLama(sb);
  const { data: klaim } = await sb.auth.getClaims();
  const pid = (klaim?.claims.app_metadata as { pid: string }).pid;
  const tanda = `Uji Feed celah ${Date.now()}`;
  const awal = Date.now() - 10 * 60_000;
  const baris = Array.from({ length: N }, (_, k) => ({
    perusahaan_id: pid, sumber: "aturan", aksi: "dokumen.surat", judul: `${tanda} #${nomor(k + 1)}`,
    penjelasan: "Usulan sintetis untuk uji Feed. Ditolak lagi setelah uji.", payload: { uji: "feed-celah" },
    dibuat_at: new Date(awal + k * 1000).toISOString(), diberitahu_at: new Date().toISOString(),
  }));
  const { data: dibuat, error } = await sb.from("usulan").insert(baris).select("id");
  expect(error).toBeNull();
  expect(dibuat).toHaveLength(N);

  try {
    await page.goto("/masuk?next=/app");
    await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
    await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
    await page.getByRole("button", { name: "Masuk" }).click();
    await page.waitForURL((u) => u.pathname === "/app");
    // Terbaru + Dokumen: urutan pasti (waktu masuk), usulan uji ini di atas karena paling baru di antara usulan dokumen.
    await page.goto("/app?jenis=dokumen&urut=terbaru");
    const daftar = page.getByTestId("daftar-usulan");
    await expect(daftar.locator("article")).toHaveCount(20);
    const halaman1 = await daftar.locator("article h3").allTextContents();
    expect(halaman1.slice(0, 3)).toEqual([`${tanda} #25`, `${tanda} #24`, `${tanda} #23`]);

    // Tolak tiga kartu teratas lewat tombol; kartu tetap tampil dengan capnya.
    for (let i = 0; i < 3; i++) {
      const kartu = daftar.locator("article").nth(i);
      await kartu.getByRole("button", { name: "Tolak" }).click();
      await expect(kartu.getByTestId("hasil-putusan")).toContainText("Ditolak");
    }
    await expect(page.getByTestId("lihat-berikutnya")).toHaveAttribute("href", /lagi=17(&|$)/);
    await page.getByTestId("lihat-berikutnya").click();
    await page.waitForURL((u) => u.searchParams.get("lagi") === "17");
    await expect(page.getByTestId("posisi-feed")).toContainText("Usulan 18 sampai");
    const halaman2 = await daftar.locator("article h3").allTextContents();
    // Setiap usulan uji tampil di halaman 1 atau 2; tidak ada yang terlewat.
    const terlihat = new Set([...halaman1, ...halaman2].filter((j) => j.startsWith(tanda)));
    expect([...terlihat].sort()).toEqual(baris.map((b) => b.judul).sort());
  } finally {
    for (const u of dibuat ?? []) await sb.rpc("putuskan_usulan", { p_usulan: u.id, p_setuju: false });
    const { count: sisa } = await sb.from("usulan").select("id", { count: "exact", head: true }).eq("status", "menunggu").like("judul", `${tanda}%`);
    expect(sisa).toBe(0);
  }
});
