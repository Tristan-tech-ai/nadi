import { describe, expect, it } from "vitest";
import { bacaPengecualian, bagiSisaTerbesar, bulanKolam, csvKolam, namaBerkasKolam, rupiahIsian, type BarisKolam } from "./kolam";

describe("bagi sisa terbesar", () => {
  it("Rp1.000.000 untuk 3 orang poin sama: 333.334 untuk id terkecil, jumlah persis", () => {
    const h = bagiSisaTerbesar(1_000_000, [
      { id: "c", poin: 3 },
      { id: "a", poin: 3 },
      { id: "b", poin: 3 },
    ]);
    expect(h).toEqual(new Map([["a", 333_334], ["b", 333_333], ["c", 333_333]]));
    expect([...h.values()].reduce((s, x) => s + x, 0)).toBe(1_000_000);
  });

  it("poin pecahan: sisa ke pecahan terbesar dulu, bukan ke id terkecil", () => {
    // 100 x 1,5/4 = 37,5; 100 x 2/4 = 50; 100 x 0,5/4 = 12,5 -> sisa 1 ke pecahan terbesar (seri 0,5): id terkecil di antara keduanya.
    const h = bagiSisaTerbesar(100, [
      { id: "b", poin: 1.5 },
      { id: "a", poin: 2 },
      { id: "c", poin: 0.5 },
    ]);
    expect(h.get("a")).toBe(50);
    expect(h.get("b")).toBe(38);
    expect(h.get("c")).toBe(12);
    // 10 / 7 poin: 1,43 + 2,86 + 5,71 -> 1 + 2 + 5 = 8, sisa 2 ke pecahan 0,86 dan 0,71.
    const g = bagiSisaTerbesar(10, [{ id: "x", poin: 1 }, { id: "y", poin: 2 }, { id: "z", poin: 4 }]);
    expect([g.get("x"), g.get("y"), g.get("z")]).toEqual([1, 3, 6]);
  });

  it("jumlah selalu persis untuk kolam besar dan banyak orang", () => {
    const peserta = Array.from({ length: 37 }, (_, i) => ({ id: `o${String(i).padStart(2, "0")}`, poin: ((i * 7) % 11) + 0.5 }));
    for (const kolam of [1, 7, 999_999, 12_345_678, 9_999_999_999]) {
      const h = bagiSisaTerbesar(kolam, peserta);
      expect([...h.values()].reduce((s, x) => s + x, 0)).toBe(kolam);
      expect([...h.values()].every((x) => Number.isInteger(x) && x >= 0)).toBe(true);
    }
  });

  it("tanpa peserta atau poin nol: kosong", () => {
    expect(bagiSisaTerbesar(1_000_000, []).size).toBe(0);
    expect(bagiSisaTerbesar(1_000_000, [{ id: "a", poin: 0 }]).size).toBe(0);
  });
});

const BARIS: BarisKolam[] = [
  { orang_id: "1", nama: 'Sari "Ucok", Kasir', id_staf: "S-001", poin: 3, persen: 33.3, rupiah: 333_334, kerja_n: 3 },
  { orang_id: "2", nama: "Budi", id_staf: null, poin: 1.5, persen: 16.7, rupiah: 166_666, kerja_n: 1 },
  { orang_id: "3", nama: "=HYPERLINK(\"x\")", id_staf: "S-003", poin: 4.5, persen: 50, rupiah: 500_000, kerja_n: 2 },
];

describe("CSV kolam", () => {
  it("kolom tetap, rupiah tanpa titik ribuan, koma dan tanda kutip aman, sel rumus dinetralkan", () => {
    const csv = csvKolam(BARIS, { bulan: "2026-10", namaBulan: "Oktober 2026" });
    expect(csv.startsWith("﻿")).toBe(true);
    const baris = csv.slice(1).split("\r\n");
    expect(baris[0]).toBe("orang,id_staf,poin,persen,rupiah,sumber");
    expect(baris[1]).toBe('"Sari ""Ucok"", Kasir",S-001,3,33.3,333334,Insentif beban kerja Oktober 2026: 3 kerja selesai (PP 36/2021 Pasal 8 dan 10)');
    expect(baris[2]).toBe('Budi,,1.5,16.7,166666,Insentif beban kerja Oktober 2026: 1 kerja selesai (PP 36/2021 Pasal 8 dan 10)');
    expect(baris[3].startsWith(`"'=HYPERLINK(""x"")",S-003,4.5,50,500000,`)).toBe(true);
    expect(baris).toHaveLength(4);
  });

  it("nama berkas memuat bulan", () => {
    expect(namaBerkasKolam("2026-10")).toBe("kolam-insentif-beban-2026-10.csv");
  });
});

describe("isian", () => {
  it("rupiah dari ketikan bebas", () => {
    expect(rupiahIsian("Rp1.000.000")).toBe(1_000_000);
    expect(rupiahIsian(" 250000 ")).toBe(250_000);
    expect(rupiahIsian("")).toBeNull();
    expect(rupiahIsian("0")).toBeNull();
    expect(rupiahIsian("99999999999")).toBeNull();
  });

  it("bulan YYYY-MM sah atau cadangan", () => {
    expect(bulanKolam("2026-09", "2026-11")).toBe("2026-09");
    expect(bulanKolam("2026-13", "2026-11")).toBe("2026-11");
    expect(bulanKolam(undefined, "2026-11")).toBe("2026-11");
  });

  it("pengecualian dari parameter: id sah dan alasan 3 sampai 300 huruf", () => {
    const id = "0193a1b2-0000-7000-8000-000000000001";
    expect(bacaPengecualian([`${id}~Cuti panjang`, "bukan-id~x", `${id}~ok`])).toEqual([{ orang_id: id, alasan: "Cuti panjang" }]);
    expect(bacaPengecualian(`${id}~  Sakit   sebulan `)).toEqual([{ orang_id: id, alasan: "Sakit sebulan" }]);
    expect(bacaPengecualian(undefined)).toEqual([]);
  });
});
