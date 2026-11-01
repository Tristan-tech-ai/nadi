import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cocokkan, uraiMutasiCsv, type InvoiceTerbuka, type Mutasi } from "./cocok";

// F4-06 (docs/research/cocok-mutasi.md): korpus fixtures/korpus/cocok (node scripts/korpus/cocok.mjs) dan CSV mutasi korpus lama.
const akar = join(__dirname, "..", "..", "..", "..", "..", "fixtures", "korpus");
type Kasus = { invoice: InvoiceTerbuka[]; mutasi: Mutasi[]; jawaban: (string | null)[] };
const kasus = [1, 2, 3].map((k) => JSON.parse(readFileSync(join(akar, "cocok", `kasus-0${k}.json`), "utf8")) as Kasus);

describe("cocokkan pada korpus", () => {
  const hasil = kasus.map((k) => ({ k, h: cocokkan(k.mutasi, k.invoice) }));
  it(">= 90% baris yang membayar invoice tercocokkan otomatis", () => {
    let benar = 0;
    let total = 0;
    for (const { k, h } of hasil) k.jawaban.forEach((j, i) => { if (j) { total++; if (h[i].invoice === j) benar++; } });
    expect(total).toBe(36);
    expect(benar / total).toBeGreaterThanOrEqual(0.9);
  });
  it("tidak ada cocok salah", () => {
    const salah = hasil.flatMap(({ k, h }) => h.filter((x, i) => x.invoice && x.invoice !== k.jawaban[i]).map((x) => `${x.invoice} <- ${k.mutasi[x.indeks].keterangan}`));
    expect(salah).toEqual([]);
  });
  it("nominal kembar tanpa petunjuk: tidak ditebak, dua kandidat ditampilkan", () => {
    for (const { k, h } of hasil) {
      const i = k.mutasi.findIndex((m) => m.keterangan === "TRSF E-BANKING CR 0987654321");
      expect(h[i].invoice).toBeUndefined();
      expect(h[i].kandidat).toHaveLength(2);
    }
  });
  it("alasan tertulis untuk setiap cocok", () => {
    for (const { h } of hasil) for (const x of h.filter((y) => y.invoice)) expect(x.alasan).toMatch(/nomor invoice|nama pelanggan|satu-satunya/);
  });
});

describe("aturan", () => {
  const inv: InvoiceTerbuka[] = [
    { id: "a", nomor: "001/INV/XI/2026", pelanggan: "CV Maju Jaya", total: 500_000, tanggal: "2026-11-01", jatuh_tempo: "2026-11-15" },
    { id: "b", nomor: "002/INV/XI/2026", pelanggan: "Toko Berkah", total: 750_000, tanggal: "2026-11-01", jatuh_tempo: "2026-11-15" },
  ];
  const m = (keterangan: string, jumlah: number, tanggal = "2026-11-05", arah: "CR" | "DB" = "CR"): Mutasi => ({ tanggal, keterangan, jumlah, arah });
  it("nama disingkat tidak dianggap cocok; nama lengkap cocok", () => {
    expect(cocokkan([m("TRSF CR CV MAJU JY", 400_000)], inv)[0].invoice).toBeUndefined();
    expect(cocokkan([m("TRSF CR MAJU JAYA", 500_000)], inv)[0]).toMatchObject({ invoice: "a", alasan: "nama pelanggan dan nominal sama" });
  });
  it("kurang lebih dari Rp10.000 walau bernomor: tidak cocok", () => {
    expect(cocokkan([m("TRSF CR 001/INV/XI/2026", 489_000)], inv)[0].invoice).toBeUndefined();
    expect(cocokkan([m("TRSF CR 001/INV/XI/2026", 491_000)], inv)[0].invoice).toBe("a");
  });
  it("debit, tanggal sebelum invoice, dan QRIS settlement tidak pernah dicocokkan", () => {
    expect(cocokkan([m("TRSF 001/INV/XI/2026", 500_000, "2026-11-05", "DB"), m("TRSF CR 001/INV/XI/2026", 500_000, "2026-10-30"), m("QRIS SETTLEMENT", 750_000)], inv).map((x) => x.invoice))
      .toEqual([undefined, undefined, undefined]);
  });
  it("merah sengaja: nominal unik tanpa syarat transfer akan mencocokkan setoran tunai", () => {
    expect(cocokkan([m("SETORAN TUNAI", 750_000)], inv)[0].invoice).toBeUndefined();
    expect(cocokkan([m("TRSF E-BANKING CR 0123456789", 750_000)], inv)[0]).toMatchObject({ invoice: "b", alasan: "nominal sama, satu-satunya tagihan sebesar itu" });
  });
});

describe("uraiMutasiCsv", () => {
  it("CSV korpus lama: 15 baris, angka dan tanggal benar", () => {
    const r = uraiMutasiCsv(readFileSync(join(akar, "mutasi", "mutasi-01.csv"), "utf8"));
    expect("baris" in r && r.baris).toHaveLength(15);
    expect("baris" in r && r.baris[1]).toEqual({ tanggal: "2026-10-09", keterangan: "TRSF E-BANKING CR KAFE SENJA INV/2026/X/0017", jumlah: 1_240_000, arah: "CR" });
  });
  it("kolom Debit/Kredit terpisah, titik ribuan dan koma desimal, titik koma", () => {
    const r = uraiMutasiCsv("Tgl;Uraian;Debit;Kredit\n2026-11-05;TRSF CR TOKO BERKAH;;1.250.000,00\n06-11-2026;BIAYA ADM;12.500,00;\n");
    expect("baris" in r && r.baris).toEqual([
      { tanggal: "2026-11-05", keterangan: "TRSF CR TOKO BERKAH", jumlah: 1_250_000, arah: "CR" },
      { tanggal: "2026-11-06", keterangan: "BIAYA ADM", jumlah: 12_500, arah: "DB" },
    ]);
  });
  it("kolom wajib tidak ada: galat jelas", () => {
    expect(uraiMutasiCsv("Nama,Alamat\nBudi,Denpasar\n")).toEqual({ galat: "Kolom tanggal, keterangan, dan jumlah tidak ditemukan. Unggah CSV mutasi dari internet banking." });
  });
});
