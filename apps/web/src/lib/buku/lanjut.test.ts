import { describe, expect, test } from "vitest";
import { angkaValuta, bacaGrup, barisBerulang, bulanKeTanggal, keRupiah, kursBerlaku, type Kurs } from "./lanjut";

// Kurs pajak KMK Nomor 53/MK/EF.2/2026 (berlaku 4-10 Nov 2026), sama dengan isi migrasi akuntansi_lanjutan.
const resmi = (valuta: string, kurs: number, per = 1): Kurs => ({ valuta, kurs, per, sumber: "KMK 53/MK/EF.2/2026", berlaku_dari: "2026-11-04", berlaku_sampai: "2026-11-10", resmi: true });

describe("kurs", () => {
  test("kurs resmi berlaku di dalam masa berlakunya saja", () => {
    const m = kursBerlaku([resmi("USD", 18141)], "2026-11-05");
    expect(m.get("USD")?.kurs).toBe(18141);
    expect(kursBerlaku([resmi("USD", 18141)], "2026-11-11").get("USD")).toBeUndefined();
  });
  test("kurs usaha yang lebih baru menang; seri tanggal: kurs usaha menang", () => {
    const usaha: Kurs = { valuta: "USD", kurs: 18200, per: 1, sumber: "bank", berlaku_dari: "2026-11-05", berlaku_sampai: null, resmi: false };
    expect(kursBerlaku([resmi("USD", 18141), usaha], "2026-11-06").get("USD")?.kurs).toBe(18200);
    expect(kursBerlaku([resmi("USD", 18141), usaha], "2026-11-04").get("USD")?.kurs).toBe(18141);
    expect(kursBerlaku([resmi("USD", 18141), { ...usaha, berlaku_dari: "2026-11-04" }], "2026-11-05").get("USD")?.kurs).toBe(18200);
  });
  test("ke rupiah: USD per 1, JPY per 100 yen", () => {
    expect(keRupiah(7350, { kurs: 18141, per: 1 })).toBe(133336350);
    expect(keRupiah(10000, { kurs: 11502.49, per: 100 })).toBe(1150249);
    expect(keRupiah(-1, { kurs: 18141, per: 1 })).toBeNull();
  });
  test("isian jumlah valuta", () => {
    expect(angkaValuta("12.500,50")).toBe(12500.5);
    expect(angkaValuta("12,500.50")).toBe(12500.5);
    expect(angkaValuta("7350")).toBe(7350);
    expect(angkaValuta("7,35")).toBe(7.35);
    expect(angkaValuta("abc")).toBeNull();
  });
});

describe("isian lain", () => {
  test("bulan ke tanggal", () => {
    expect(bulanKeTanggal("2026-11")).toBe("2026-11-01");
    expect(bulanKeTanggal("2026-13")).toBeNull();
  });
  test("jurnal berulang dua baris seimbang", () => {
    expect(barisBerulang("6-200", "1-110", 1500000)).toEqual([{ akun: "6-200", debit: 1500000 }, { akun: "1-110", kredit: 1500000 }]);
    expect(barisBerulang("6-200", "6-200", 1)).toBeNull();
    expect(barisBerulang("6-200", "1-110", 0)).toBeNull();
  });
  test("grup konsolidasi dari parameter", () => {
    const a = "01a1a977-ae27-70a9-b24d-00f8b2731850";
    const b = "01a1a977-ae29-76f3-ae3a-9d700a075623";
    expect(bacaGrup(`${a},${b},${a},bukan-id`)).toEqual([a, b]);
    expect(bacaGrup(undefined)).toEqual([]);
  });
});
