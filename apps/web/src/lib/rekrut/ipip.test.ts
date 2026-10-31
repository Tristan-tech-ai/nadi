import { describe, expect, it } from "vitest";
import { IPIP_50 } from "./ipip-50";
import { skorIpip } from "./ipip";

const semua = (n: number) => Object.fromEntries(IPIP_50.map((b) => [b.no, n]));

describe("IPIP 50 butir", () => {
  it("10 butir per faktor dengan jumlah kunci sesuai halaman kunci resmi", () => {
    const hitung = (f: number, k: string) => IPIP_50.filter((b) => b.faktor === f && b.kunci === k).length;
    expect([1, 2, 3, 4, 5].map((f) => [hitung(f, "+"), hitung(f, "-")])).toEqual([[5, 5], [6, 4], [6, 4], [2, 8], [7, 3]]);
    expect(new Set(IPIP_50.map((b) => b.no)).size).toBe(50);
  });
});

describe("skorIpip", () => {
  it("semua 'sangat sesuai': butir + bernilai 5, butir - bernilai 1", () => {
    // E 5x5+5x1=30, A 6x5+4x1=34, C 34, ES 2x5+8x1=18, I 7x5+3x1=38
    expect(skorIpip(semua(5))).toEqual({ 1: 30, 2: 34, 3: 34, 4: 18, 5: 38 });
    expect(skorIpip(semua(1))).toEqual({ 1: 30, 2: 26, 3: 26, 4: 42, 5: 22 });
    expect(skorIpip(semua(3))).toEqual({ 1: 30, 2: 30, 3: 30, 4: 30, 5: 30 });
  });
  it("butir 1 (+, ekstraversi) dan butir 6 (-, ekstraversi)", () => {
    const j = semua(3);
    j[1] = 5;
    j[6] = 5;
    expect(skorIpip(j)[1]).toBe(30 + 2 - 2);
    j[6] = 1;
    expect(skorIpip(j)[1]).toBe(30 + 2 + 2);
  });
  it("faktor dengan butir kosong atau di luar 1..5 bernilai null, faktor lain tetap dihitung", () => {
    const j = semua(3);
    delete j[4];
    j[5] = 7;
    expect(skorIpip(j)).toEqual({ 1: 30, 2: 30, 3: 30, 4: null, 5: null });
  });
});
