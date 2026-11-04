import { describe, expect, it } from "vitest";
import { csvKeBaris, kunciKiriman, uraiKiriman } from "./urai";

describe("urai kiriman pintu data (W-08)", () => {
  it("JSON berjenis dan larik dengan ?jenis=", () => {
    const a = uraiKiriman("application/json", JSON.stringify({ jenis: "penjualan", baris: [{ tanggal: "2026-11-04", jumlah: 54000 }] }), null);
    expect(a).toEqual({ ok: true, kiriman: { jenis: "penjualan", baris: [{ tanggal: "2026-11-04", jumlah: 54000 }] } });
    const b = uraiKiriman("application/json", JSON.stringify([{ tanggal: "2026-11-04", jumlah: 1, arah: "CR" }]), "mutasi");
    expect(b.ok && b.kiriman.jenis).toBe("mutasi");
  });

  it("CSV titik koma dengan judul alias, kutip, dan BOM", () => {
    const b = csvKeBaris("﻿Order_ID;Customer;Item;Qty;Price\nSHP-9;\"Rina; Bu\";Keripik;2;18000\n", "pesanan");
    expect(b).toEqual([{ nomor: "SHP-9", pelanggan: "Rina; Bu", uraian: "Keripik", jumlah: "2", harga: "18000" }]);
  });

  it("CSV lewat uraiKiriman butuh ?jenis= dan judul yang dikenal", () => {
    expect(uraiKiriman("text/csv", "tanggal,jumlah\n2026-11-04,5000", null)).toMatchObject({ ok: false });
    expect(uraiKiriman("text/csv", "a,b\n1,2", "penjualan")).toMatchObject({ ok: false, galat: expect.stringContaining("tanggal, nomor") });
    expect(uraiKiriman("text/csv; charset=utf-8", "Date,Amount,Payment\n2026-11-04,5000,tunai", "penjualan"))
      .toEqual({ ok: true, kiriman: { jenis: "penjualan", baris: [{ tanggal: "2026-11-04", jumlah: "5000", metode: "tunai" }] } });
  });

  it("menolak JSON rusak, jenis asing, dan tanpa baris", () => {
    expect(uraiKiriman("application/json", "{rusak", null)).toMatchObject({ ok: false });
    expect(uraiKiriman("application/json", JSON.stringify({ jenis: "gaji", baris: [] }), null)).toMatchObject({ ok: false });
    expect(uraiKiriman("application/json", JSON.stringify({ jenis: "penjualan" }), null)).toMatchObject({ ok: false });
  });

  it("kunci kiriman stabil: header menang, isi sama = kunci sama", () => {
    const k = { jenis: "penjualan" as const, baris: [{ tanggal: "2026-11-04", jumlah: 1 }] };
    expect(kunciKiriman(null, k)).toBe(kunciKiriman(null, { ...k }));
    expect(kunciKiriman("abc", k)).toBe(kunciKiriman("abc", { ...k, baris: [] }));
    expect(kunciKiriman("abc", k)).not.toBe(kunciKiriman(null, k));
    expect(kunciKiriman(null, k)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
