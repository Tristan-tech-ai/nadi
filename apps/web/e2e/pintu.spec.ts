import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// W-08: pemilik (akun A) membuat pintu data di Usahamu, aplikasi luar mengirim penjualan (JSON) dan pesanan (CSV) ke /api/pintu,
// keduanya jadi usulan menunggu; kiriman ulang tidak menggandakan; penjualan disetujui jadi jurnal; pesanan ditolak (tidak ada SO
// uji yang menggantung); pintu dicabut di layar lalu kiriman berikutnya ditolak 401.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("pintu data: token dibuat di layar, kiriman JSON dan CSV jadi usulan, ulang tidak ganda, dicabut ditolak", async ({ page, request, baseURL }) => {
  test.setTimeout(120_000);
  const tanda = Date.now().toString(36).toUpperCase();
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_A, password: E.E2E_SANDI })).error).toBeNull();

  await page.goto(`/masuk?next=${encodeURIComponent("/app/perusahaan")}`);
  await page.getByLabel("Email").fill(E.E2E_EMAIL_A);
  await page.getByLabel("Kata sandi").fill(E.E2E_SANDI);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((u) => u.pathname === "/app/perusahaan");

  const bagian = page.getByTestId("pintu-data");
  const form = bagian.getByRole("form", { name: "Buat pintu data" });
  await form.getByLabel("Nama pintu").fill(`Uji ${tanda}`);
  await form.getByRole("button", { name: "Buat pintu" }).click();
  const token = (await bagian.getByTestId("token-pintu").textContent())!.trim();
  expect(token).toMatch(/^nmi_/);
  await expect(bagian.getByTestId("alamat-pintu")).toContainText("/api/pintu");

  const pintu = `${baseURL}/api/pintu`;
  const auth = { Authorization: `Bearer ${token}` };
  const jual = { jenis: "penjualan", baris: [{ tanggal: new Date().toISOString().slice(0, 10), nomor: `E2E-${tanda}`, keterangan: `Uji pintu ${tanda}`, jumlah: 12500, metode: "tunai" }] };
  const r1 = await request.post(pintu, { data: jual, headers: { ...auth, "X-Nadi-Asal": "e2e" } });
  expect(r1.status()).toBe(201);
  const b1 = await r1.json();
  expect(b1).toMatchObject({ status: "menunggu", sudah: false, baris: 1 });
  const r2 = await request.post(pintu, { data: jual, headers: auth });
  expect(r2.status()).toBe(200);
  expect((await r2.json()).usulan).toBe(b1.usulan);

  const csv = `nomor;pelanggan;uraian;jumlah;harga\nSO-${tanda};Pelanggan ${tanda};Keripik;2;18000\n`;
  const r3 = await request.post(`${pintu}?jenis=pesanan`, { data: csv, headers: { ...auth, "Content-Type": "text/csv" } });
  expect(r3.status()).toBe(201);
  const b3 = await r3.json();
  const salah = await request.post(pintu, { data: { jenis: "penjualan", baris: [{ tanggal: "4/11/2026", jumlah: 1 }] }, headers: auth });
  expect(salah.status()).toBe(422);
  expect((await salah.json()).galat).toContain("Baris 1");

  // Usulan terlihat pemilik dengan judul dari pintu data; penjualan disetujui jadi jurnal, pesanan ditolak.
  const { data: us } = await sb.from("usulan").select("id, aksi, judul, status, dampak_rp").in("id", [b1.usulan, b3.usulan]);
  expect(us?.map((u) => u.aksi).sort()).toEqual(["jual.pesanan", "uang.penjualan"]);
  await page.goto("/app");
  await expect(page.getByText(`Catat 1 penjualan Rp12.500`).first()).toBeVisible();
  expect((await sb.rpc("putuskan_usulan", { p_usulan: b1.usulan, p_setuju: true })).error).toBeNull();
  expect((await sb.rpc("putuskan_usulan", { p_usulan: b3.usulan, p_setuju: false })).error).toBeNull();
  const { count } = await sb.from("jurnal").select("id", { count: "exact", head: true }).eq("sumber", "pintu").eq("sumber_id", b1.usulan);
  expect(count).toBe(1);

  // Cabut di layar: kiriman berikutnya ditolak.
  await page.goto("/app/perusahaan");
  await bagian.getByRole("button", { name: `Cabut Uji ${tanda}` }).click();
  await expect(bagian.getByText(`Uji ${tanda}`)).toHaveCount(0);
  const r4 = await request.post(pintu, { data: { ...jual, baris: [{ ...jual.baris[0], jumlah: 1 }] }, headers: auth });
  expect(r4.status()).toBe(401);
});
