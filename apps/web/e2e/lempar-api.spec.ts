import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Jalur data Lempar Saja langsung ke Supabase sungguhan: daftar, unggah ke Storage ber-RLS, anti-duplikat, isolasi antar usaha.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    );
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

async function masuk(email: string) {
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: E.E2E_SANDI });
  expect(error).toBeNull();
  return sb;
}

test("daftar, unggah, anti-duplikat, dan isolasi berkas antar usaha", async () => {
  const a = await masuk(E.E2E_EMAIL_A);
  const b = await masuk(E.E2E_EMAIL_B);
  // Isi unik per jalan agar sha256 baru; berkas korpus sintetis sebagai dasar.
  const isi = Buffer.concat([readFileSync(join(__dirname, "..", "..", "..", "fixtures", "korpus", "nota", "nota-01.png")), Buffer.from(`\n${Date.now()}`)]);
  const sha = createHash("sha256").update(isi).digest("hex");

  const { data: daftar, error: e1 } = await a.rpc("lempar_berkas", { p_sha256: sha, p_nama: "nota-01.png", p_mime: "image/png", p_ukuran: isi.length });
  expect(e1).toBeNull();
  expect(daftar.ada).toBe(false);
  expect(daftar.jalur).toMatch(new RegExp(`/lempar/${sha}\\.png$`));

  // Jalur yang tidak didaftarkan ditolak RLS Storage.
  const liar = await a.storage.from("berkas").upload(daftar.jalur.replace(sha, "0".repeat(64)), isi, { contentType: "image/png" });
  expect(liar.error).not.toBeNull();

  const unggah = await a.storage.from("berkas").upload(daftar.jalur, isi, { contentType: "image/png" });
  expect(unggah.error).toBeNull();

  // Berkas yang sama dilempar lagi: tidak didaftarkan dua kali.
  const { data: ulang } = await a.rpc("lempar_berkas", { p_sha256: sha, p_nama: "salinan.png", p_mime: "image/png", p_ukuran: isi.length });
  expect(ulang.ada).toBe(true);
  expect(ulang.id).toBe(daftar.id);

  // Pemilik usaha lain tidak bisa mengunduh, tidak melihat barisnya, dan tidak bisa menulis ke folder usaha A.
  const unduhB = await b.storage.from("berkas").download(daftar.jalur);
  expect(unduhB.error).not.toBeNull();
  const { data: barisB } = await b.from("berkas").select("id").eq("id", daftar.id);
  expect(barisB).toEqual([]);
  const tulisB = await b.storage.from("berkas").upload(daftar.jalur.replace(sha, "f".repeat(64)), isi, { contentType: "image/png" });
  expect(tulisB.error).not.toBeNull();

  // Pemilik A bisa mengunduh berkasnya sendiri; konfigurasi model terbaca tanpa ID tertulis di kode.
  const unduhA = await a.storage.from("berkas").download(daftar.jalur);
  expect(unduhA.error).toBeNull();
  expect((await unduhA.data!.arrayBuffer()).byteLength).toBe(isi.length);
  const { data: konf } = await a.from("konfigurasi").select("nilai").eq("kunci", "model_ai").single();
  expect(Object.keys(konf!.nilai)).toEqual(expect.arrayContaining(["ringan", "berat", "ambang_naik"]));

  // Jenis berkas yang tidak didukung ditolak sejak pendaftaran.
  const { error: eJenis } = await a.rpc("lempar_berkas", { p_sha256: "a".repeat(64), p_nama: "x.exe", p_mime: "application/x-msdownload", p_ukuran: 10 });
  expect(eJenis?.message).toContain("belum bisa dibaca");
});
