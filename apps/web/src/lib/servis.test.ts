import { describe, expect, test } from "vitest";
import { langkahServis, pesanStatusServis } from "./servis";

describe("servis", () => {
  test("pesan WhatsApp berisi nomor, barang, status, tautan", () => {
    expect(pesanStatusServis({ pelanggan: "Andi", nomor: "001/SRV/XI/2026", item: "Honda Beat", usaha: "Bengkel Jaya", status: "selesai", url: "https://x/servis/ABC" }))
      .toBe("Halo Andi, order 001/SRV/XI/2026 (Honda Beat) di Bengkel Jaya: selesai, siap diambil. Cek status kapan saja: https://x/servis/ABC");
  });
  test("langkah status", () => {
    expect([langkahServis("diterima"), langkahServis("selesai"), langkahServis("diambil"), langkahServis("batal")]).toEqual([0, 2, 3, -1]);
  });
});
