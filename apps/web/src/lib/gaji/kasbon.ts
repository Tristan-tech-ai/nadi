import type { Komponen } from "./susun";

/** Potongan Pasal 63 PP 36/2021 yang dihitung dalam batas 50% Pasal 65 (pajak dan BPJS tidak termasuk). */
export const KODE_PASAL63 = ["kasbon", "denda", "ganti_rugi", "sewa", "utang", "kelebihan_bayar"] as const;

export type KasbonAktif = { cicilan: number; sisa: number };

/**
 * Komponen cicilan kasbon untuk satu slip (M-10B): jumlah cicilan semua kasbon yang belum lunas (masing-masing paling banyak
 * sisanya), lalu dibatasi agar semua potongan Pasal 63 tidak melebihi 50% pendapatan slip (PP 36/2021 Pasal 65).
 * Database mengulang kedua pemeriksaan; fungsi ini hanya menyusun angka yang lolos.
 */
export function cicilanKasbon(komponen: Komponen[], kasbon: KasbonAktif[]): { komponen: Komponen | null; dibatasi: boolean; diminta: number } {
  const diminta = kasbon.reduce((s, k) => s + Math.max(0, Math.min(k.cicilan, k.sisa)), 0);
  if (diminta <= 0) return { komponen: null, dibatasi: false, diminta: 0 };
  const pendapatan = komponen.filter((k) => k.jenis === "pendapatan").reduce((s, k) => s + k.nilai, 0);
  const lain = komponen.filter((k) => k.jenis === "potongan" && (KODE_PASAL63 as readonly string[]).includes(k.kode)).reduce((s, k) => s + k.nilai, 0);
  const ruang = Math.max(0, Math.floor(pendapatan * 0.5) - lain);
  const nilai = Math.min(diminta, ruang);
  if (nilai <= 0) return { komponen: null, dibatasi: true, diminta };
  return {
    komponen: { kode: "kasbon", label: "Cicilan kasbon", jenis: "potongan", nilai, sumber: "PP 36/2021 Pasal 63 ayat (1) huruf c" },
    dibatasi: nilai < diminta,
    diminta,
  };
}
