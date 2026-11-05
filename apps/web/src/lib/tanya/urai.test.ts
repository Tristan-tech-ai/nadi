import { describe, expect, it } from "vitest";
import { HARI_KORPUS, KORPUS } from "./korpus";
import { rentang, uraiTanya } from "./urai";

describe("korpus 50 pertanyaan", () => {
  it("berisi 50 pertanyaan", () => expect(KORPUS).toHaveLength(50));
  it(">= 90% diurai benar (niat, rentang, nama barang)", () => {
    const salah = KORPUS.filter(([q, harap]) => JSON.stringify(uraiTanya(q, HARI_KORPUS)) !== JSON.stringify(harap))
      .map(([q, harap]) => ({ q, harap, dapat: uraiTanya(q, HARI_KORPUS) }));
    const benar = KORPUS.length - salah.length;
    console.log(`KORPUS_TANYA benar ${benar}/${KORPUS.length}`, salah.length ? JSON.stringify(salah) : "");
    expect(benar / KORPUS.length).toBeGreaterThanOrEqual(0.9);
  });
  it("pertanyaan pendapat atau sebab tidak pernah dijawab dengan angka", () => {
    for (const [q, harap] of KORPUS) if (harap === null) expect(uraiTanya(q, HARI_KORPUS), q).toBeNull();
  });
});

describe("rentang", () => {
  it("Januari: bulan lalu = Desember tahun lalu; bulan di depan = tahun lalu", () => {
    expect(rentang(" bulan lalu ", "2027-01-15")).toEqual({ dari: "2026-12-01", sampai: "2026-12-31" });
    expect(rentang(" desember ", "2026-11-06")).toEqual({ dari: "2025-12-01", sampai: "2025-12-31" });
    expect(rentang(" februari 2028 ", "2028-03-01")).toEqual({ dari: "2028-02-01", sampai: "2028-02-29" });
  });
  it("minggu dimulai Senin", () => {
    expect(rentang(" minggu ini ", "2026-11-08")).toEqual({ dari: "2026-11-02", sampai: "2026-11-08" });
  });
});
