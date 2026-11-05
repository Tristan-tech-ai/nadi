import { describe, expect, it } from "vitest";
import { rincian } from "./rincian-usulan";

const p = (aksi: string, bidang: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({ aksi, bidang, baris: null, atas: {}, sebelum: {}, lewati: [], nama: {}, ...extra });

describe("rincian usulan (U-13)", () => {
  it("aturan izin: sebelum -> sesudah per nilai, tanpa JSON", () => {
    const r = rincian(p("onboarding.izin", { jenis: "cuti", otomatis: true, maks_hari: 2 }, { sebelum: { jenis: "cuti", otomatis: false, maks_hari: 0 } }));
    expect(r.ubah).toContainEqual({ label: "Disetujui otomatis", sebelum: "Tidak", sesudah: "Ya" });
    expect(r.ubah).toContainEqual({ label: "Otomatis sampai (hari)", sebelum: "0", sesudah: "2" });
    expect(r.isi).toEqual([["Jenis", "cuti"]]);
  });
  it("aturan yang belum ada disebut belum diatur", () => {
    expect(rincian(p("onboarding.izin", { jenis: "sakit", otomatis: true })).ubah[0].sebelum).toBe("belum diatur");
  });
  it("impor orang: yang sudah ada dilewati, yang baru ditambah; id tidak tampil", () => {
    const r = rincian(p("orang.impor", { baris: [{ id: "", nama: "Budi Lama", jabatan: "kasir" }, { id: "", nama: "Sari", jabatan: "koki", mulai: "2025-01-15" }] }, { lewati: ["budi lama"] }));
    expect(r.lewati).toEqual(["budi lama"]);
    expect(r.tambah).toHaveLength(1);
    expect(r.tambah[0]).toEqual({ judul: "Sari", isi: [["Nama", "Sari"], ["Topi", "koki"], ["Mulai", "2025-01-15"]] });
  });
  it("tagihan: rupiah ditulis rapi, baris barang ditambah", () => {
    const r = rincian(p("uang.tagihan", { penjual: "PT Kopi", nomor: "INV/7", total: 2934000, baris: [{ nama: "Kopi 1 kg", qty: 5, harga: 127000, jumlah: 635000 }] }));
    expect(r.isi).toContainEqual(["Total", "Rp2.934.000"]);
    expect(r.tambah[0].isi).toContainEqual(["Jumlah", "Rp635.000"]);
  });
  it("hitung stok: jumlah barang bukan rupiah, sebelum dari stok sekarang", () => {
    const r = rincian(p("stok.opname", { baris: [{ kode: "KP-20", nama: "Kopi", jumlah: 31 }] }, { sebelum: { "KP-20": 28 } }));
    expect(r.ubah).toEqual([{ label: "Kopi (KP-20)", sebelum: "28", sesudah: "31" }]);
  });
  it("izin: orang ditulis dengan namanya, bukan id", () => {
    const r = rincian(p("izin.setujui", {}, { bidang: null, atas: { jenis: "sakit", hari: 1, orang_id: "o1" }, nama: { o1: "Sari Dewi" } }));
    expect(r.isi).toContainEqual(["Orang", "Sari Dewi"]);
    expect(r.isi.some(([, v]) => v === "o1")).toBe(false);
  });
});
