// Harga bertingkat dan atribut varian (M-02B). Disimpan di produk.harga_tingkat ([{min, harga}]) dan produk.atribut ({kunci: nilai}).
// Dipakai formulir produk (isian teks ramah) dan pemilih produk di invoice: memilih produk atau mengubah jumlah mengisi harga
// tingkat yang berlaku. Harga tetap bisa diubah tangan; database menyimpan harga baris apa adanya.

export type Tingkat = { min: number; harga: number };

const angkaRp = (s: string) => {
  const t = s.replace(/^\s*rp\s*/i, "").replace(/\./g, "").replace(/\s/g, "");
  return /^\d+$/.test(t) ? Number(t) : NaN;
};

/** "10:14.000, 50:13.500" atau "10 = 14000; 50 = 13500" menjadi tingkat urut naik. Kosong = []. Rusak = null. */
export function uraiTingkat(teks: string): Tingkat[] | null {
  const t = teks.trim();
  if (!t) return [];
  const hasil: Tingkat[] = [];
  for (const bagian of t.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\d+(?:[.,]\d+)?)\s*(?:[:=]|pcs\s*:?)?\s*(.+)$/i.exec(bagian);
    if (!m) return null;
    const min = Number(m[1].replace(",", "."));
    const harga = angkaRp(m[2]);
    if (!(min > 1) || !Number.isFinite(harga) || harga < 0) return null;
    hasil.push({ min, harga });
  }
  hasil.sort((a, b) => a.min - b.min);
  if (new Set(hasil.map((h) => h.min)).size !== hasil.length || hasil.length > 10) return null;
  return hasil;
}

/** Harga satuan untuk jumlah tertentu: tingkat dengan min terbesar yang <= jumlah, selain itu harga dasar. */
export function hargaUntuk(dasar: number, tingkat: readonly Tingkat[] | null | undefined, jumlah: number): number {
  let h = dasar;
  for (const t of [...(tingkat ?? [])].sort((a, b) => a.min - b.min)) if (jumlah >= t.min) h = t.harga;
  return h;
}

/** "ukuran: 5 kg, warna: merah" menjadi {ukuran: "5 kg", warna: "merah"}. Kosong = {}. Rusak = null. */
export function uraiAtribut(teks: string): Record<string, string> | null {
  const t = teks.trim();
  if (!t) return {};
  const o: Record<string, string> = {};
  for (const bagian of t.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
    const i = bagian.indexOf(":");
    if (i < 1) return null;
    const k = bagian.slice(0, i).trim().toLowerCase();
    const v = bagian.slice(i + 1).trim();
    if (!/^[\p{L}\d ]{1,20}$/u.test(k) || !v || v.length > 40) return null;
    o[k] = v;
  }
  return Object.keys(o).length <= 5 ? o : null;
}

export const teksAtribut = (a: Record<string, string> | null | undefined) => Object.entries(a ?? {}).map(([k, v]) => `${k} ${v}`).join(", ");
