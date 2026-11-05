import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// T-01B: empat struk SPBU berbeda dengan tata letak sama (korpus fixtures/korpus/struk-foto 01, 09, 17, 25) dibaca baca-berkas
// mode struk bersama teks OCR perangkatnya. Struk pertama dibaca model lalu tata letaknya dipelajari (aturan bayangan, diperiksa
// pengawas); dua struk berikutnya dibaca model dan dibandingkan dengan aturan; struk keempat dibaca aturan tanpa model (token 0).
// Usaha akun B "Uji Kinerja E2E" (bukan Toko Bu Sari). Jalankan sendirian: spec akun B lain menukar usaha aktif.
function bacaEnv(nama: string): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(join(__dirname, "..", nama), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch {
    return {};
  }
}
const E = { ...bacaEnv(".env.local"), ...bacaEnv(".env.e2e.local") };
const USAHA = "Uji Kinerja E2E";
const KORPUS = join(__dirname, "..", "..", "..", "fixtures", "korpus", "struk-foto");
const SPBU = ["01", "09", "17", "25"];

test.beforeEach(({ page }, info) => {
  void page;
  test.skip(info.project.name !== "desktop" || !E.E2E_SANDI || !E.E2E_EMAIL_B || !E.NEXT_PUBLIC_SUPABASE_URL, "sekali (desktop), butuh .env.local dan .env.e2e.local");
});

test("belajar format struk foto: model, bayangan 2 struk, lalu struk keempat token 0", async () => {
  test.setTimeout(420_000);
  const sb = createClient(E.NEXT_PUBLIC_SUPABASE_URL, E.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: E.E2E_EMAIL_B, password: E.E2E_SANDI })).error).toBeNull();
  const pidAwal = ((await sb.auth.getClaims()).data?.claims?.app_metadata as { pid?: string } | undefined)?.pid;
  const { data: ada } = await sb.from("perusahaan").select("id").eq("nama", USAHA).limit(1);
  const pid = ada?.[0]?.id as string;
  expect(pid).toBeTruthy();
  const tanda = `${Date.now()}`;
  const aturanStruk = async () =>
    (await sb.from("ekstraktor").select("id, status, bayangan_cocok, alasan_mati").eq("perusahaan_id", pid).eq("jenis_berkas", "struk").order("dibuat_at", { ascending: false })).data ?? [];
  try {
    expect((await sb.rpc("pindah_perusahaan", { p_perusahaan: pid })).error).toBeNull();
    await sb.auth.refreshSession();
    // Eval diukur dari nol: aturan struk dari jalan sebelumnya harus sudah mati (dimatikan lewat SQL, tidak dihapus).
    const sebelum = (await aturanStruk()).filter((a) => a.status !== "mati");
    test.skip(sebelum.length > 0, `aturan struk masih ${sebelum.map((a) => a.status).join(",")} dari jalan sebelumnya; matikan dulu lewat SQL`);

    const hasil: { struk: string; sumber: string; token: number; total: number | null; belajar?: boolean }[] = [];
    for (const n of SPBU) {
      const isi = Buffer.concat([readFileSync(join(KORPUS, `struk-${n}.jpg`)), Buffer.from(`t01b-${tanda}-${n}`)]);
      const teks = readFileSync(join(KORPUS, "ocr", `struk-${n}.txt`), "utf8");
      const sha = createHash("sha256").update(isi).digest("hex");
      const { data: d, error } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: `struk-spbu-${n}.jpg`, p_mime: "image/jpeg", p_ukuran: isi.byteLength });
      expect(error).toBeNull();
      expect(d.status).toBe("unggah");
      expect((await sb.storage.from("berkas").upload(d.jalur, isi, { contentType: "image/jpeg" })).error).toBeNull();
      // Keyakinan OCR di bawah 85: layar Klaim mengirim foto ke Nadi (jalur M-18B), teksnya ikut disimpan untuk belajar.
      expect((await sb.rpc("simpan_ocr", { p_berkas: d.id, p_teks: teks, p_keyakinan: 70 })).data).toBe(true);
      const sebelumBaca = await aturanStruk();
      const { data: r, error: eBaca } = await sb.functions.invoke<{ status: string; sumber: string; token: number; hasil: { total: number | null }; belajar?: boolean }>("baca-berkas", { body: { berkas_id: d.id, mode: "struk" } });
      expect(eBaca).toBeNull();
      expect(r?.status).toBe("dibaca");
      hasil.push({ struk: n, sumber: r!.sumber, token: r!.token, total: r!.hasil.total, belajar: r!.belajar });
      if (r!.sumber === "aturan") break;
      // Penulisan atau penilaian aturan berjalan di latar Edge Function: tunggu sampai tercatat sebelum struk berikutnya.
      const jejak = JSON.stringify(sebelumBaca);
      await expect.poll(async () => JSON.stringify(await aturanStruk()), { timeout: 120_000, intervals: [3_000] }).not.toBe(jejak);
    }
    const akhir = await aturanStruk();
    console.log("STRUK_BELAJAR", JSON.stringify({ hasil, aturan: akhir }));
    expect(hasil.map((h) => h.total)).toEqual([64800, ...hasil.slice(1).map((h) => h.total)]);
    for (const h of hasil) expect(h.total).toBeGreaterThan(0);
    // Model paling banyak 3 kali (belajar + 2 bayangan), struk terakhir tanpa model.
    expect(hasil.at(-1)).toMatchObject({ sumber: "aturan", token: 0 });
    expect(hasil.filter((h) => h.sumber === "model").length).toBeLessThanOrEqual(3);
    expect(hasil[0]).toMatchObject({ sumber: "model", belajar: true });
    expect(akhir.filter((a) => a.status === "aktif")).toEqual([expect.objectContaining({ status: "aktif", bayangan_cocok: 2 })]);
  } finally {
    if (pidAwal) await sb.rpc("pindah_perusahaan", { p_perusahaan: pidAwal });
  }
});
