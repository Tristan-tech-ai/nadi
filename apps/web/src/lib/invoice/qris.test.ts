import { describe, expect, it } from "vitest";
import { crc16, tlv, uraiQris } from "./qris";

// QRIS sintetis (bukan merchant nyata): objek EMV MPM disusun dengan tlv lalu CRC dihitung atas "...6304".
const susun = (objek: [string, string][]) => {
  const tanpaCrc = objek.map(([id, v]) => tlv(id, v)).join("") + "6304";
  return tanpaCrc + crc16(tanpaCrc);
};
const DASAR: [string, string][] = [
  ["00", "01"], ["01", "11"],
  ["51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1026000000001") + tlv("03", "UMI")],
  ["52", "5812"], ["53", "360"], ["58", "ID"], ["59", "WARUNG UJI NADI"], ["60", "DENPASAR"],
];

describe("crc16 (ISO/IEC 13239, polinomial 1021, awal FFFF)", () => {
  it("nilai periksa baku CRC-16/CCITT-FALSE untuk '123456789' = 29B1", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("uraiQris", () => {
  it("QRIS statis sah: nama, kota, NMID terbaca", () => {
    const h = uraiQris(susun(DASAR));
    expect(h).toEqual({ ok: true, nama: "WARUNG UJI NADI", kota: "DENPASAR", nmid: "ID1026000000001" });
  });
  it("tanpa ID 01 tetap dianggap statis", () => {
    expect(uraiQris(susun(DASAR.filter(([id]) => id !== "01"))).ok).toBe(true);
  });
  it("CRC salah (satu huruf diubah) ditolak", () => {
    const p = susun(DASAR).replace("DENPASAR", "DENPASIR");
    expect(uraiQris(p)).toMatchObject({ ok: false, galat: expect.stringMatching(/rusak/) });
  });
  it("QR dinamis (01 = 12) atau sudah bernominal (ID 54) ditolak: hanya berlaku sekali", () => {
    expect(uraiQris(susun(DASAR.map(([id, v]) => [id, id === "01" ? "12" : v] as [string, string])))).toMatchObject({ ok: false, galat: expect.stringMatching(/sekali/) });
    expect(uraiQris(susun([...DASAR.slice(0, 5), ["54", "25000"], ...DASAR.slice(5)]))).toMatchObject({ ok: false, galat: expect.stringMatching(/sekali/) });
  });
  it("bukan QRIS rupiah Indonesia ditolak", () => {
    expect(uraiQris(susun(DASAR.map(([id, v]) => [id, id === "58" ? "HK" : v] as [string, string]))).ok).toBe(false);
    expect(uraiQris(susun(DASAR.map(([id, v]) => [id, id === "53" ? "344" : v] as [string, string]))).ok).toBe(false);
    expect(uraiQris("https://contoh.id/bayar").ok).toBe(false);
    expect(uraiQris("").ok).toBe(false);
  });
  it("panjang objek yang melewati akhir teks ditolak, bukan dibaca sebagian", () => {
    expect(uraiQris("000201015911").ok).toBe(false);
  });
});
