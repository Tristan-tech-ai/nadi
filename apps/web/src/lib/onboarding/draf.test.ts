import { describe, expect, it } from "vitest";
import { CONTOH_TEKS_NADI } from "./prompt";
import { uraiTeksNadi } from "./teks-nadi";
import { barisDariButir, nilaiIsian, urutkan, type BarisDraf } from "./draf";

describe("draf AI", () => {
  it("Teks Nadi contoh menjadi 8 orang, 1 profil usaha, 2 aturan izin; fitur inti tidak menjadi baris", () => {
    const b = barisDariButir(uraiTeksNadi(CONTOH_TEKS_NADI, "2026-11-06").butir);
    expect(b.filter((x) => x.bagian === "orang")).toHaveLength(8);
    expect(b.filter((x) => x.bagian === "usaha")).toHaveLength(1);
    expect(b.filter((x) => x.bagian === "izin")).toHaveLength(2);
    expect(b.filter((x) => x.bagian === "fitur")).toHaveLength(0);
    expect(b.find((x) => x.bagian === "orang")?.nilai).toEqual({ nama: "Sari Dewi", jabatan: "kasir, pelayan", mulai: "2024-03-01" });
  });
  it("fitur Stok, Mata, Penjualan menjadi modul menu", () => {
    const b = barisDariButir(uraiTeksNadi("NADI ONBOARDING 1\nFITUR: Stok, Mata, Peta usaha, Penjualan, Gaji", "2026-11-06").butir);
    expect(b.map((x) => x.nilai.modul).sort()).toEqual(["crm", "mata", "stok"]);
  });
  it("isian angka dan ya/tidak, urutan perlu dicek di atas", () => {
    expect(nilaiIsian("angka", "Rp3.500.000")).toBe(3500000);
    expect(nilaiIsian("angka", "")).toBeNull();
    expect(nilaiIsian("ya", "true")).toBe(true);
    const r = (id: string, bagian: BarisDraf["bagian"], ragu: string | null) => ({ id, bagian, ragu, nilai: {}, peka: false, centang: !ragu, keyakinan: null, alasan: null });
    expect(urutkan([r("a", "orang", null), r("b", "usaha", "x"), r("c", "gaji", null)]).map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});
