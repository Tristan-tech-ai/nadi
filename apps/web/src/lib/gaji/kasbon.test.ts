import { describe, expect, it } from "vitest";
import { cicilanKasbon } from "./kasbon";
import type { Komponen } from "./susun";

const k = (kode: string, jenis: Komponen["jenis"], nilai: number): Komponen => ({ kode, label: kode, jenis, nilai, sumber: "uji" });

describe("cicilan kasbon di slip (M-10B, PP 36/2021 Pasal 63 dan 65)", () => {
  it("jumlah cicilan semua kasbon, masing-masing paling banyak sisanya", () => {
    const r = cicilanKasbon([k("pokok", "pendapatan", 3_000_000)], [{ cicilan: 400_000, sisa: 1_000_000 }, { cicilan: 100_000, sisa: 50_000 }]);
    expect(r).toMatchObject({ dibatasi: false, diminta: 450_000, komponen: { kode: "kasbon", jenis: "potongan", nilai: 450_000 } });
  });
  it("dibatasi 50% pendapatan dikurangi potongan Pasal 63 lain; pajak dan BPJS tidak dihitung", () => {
    const slip = [k("pokok", "pendapatan", 3_000_000), k("denda", "potongan", 1_200_000), k("pph21", "potongan", 900_000), k("jht", "potongan", 60_000)];
    expect(cicilanKasbon(slip, [{ cicilan: 500_000, sisa: 2_000_000 }])).toMatchObject({ dibatasi: true, diminta: 500_000, komponen: { nilai: 300_000 } });
  });
  it("tanpa ruang tersisa atau tanpa kasbon: tidak ada komponen", () => {
    expect(cicilanKasbon([k("pokok", "pendapatan", 2_000_000), k("denda", "potongan", 1_000_000)], [{ cicilan: 100_000, sisa: 100_000 }])).toMatchObject({ komponen: null, dibatasi: true });
    expect(cicilanKasbon([k("pokok", "pendapatan", 2_000_000)], [])).toMatchObject({ komponen: null, dibatasi: false });
  });
});
