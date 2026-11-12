import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Q-50, LOKAL saja (temuan rekaman video v3): porsi tim diketik ulang dengan keyboard seperti manusia (pilih semua, hapus, ketik),
// bukan fill. Isian kosong tidak berubah menjadi 0, angka tidak menjadi 060, dan baris baru langsung diisi sisa sampai 100%.
// Jalankan seperti e2e/kerja-tim.spec.ts (E2E_BASE_URL, E2E_LOKAL_URL, E2E_LOKAL_KUNCI).
const URL = process.env.E2E_LOKAL_URL ?? "";
const KUNCI = process.env.E2E_LOKAL_KUNCI ?? "";

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(URL) || !KUNCI, "lokal saja: butuh E2E_LOKAL_URL dan E2E_LOKAL_KUNCI Supabase lokal");
});

test("kerja tim: porsi diketik ulang tanpa 0 di depan, baris baru berisi sisa porsi", async ({ page }) => {
  test.setTimeout(180_000);
  const email = `kerja-porsi-${Date.now()}-${randomBytes(3).toString("hex")}@uji.local`;
  const sandi = randomBytes(18).toString("base64url");
  const sb = createClient(URL, KUNCI, { auth: { persistSession: false } });
  expect((await sb.auth.signUp({ email, password: sandi })).error).toBeNull();
  const usaha = await sb.rpc("buat_perusahaan", { p_nama: "Dapur Uji Porsi", p_industri: "fnb" });
  expect(usaha.error, usaha.error?.message).toBeNull();
  await sb.auth.refreshSession();
  const orang = await sb.from("orang").insert([{ perusahaan_id: usaha.data, nama: "Siti Porsi", jenis: ["karyawan"] }, { perusahaan_id: usaha.data, nama: "Dimas Porsi", jenis: ["karyawan"] }]).select("id, nama");
  expect(orang.error, orang.error?.message).toBeNull();
  const kerja = await sb.rpc("buat_kerja", { p_judul: "Belanja bahan katering", p_topi: null, p_pelaksana: orang.data![0].id, p_tenggat: null, p_kunci: null });
  expect(kerja.error, kerja.error?.message).toBeNull();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/masuk?next=%2Fapp%2Fkerja");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(sandi);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/app/kerja", { timeout: 60_000 });
  const kartu = page.locator("[data-testid=kartu-kerja][data-judul='Belanja bahan katering']");
  await expect(kartu).toBeVisible({ timeout: 60_000 });
  await kartu.getByTestId("tim-checklist").locator("summary").click();
  const tim = kartu.getByRole("form", { name: "Tim untuk Belanja bahan katering" });
  await expect(tim.locator("[data-baris-tim='0'] select")).toHaveValue(orang.data![0].id);

  const porsi0 = tim.locator("[data-baris-tim='0'] input[type=number]");
  await porsi0.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await expect(porsi0).toHaveValue("");
  await page.keyboard.type("60", { delay: 60 });
  await expect(porsi0).toHaveValue("60");
  await tim.getByRole("button", { name: "Tambah orang" }).click();
  const porsi1 = tim.locator("[data-baris-tim='1'] input[type=number]");
  await expect(porsi1).toHaveValue("40");
  await expect(tim.getByTestId("jumlah-porsi")).toContainText("100%");
  await tim.locator("[data-baris-tim='1'] select").selectOption({ label: "Dimas Porsi" });
  await tim.getByRole("button", { name: "Simpan tim" }).click();
  await expect(kartu.getByTestId("tim-kerja")).toContainText("Siti Porsi 60% (PIC), Dimas Porsi 40%", { timeout: 20_000 });
});
