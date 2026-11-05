// T-01D pengawas denah kamera: kode tetap (bukan AI) yang memeriksa zona usulan model sebelum menjadi draf. Salinan PERSIS di
// supabase/functions/usul-denah/denah.ts (diuji identik di denah.test.ts). Tanpa impor supaya bisa dipakai Deno dan Node.

export type ZonaUsul = { nama: string; jenis: string; poligon: [number, number][] };
export const JENIS_DENAH = ["pintu", "kasir", "antrean", "rak", "lorong", "kerja", "meja"];
const BAHAYA = /[<>{};`$\\]|\b(select|insert|update|delete|drop|script|function|eval)\b/i;

function luas(p: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1; }
  return Math.abs(s) / 2;
}

function potong(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const o = (p: [number, number], q: [number, number], r: [number, number]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

function memotongDiri(p: [number, number][]): boolean {
  const n = p.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
    if (potong(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true;
  }
  return false;
}

export function dalam([x, y]: [number, number], p: [number, number][]): boolean {
  let isi = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) isi = !isi;
  }
  return isi;
}

/** Periksa zona usulan. Zona yang lolos belum aktif: tetap draf sampai pemilik menyetujui di layar Mata. */
export function periksaDenah(zona: unknown): { lulus: boolean; alasan: string[] } {
  const alasan: string[] = [];
  if (!Array.isArray(zona) || zona.length < 1 || zona.length > 12) return { lulus: false, alasan: ["zona harus 1-12"] };
  const sah: [number, number][][] = [];
  zona.forEach((z: ZonaUsul, i) => {
    const k = `zona ${i + 1}`;
    if (!z || typeof z !== "object") return alasan.push(`${k}: bukan objek`);
    if (typeof z.nama !== "string" || !z.nama.trim() || z.nama.length > 40) alasan.push(`${k}: nama 1-40 huruf`);
    else if (BAHAYA.test(z.nama)) alasan.push(`${k}: nama berisi teks yang menyerupai skrip`);
    if (!JENIS_DENAH.includes(z.jenis)) alasan.push(`${k}: jenis tidak dikenal`);
    const p = z.poligon;
    if (!Array.isArray(p) || p.length < 3 || p.length > 12) return alasan.push(`${k}: poligon 3-12 titik`);
    if (!p.every((t) => Array.isArray(t) && t.length === 2 && t.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1)))
      return alasan.push(`${k}: titik harus di dalam bingkai (0..1)`);
    if (memotongDiri(p)) return alasan.push(`${k}: poligon memotong dirinya sendiri`);
    if (luas(p) < 0.002) return alasan.push(`${k}: terlalu kecil`);
    sah.push(p);
  });
  if (!zona.some((z: ZonaUsul) => z && z.jenis === "pintu")) alasan.push("denah wajib punya satu zona pintu");
  // Tumpang tindih diukur pada kisi 50x50: irisan dua zona tidak boleh lebih dari 5% zona yang lebih kecil.
  const N = 50;
  const isi = sah.map((p) => { const s = new Set<number>(); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (dalam([(x + 0.5) / N, (y + 0.5) / N], p)) s.add(y * N + x); return s; });
  for (let a = 0; a < isi.length; a++) for (let b = a + 1; b < isi.length; b++) {
    let iris = 0; for (const c of isi[a]) if (isi[b].has(c)) iris++;
    const kecil = Math.min(isi[a].size, isi[b].size);
    if (kecil && iris / kecil > 0.05) alasan.push(`zona ${a + 1} dan ${b + 1} bertumpuk`);
  }
  return { lulus: alasan.length === 0, alasan };
}
