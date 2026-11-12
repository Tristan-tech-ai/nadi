import type { JenisZona } from "./resep";

export type TeksJenisZona = { meja: string; antrean: string; rak: string; kasir: string; pintu: string; lorong: string; posKerja: string };

/** Q-45: label pendek jenis zona di daftar zona Mata. */
export function labelJenisZona(jenis: JenisZona, t: TeksJenisZona): string {
  switch (jenis) {
    case "meja": return t.meja;
    case "antrean": return t.antrean;
    case "kasir": return t.kasir;
    case "pintu": return t.pintu;
    case "lorong": return t.lorong;
    case "kerja": return t.posKerja;
    default: return t.rak;
  }
}
