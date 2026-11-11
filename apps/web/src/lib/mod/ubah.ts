// X-07 alat MCP mod_draf_ubah: revisi kecil pada draf manifest tanpa mengirim ulang seluruhnya. Operasi berbasis jalur
// "koleksi/0/bidang/2/label". Setiap segmen dibatasi (kode huruf kecil atau indeks angka; __proto__, constructor, prototype
// ditolak) dan hasilnya tetap diperiksa pengawas yang sama sebelum disimpan, jadi operasi tidak bisa melewati pemeriksaan.
export type OpUbah = { op: "set" | "hapus" | "tambah"; jalur: string; nilai?: unknown };

const SEGMEN = /^(?:[a-z][a-z0-9_]{0,40}|\d{1,3})$/;
const TERLARANG = new Set(["constructor", "prototype"]);
export const BATAS_OP = 100;

type Wadah = Record<string, unknown> | unknown[];
const wadah = (x: unknown): x is Wadah => typeof x === "object" && x !== null;

/** Terapkan operasi ke salinan manifest. Melempar Error berbahasa Indonesia bila jalur tidak sah. */
export function terapkanUbah(manifest: unknown, ops: unknown): unknown {
  if (!Array.isArray(ops) || ops.length === 0) throw new Error("operasi harus daftar yang tidak kosong");
  if (ops.length > BATAS_OP) throw new Error(`paling banyak ${BATAS_OP} operasi sekali kirim`);
  const hasil = structuredClone(manifest);
  if (!wadah(hasil) || Array.isArray(hasil)) throw new Error("draf bukan objek manifest");
  ops.forEach((o, i) => {
    if (!wadah(o) || Array.isArray(o)) throw new Error(`operasi ${i + 1}: harus objek`);
    const { op, jalur, nilai } = o as OpUbah;
    if (op !== "set" && op !== "hapus" && op !== "tambah") throw new Error(`operasi ${i + 1}: op harus set, hapus, atau tambah`);
    const seg = typeof jalur === "string" ? jalur.split("/").filter(Boolean) : [];
    if (!seg.length || seg.length > 8 || seg.some((s) => !SEGMEN.test(s) || TERLARANG.has(s))) throw new Error(`operasi ${i + 1}: jalur tidak sah (${String(jalur).slice(0, 60)})`);
    let w: unknown = hasil;
    for (const s of seg.slice(0, -1)) {
      if (!wadah(w)) throw new Error(`operasi ${i + 1}: jalur ${jalur} tidak ada`);
      const anak: unknown = Array.isArray(w) ? w[Number(s)] : Object.hasOwn(w, s) ? (w as Record<string, unknown>)[s] : undefined;
      if (!wadah(anak)) throw new Error(`operasi ${i + 1}: jalur ${jalur} tidak ada`);
      w = anak;
    }
    const akhir = seg[seg.length - 1];
    if (!wadah(w)) throw new Error(`operasi ${i + 1}: jalur ${jalur} tidak ada`);
    if (Array.isArray(w)) {
      const n = Number(akhir);
      if (!/^\d+$/.test(akhir) || n > w.length) throw new Error(`operasi ${i + 1}: indeks ${akhir} di luar daftar`);
      if (op === "set") w[n] = structuredClone(nilai);
      else if (op === "hapus") { if (n >= w.length) throw new Error(`operasi ${i + 1}: indeks ${akhir} di luar daftar`); w.splice(n, 1); }
      else w.splice(n, 0, structuredClone(nilai));
      return;
    }
    if (/^\d/.test(akhir)) throw new Error(`operasi ${i + 1}: ${akhir} bukan nama kunci`);
    const obj = w as Record<string, unknown>;
    if (op === "set") obj[akhir] = structuredClone(nilai);
    else if (op === "hapus") delete obj[akhir];
    else {
      const daftar = obj[akhir];
      if (!Array.isArray(daftar)) throw new Error(`operasi ${i + 1}: ${jalur} bukan daftar`);
      daftar.push(structuredClone(nilai));
    }
  });
  return hasil;
}
