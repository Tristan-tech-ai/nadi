import { describe, expect, it } from "vitest";
import { modulNyala } from "@/lib/fitur-usaha";
import { cookieMulai, langkahMulai, MAKS_LANGKAH, type Fakta } from "@/lib/mulai";

const KOSONG: Fakta = { berkas: 0, orang: 0, produk: 0, invoice: 0, ai: 0, staf: 0, servis: 0, janji: 0 };

describe("Mulai di Nadi (U-05)", () => {
  it("langkah mengikuti paket: toko dapat barang, bengkel dapat servis, kantor tanpa barang", () => {
    const id = (industri: string) => langkahMulai(modulNyala(industri, null), KOSONG).map((l) => l.id);
    expect(id("toko")).toEqual(["lempar", "orang", "produk", "invoice", "ai", "staf"]);
    expect(id("bengkel")).toContain("servis");
    expect(id("kantor")).not.toContain("produk");
    expect(id("salon")).toContain("janji");
  });
  it("5 sampai 7 langkah untuk setiap paket", () => {
    for (const p of ["toko", "fnb", "salon", "laundry", "bengkel", "klinik", "kantor", "konstruksi", "logistik", "hotel", "produksi", "pertanian", "pendidikan"]) {
      const n = langkahMulai(modulNyala(p, null), KOSONG).length;
      expect(n, p).toBeGreaterThanOrEqual(5);
      expect(n, p).toBeLessThanOrEqual(MAKS_LANGKAH);
    }
    expect(langkahMulai(modulNyala(null, null), KOSONG).length).toBe(MAKS_LANGKAH);
  });
  it("dicentang dari data, bukan dari klik", () => {
    const l = langkahMulai(modulNyala("toko", null), { ...KOSONG, orang: 3, invoice: 1 });
    expect(l.filter((x) => x.selesai).map((x) => x.id)).toEqual(["orang", "invoice"]);
  });
  it("pilihan pemilik menimpa paket: stok dimatikan, langkah barang hilang", () => {
    expect(langkahMulai(modulNyala("toko", { stok: false }), KOSONG).map((l) => l.id)).not.toContain("produk");
  });
  it("cookie per usaha", () => {
    expect(cookieMulai("0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b")).toBe("nadi_mulai_0193a1b2c3d47e5f8a9b0c1d2e3f4a5b");
  });
});
