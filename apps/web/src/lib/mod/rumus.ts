// Rumus Nadi Mod: tata bahasa kecil yang diurai sendiri. Tanpa eval, tanpa akses jaringan, data lain, atau objek JS.
// Spesifikasi: docs/design/MOD.md bagian Rumus.

export type Nilai = number | string | boolean | Date | null;
type Simpul =
  | { t: "angka"; v: number }
  | { t: "teks"; v: string }
  | { t: "logika"; v: boolean }
  | { t: "bidang"; v: string }
  | { t: "fungsi"; nama: string; arg: Simpul[] }
  | { t: "op"; op: string; a: Simpul; b: Simpul }
  | { t: "neg"; a: Simpul };

export const BATAS_RUMUS = { huruf: 200, token: 120, dalam: 20 } as const;

/** Fungsi yang boleh dipakai: nama -> [arg minimal, arg maksimal]. */
export const FUNGSI: Record<string, [number, number]> = {
  JIKA: [3, 3], KOSONG: [1, 1], MIN: [1, 10], MAKS: [1, 10], BULAT: [1, 2], ABS: [1, 1], HARI_INI: [0, 0],
  HARI_ANTARA: [2, 2], TAMBAH_HARI: [2, 2], PANJANG: [1, 1], HURUF_BESAR: [1, 1],
};

type Token = { k: "angka" | "teks" | "bidang" | "nama" | "simbol"; v: string };
const BIDANG = /^[a-z][a-z0-9_]{0,29}$/;

