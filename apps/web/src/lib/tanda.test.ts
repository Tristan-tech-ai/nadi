import { describe, expect, test } from "vitest";
import { nomorWa, sidikTeks, uraiPenanda } from "./tanda";

describe("penanda tangan", () => {
  test("baris nama, nomor berurutan", () => {
    expect(uraiPenanda("Rina Wulandari, 0812-1111-2222\n\nBagus  Pratama\nPT Maju, Tbk")).toEqual([
      { nama: "Rina Wulandari", kontak: "0812-1111-2222" },
      { nama: "Bagus Pratama", kontak: null },
      { nama: "PT Maju, Tbk", kontak: null },
    ]);
  });
  test("nomor WhatsApp", () => {
    expect(nomorWa("0812-1111-2222")).toBe("6281211112222");
    expect(nomorWa("12")).toBeNull();
  });
});

describe("sidik dokumen", () => {
  test("SHA-256 UTF-8 sama dengan database; satu huruf berbeda = sidik berbeda", async () => {
    // Nilai pembanding: echo -n "Harga Rp45.000 per kg." | sha256sum
    const a = await sidikTeks("Harga Rp45.000 per kg.");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await sidikTeks("Harga Rp40.000 per kg.")).not.toBe(a);
    expect(await sidikTeks("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
