import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// X-11 review hasil kerja lewat kartu Feed, LOKAL saja: hasil dikirim (RPC, sama dengan tombol Kirim untuk review), pemilik
// meminta revisi beralasan dari kartu Feed, hasil kedua disetujui di Feed, kerja selesai. Jalankan seperti e2e/mod.spec.ts.
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("review hasil kerja: minta revisi beralasan, lalu terima di Feed", async ({ page }) => {
  test.setTimeout(240_000);
  const email = `review-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Agensi Review", p_industri: "kantor" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const orang = await sb.from("orang").insert({ perusahaan_id: usaha.data, nama: "Sari Review", jenis: ["karyawan"] }).select("id").single();
  const kerja = await sb.rpc("buat_kerja", { p_judul: "Brosur promo", p_topi: null, p_pelaksana: orang.data!.id, p_tenggat: new Date(Date.now() + 2 * 86_400_000).toISOString(), p_kunci: null });
  const id = (kerja.data as { id: string }).id;
  expect((await sb.rpc("ubah_status_kerja", { p_kerja: id, p_aksi: "mulai" })).error).toBeNull();
  expect((await sb.rpc("kirim_hasil_kerja", { p_kerja: id, p_tautan: "https://drive.example.org/brosur-v1", p_catatan: "Versi pertama" })).error).toBeNull();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app", { timeout: 60_000 });
  const kartu = page.locator("article", { hasText: "Tinjau hasil kerja: Brosur promo" }).first();
  await expect(kartu).toBeVisible({ timeout: 60_000 });
  await expect(kartu.getByRole("button", { name: "Tolak" })).toHaveCount(0);
  await kartu.getByTestId("minta-revisi").locator("summary").click();
  await kartu.getByLabel("Yang perlu diperbaiki").fill("Warna logo kurang kontras saat dicetak");
  await kartu.getByRole("button", { name: "Kirim permintaan revisi" }).click();
  // usulan sudah diputus, kartu hilang dari Feed; kerja kembali jalan dengan alasan revisi
  await expect.poll(async () => (await sb.from("kerja").select("status").eq("id", id).single()).data?.status, { timeout: 20_000 }).toBe("jalan");
  const rev = await sb.from("kerja_hasil").select("status, alasan").eq("kerja_id", id).eq("status", "revisi");
  expect(rev.data?.[0]?.alasan).toBe("Warna logo kurang kontras saat dicetak");

  expect((await sb.rpc("kirim_hasil_kerja", { p_kerja: id, p_tautan: "https://drive.example.org/brosur-v2", p_catatan: "Kontras diperbaiki" })).error).toBeNull();
  await page.goto("/app");
  const kartu2 = page.locator("article", { hasText: "Tinjau hasil kerja: Brosur promo" }).first();
  await expect(kartu2).toBeVisible({ timeout: 30_000 });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  await kartu2.getByRole("button", { name: "Setujui" }).click();
  await expect.poll(async () => (await sb.from("kerja").select("status").eq("id", id).single()).data?.status, { timeout: 30_000 }).toBe("selesai");

  await page.goto("/app/kerja?kolom=selesai");
  await expect(page.getByTestId("kolom-review")).toBeVisible();
});