function token(src: string): Token[] {
  const hasil: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " ") { i++; continue; }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i))!;
      hasil.push({ k: "angka", v: m[0] }); i += m[0].length; continue;
    }
    if (c === '"') {
      const akhir = src.indexOf('"', i + 1);
      if (akhir < 0) throw new Error("tanda kutip teks tidak ditutup");
      const isi = src.slice(i + 1, akhir);
      if (/[\\{}<>`$]/.test(isi)) throw new Error("teks rumus memuat karakter terlarang");
      hasil.push({ k: "teks", v: isi }); i = akhir + 1; continue;
    }
    if (c === "{") {
      const akhir = src.indexOf("}", i);
      const kode = akhir < 0 ? "" : src.slice(i + 1, akhir);
      if (!BIDANG.test(kode)) throw new Error(`rujukan bidang tidak sah: ${src.slice(i, i + 20)}`);
      hasil.push({ k: "bidang", v: kode }); i = akhir + 1; continue;
    }
    if (/[A-Z_]/.test(c)) {
      const m = /^[A-Z_]+/.exec(src.slice(i))!;
      hasil.push({ k: "nama", v: m[0] }); i += m[0].length; continue;
    }
    const dua = src.slice(i, i + 2);
    if (dua === "<>" || dua === "<=" || dua === ">=") { hasil.push({ k: "simbol", v: dua }); i += 2; continue; }
    if ("+-*/&=<>(),".includes(c)) { hasil.push({ k: "simbol", v: c }); i++; continue; }
    throw new Error(`karakter tidak dikenal di rumus: ${c}`);
  }
  if (hasil.length > BATAS_RUMUS.token) throw new Error("rumus terlalu panjang");
  return hasil;
}

/** Uraikan rumus menjadi pohon. Melempar Error berbahasa Indonesia bila tidak sah. */
export function urai(src: string): Simpul {
  if (typeof src !== "string" || !src.trim()) throw new Error("rumus kosong");
  if (src.length > BATAS_RUMUS.huruf) throw new Error(`rumus lebih dari ${BATAS_RUMUS.huruf} huruf`);
  const tk = token(src);
  let p = 0;
  const lihat = () => tk[p];
  const makan = (v?: string) => {
    const t = tk[p];
    if (!t || (v !== undefined && t.v !== v)) throw new Error(`rumus: diharapkan ${v ?? "nilai"}`);
    p++;
    return t;
  };
  const cek = (d: number) => { if (d > BATAS_RUMUS.dalam) throw new Error("rumus terlalu dalam"); };
  // kedalaman dihitung per kurung, fungsi, dan minus, bukan per tingkat prioritas operator
  const biner = (berikut: (d: number) => Simpul, ops: string[]) => (d: number): Simpul => {
    let a = berikut(d);
    while (lihat() && ops.includes(lihat().v) && (lihat().k === "simbol" || lihat().k === "nama")) {
      const op = makan().v;
      a = { t: "op", op, a, b: berikut(d) };
    }
    return a;
  };
  const primer = (d: number): Simpul => {
    cek(d);
    const t = lihat();
    if (!t) throw new Error("rumus berakhir terlalu cepat");
    if (t.k === "simbol" && t.v === "-") { makan(); return { t: "neg", a: primer(d + 1) }; }
    if (t.k === "simbol" && t.v === "(") { makan("("); const e = atau(d + 1); makan(")"); return e; }
    if (t.k === "angka") { makan(); return { t: "angka", v: Number(t.v) }; }
    if (t.k === "teks") { makan(); return { t: "teks", v: t.v }; }
    if (t.k === "bidang") { makan(); return { t: "bidang", v: t.v }; }
    if (t.k === "nama") {
      makan();
      if (t.v === "BENAR" || t.v === "SALAH") return { t: "logika", v: t.v === "BENAR" };
      const batas = Object.hasOwn(FUNGSI, t.v) ? FUNGSI[t.v] : null;
      if (!batas) throw new Error(`fungsi tidak dikenal: ${t.v}`);
      makan("(");
      const arg: Simpul[] = [];
      if (lihat()?.v !== ")") {
        arg.push(atau(d + 1));
        while (lihat()?.v === ",") { makan(","); arg.push(atau(d + 1)); }
      }
      makan(")");
      if (arg.length < batas[0] || arg.length > batas[1]) throw new Error(`${t.v} butuh ${batas[0]}-${batas[1]} argumen`);
      return { t: "fungsi", nama: t.v, arg };
    }
    throw new Error(`rumus: tidak terduga ${t.v}`);
  };
  const kali = biner(primer, ["*", "/"]);
  const tambah = biner(kali, ["+", "-"]);
  const gabung = biner(tambah, ["&"]);
  const banding = biner(gabung, ["=", "<>", "<", ">", "<=", ">="]);
  const dan = biner(banding, ["DAN"]);
  function atau(d: number): Simpul { return biner(dan, ["ATAU"])(d); }
  const hasil = atau(0);
  if (p !== tk.length) throw new Error(`rumus: sisa tidak terduga ${tk[p].v}`);
  return hasil;
}

/** Semua kode bidang yang dirujuk rumus. */
export function rujukan(s: Simpul, kumpul = new Set<string>()): Set<string> {
  if (s.t === "bidang") kumpul.add(s.v);
  else if (s.t === "fungsi") s.arg.forEach((a) => rujukan(a, kumpul));
  else if (s.t === "op") { rujukan(s.a, kumpul); rujukan(s.b, kumpul); }
  else if (s.t === "neg") rujukan(s.a, kumpul);
  return kumpul;
}

const HARI = 86_400_000;
const keTanggal = (v: Nilai): Date | null => (v instanceof Date ? v : typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(v) : null);
const keAngka = (v: Nilai): number => (typeof v === "number" ? v : typeof v === "boolean" ? Number(v) : typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : 0);

/** Hitung rumus terhadap data satu catatan. Tidak pernah melempar: galat hitung menjadi null. */
export function hitung(s: Simpul, data: Record<string, Nilai>, sekarang = new Date()): Nilai {
  try {
    return nilai(s, data, sekarang);
  } catch {
    return null;
  }
}

function nilai(s: Simpul, d: Record<string, Nilai>, now: Date): Nilai {
  switch (s.t) {
    case "angka": case "teks": case "logika": return s.v;
    case "bidang": return Object.hasOwn(d, s.v) ? d[s.v] ?? null : null;
    case "neg": return -keAngka(nilai(s.a, d, now));
    case "op": {
      const a = nilai(s.a, d, now), b = nilai(s.b, d, now);
      switch (s.op) {
        case "+": return keAngka(a) + keAngka(b);
        case "-": return keAngka(a) - keAngka(b);
        case "*": return keAngka(a) * keAngka(b);
        case "/": return keAngka(b) === 0 ? null : keAngka(a) / keAngka(b);
        case "&": return `${a ?? ""}${b ?? ""}`;
        case "DAN": return Boolean(a) && Boolean(b);
        case "ATAU": return Boolean(a) || Boolean(b);
        default: {
          const x = a instanceof Date ? a.getTime() : a, y = b instanceof Date ? b.getTime() : b;
          if (s.op === "=") return x === y;
          if (s.op === "<>") return x !== y;
          const [p, q] = [keAngka(x as Nilai), keAngka(y as Nilai)];
          return s.op === "<" ? p < q : s.op === ">" ? p > q : s.op === "<=" ? p <= q : p >= q;
        }
      }
    }
    case "fungsi": {
      const arg = (i: number) => nilai(s.arg[i], d, now);
      switch (s.nama) {
        case "JIKA": return arg(0) ? arg(1) : arg(2);
        case "KOSONG": { const v = arg(0); return v === null || v === ""; }
        case "MIN": return Math.min(...s.arg.map((_, i) => keAngka(arg(i))));
        case "MAKS": return Math.max(...s.arg.map((_, i) => keAngka(arg(i))));
        case "BULAT": { const n = s.arg.length > 1 ? Math.max(0, Math.min(6, keAngka(arg(1)))) : 0; const f = 10 ** n; return Math.round(keAngka(arg(0)) * f) / f; }
        case "ABS": return Math.abs(keAngka(arg(0)));
        case "HARI_INI": return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        case "HARI_ANTARA": { const a = keTanggal(arg(0)), b = keTanggal(arg(1)); return a && b ? Math.floor((b.getTime() - a.getTime()) / HARI) : null; }
        case "TAMBAH_HARI": { const t = keTanggal(arg(0)); return t ? new Date(t.getTime() + keAngka(arg(1)) * HARI) : null; }
        case "PANJANG": return String(arg(0) ?? "").length;
        case "HURUF_BESAR": return String(arg(0) ?? "").toUpperCase();
      }
    }
  }
  return null;
}
