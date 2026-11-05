import { describe, expect, test } from "vitest";
import { bacaAntrean, cari, kurangi, simpanAntrean, tambah, totalKeranjang, type Produk } from "./kasir";

const kopi: Produk = { id: "a", kode: "KOPI-1", nama: "Kopi bubuk 100 g", harga: 15000, satuan: "bks", barcode: "8991234567890", jenis: "barang", stok: 10 };
const gula: Produk = { id: "b", kode: "GULA-1", nama: "Gula 1 kg", harga: 18000, satuan: "kg", barcode: null, jenis: "barang", stok: 5 };

describe("keranjang", () => {
  test("tambah, kurangi, total", () => {
    let k = tambah([], kopi);
    k = tambah(k, kopi);
    k = tambah(k, gula);
    expect(totalKeranjang(k)).toBe(48000);
    k = kurangi(k, "a");
    expect(k.find((b) => b.produk === "a")?.jumlah).toBe(1);
    k = kurangi(kurangi(k, "a"), "b");
    expect(k).toEqual([]);
  });
  test("cari: barcode persis menang, lalu nama", () => {
    expect(cari([kopi, gula], "8991234567890")).toEqual([kopi]);
    expect(cari([kopi, gula], "gula")).toEqual([gula]);
    expect(cari([kopi, gula], "  ")).toHaveLength(2);
  });
});

describe("antrean luring", () => {
  test("simpan dan baca; isi rusak = kosong", () => {
    const m = new Map<string, string>();
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    simpanAntrean(s, [{ kunci: "k1", shift: "s", waktu: "2026-11-06T01:00:00Z", baris: [{ produk: "a", jumlah: 2 }], bayar: "tunai", diterima: 50000, total: 30000 }]);
    expect(bacaAntrean(s)).toHaveLength(1);
    m.set("nadi-kasir-antrean", "{rusak");
    expect(bacaAntrean(s)).toEqual([]);
  });
});
