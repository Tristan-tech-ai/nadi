import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uraiMutasiCsv, type Mutasi } from "@/lib/invoice/cocok";
import { usulkanRekon, type Konteks } from "./rekon";

// M-05: korpus fixtures/korpus/rekon (node scripts/korpus/rekon.mjs), tiga format CSV rekening sintetis.
// Kriteria terima: cocok >= 90% dari baris yang punya pasangan, 0 salah (usulan ke target lain atau usulan untuk baris tanpa pasangan).
const akar = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus", "rekon");
type Kasus = Konteks & { jawaban: ({ jenis: string; target: string } | null)[] };

function jalankan(nama: string) {
  const k = JSON.parse(readFileSync(join(akar, `${nama}.json`), "utf8")) as Kasus;
  const csv = uraiMutasiCsv(readFileSync(join(akar, `${nama}.csv`), "utf8"));
  if ("galat" in csv) throw new Error(csv.galat);
  const hasil = usulkanRekon(csv.baris, k);
  let benar = 0, salah = 0;
  const punya = k.jawaban.filter(Boolean).length;
  hasil.forEach((h, i) => {
    const j = k.jawaban[i];
    if (!h.usulan) return;
    if (j && h.usulan.jenis === j.jenis && h.usulan.target === j.target) benar++;
    else salah++;
  });
  return { baris: csv.baris.length, jawaban: k.jawaban.length, punya, benar, salah };
}

describe("korpus rekonsiliasi 3 format bank", () => {
  for (const nama of ["bank-a", "bank-b", "bank-c"]) {
    it(`${nama}: semua baris terbaca, cocok >= 90%, 0 salah`, () => {
      const r = jalankan(nama);
      expect(r.baris).toBe(r.jawaban);
      expect(r.salah).toBe(0);
      expect(r.benar / r.punya).toBeGreaterThanOrEqual(0.9);
    });
  }
});

describe("usulkanRekon", () => {
  const m = (keterangan: string, jumlah: number, arah: "CR" | "DB", tanggal = "2026-10-10"): Mutasi => ({ tanggal, keterangan, jumlah, arah });
  const kosong: Konteks = { invoice: [], tagihan: [], jurnal: [], aturan: [] };
  it("aturan dengan dua akun berbeda untuk mutasi yang sama tidak menebak", () => {
    const h = usulkanRekon([m("BIAYA ADM PLN", 5000, "DB")], { ...kosong, aturan: [{ id: "a", kata: "PLN", arah: null, akun_kode: "6-300" }, { id: "b", kata: "BIAYA ADM", arah: "DB", akun_kode: "6-910" }] });
    expect(h[0].usulan).toBeUndefined();
  });
  it("aturan memeriksa arah dan kata utuh", () => {
    const k = { ...kosong, aturan: [{ id: "a", kata: "PLN", arah: "DB" as const, akun_kode: "6-300" }] };
    expect(usulkanRekon([m("REFUND PLN", 5000, "CR")], k)[0].usulan).toBeUndefined();
    expect(usulkanRekon([m("TOKO PLNX", 5000, "DB")], k)[0].usulan).toBeUndefined();
    expect(usulkanRekon([m("BAYAR PLN OKT", 5000, "DB")], k)[0].usulan).toMatchObject({ jenis: "akun", target: "6-300" });
  });
  it("dua mutasi untuk satu jurnal yang sama: tidak ada yang diusulkan", () => {
    const k = { ...kosong, jurnal: [{ id: "j", tanggal: "2026-10-10", keterangan: "Setoran", jumlah: 100000, arah: "CR" as const }] };
    const h = usulkanRekon([m("SETORAN TUNAI", 100000, "CR"), m("SETORAN TUNAI", 100000, "CR", "2026-10-11")], k);
    expect(h.map((x) => x.usulan)).toEqual([undefined, undefined]);
  });
  it("jurnal lebih dari 3 hari dari mutasi tidak dicocokkan", () => {
    const k = { ...kosong, jurnal: [{ id: "j", tanggal: "2026-10-01", keterangan: "Setoran", jumlah: 100000, arah: "CR" as const }] };
    expect(usulkanRekon([m("SETORAN", 100000, "CR", "2026-10-05")], k)[0].usulan).toBeUndefined();
  });
  it("nomor tagihan pemasok disebut menang dari nominal tagihan lain yang sama", () => {
    const k = { ...kosong, tagihan: [
      { id: "t1", pemasok: "CV Tani", nomor_pemasok: "FK-101", sisa: 50000, tanggal: "2026-10-01", jatuh_tempo: "2026-10-31" },
      { id: "t2", pemasok: "UD Beras", nomor_pemasok: "FK-202", sisa: 50000, tanggal: "2026-10-01", jatuh_tempo: "2026-10-31" }] };
    expect(usulkanRekon([m("TRSF DB BAYAR FK-202", 50000, "DB")], k)[0].usulan).toMatchObject({ target: "t2", alasan: "nomor_tagihan" });
    expect(usulkanRekon([m("TRSF DB 0812", 50000, "DB")], k)[0].usulan).toBeUndefined();
  });
});
