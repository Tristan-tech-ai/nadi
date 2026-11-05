// Ekstraktor terkompilasi: aturan deterministik (jangkar + regex + pemetaan kolom) yang ditulis model sekali,
// lalu dijalankan tanpa token untuk berkas berikutnya dengan tata letak sama. Tanpa dependensi luar.

export type Tipe = "teks" | "angka" | "rupiah" | "tanggal" | "periode" | "jam";

export type AturanTeks = {
  bentuk: "teks";
  jenis: string;
  /** Semua jangkar wajib muncul (tanpa peka huruf besar) agar aturan dianggap cocok dengan berkas. */
  jangkar: string[];
  /** Nama bidang (boleh bertitik, mis. "tunjangan.makan") -> regex dengan satu grup tangkap. */
  bidang: Record<string, { pola: string; tipe: Tipe; opsional?: boolean }>;
  /**
   * Baris tabel: regex dengan grup bernama per kolom, dicari di antara baris `setelah` dan `sebelum`.
   * `gabung` > 1: satu baris tabel tersebar di beberapa baris teks (mis. OCR nota: nama barang, lalu "9 x 9.500 85.500");
   * baris kosong dibuang dan setiap `gabung` baris disatukan dengan spasi sebelum dicocokkan.
   */
  tabel?: { pola: string; setelah?: string; sebelum?: string; tipe: Record<string, Tipe>; gabung?: number };
};

export type AturanKolom = {
  bentuk: "kolom";
  jenis: string;
  /** Judul kolom yang wajib ada di baris judul. */
  jangkar: string[];
  /** Nama bidang baris -> judul kolom sumber. */
  kolom: Record<string, { judul: string; tipe: Tipe }>;
};

export type Aturan = AturanTeks | AturanKolom;

const BULAN: Record<string, string> = {
  januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06", juli: "07", agustus: "08",
  september: "09", oktober: "10", november: "11", desember: "12",
  jan: "01", feb: "02", mar: "03", apr: "04", jun: "06", jul: "07", agu: "08", agt: "08", ags: "08", sep: "09", okt: "10", nov: "11", des: "12",
};

/** Ubah teks tangkapan ke nilai bertipe. Mengembalikan null bila tidak bisa diubah (tanda aturan tidak cocok). */
export function ubah(nilai: string, tipe: Tipe): string | number | null {
  const v = nilai.trim();
  switch (tipe) {
    case "teks":
      return v;
    case "angka": {
      if (/^-?\d+\.\d{1,2}$/.test(v)) return Number(v); // 2503000.00 (CSV)
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) && v !== "" ? n : null;
    }
    case "rupiah": {
      const t = v.replace(/^Rp\s?/i, "").trim();
      if (/^-?\d+\.\d{2}$/.test(t)) return Number(t); // 2503000.00 (CSV bank)
      if (!/^-?[\d.]+(,\d{1,2})?$/.test(t)) return null;
      return Number(t.replace(/\./g, "").replace(",", "."));
    }
    case "tanggal": {
      let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return v;
      m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
      if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      m = v.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
      if (m && BULAN[m[2].toLowerCase()]) return `${m[3]}-${BULAN[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
      return null;
    }
    case "periode": {
      const m = v.match(/^([A-Za-z]+)\s+(\d{4})$/);
      if (m && BULAN[m[1].toLowerCase()]) return `${m[2]}-${BULAN[m[1].toLowerCase()]}`;
      return /^\d{4}-\d{2}$/.test(v) ? v : null;
    }
    case "jam": {
      const m = v.match(/^(\d{1,2})[.:](\d{2})$/);
      return m ? `${m[1].padStart(2, "0")}.${m[2]}` : v === "" ? "" : null;
    }
  }
}

function pasang(o: Record<string, unknown>, jalur: string, nilai: unknown) {
  const bagian = jalur.split(".");
  let t = o;
  for (const b of bagian.slice(0, -1)) t = (t[b] ??= {}) as Record<string, unknown>;
  t[bagian.at(-1)!] = nilai;
}

export const cocok = (aturan: Aturan, teks: string) => {
  const kecil = teks.toLowerCase();
  return aturan.jangkar.length > 0 && aturan.jangkar.every((j) => kecil.includes(j.toLowerCase()));
};

/** CSV sederhana (koma, kutip ganda) menjadi baris sel. */
export function bacaCsv(teks: string): string[][] {
  const baris: string[][] = [];
  for (const l of teks.split(/\r?\n/)) {
    if (!l.trim() || l.startsWith("# ")) continue;
    const sel: string[] = [];
    let cur = "";
    let kutip = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (kutip) {
        if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') kutip = false; else cur += c;
      } else if (c === '"') kutip = true;
      else if (c === ",") { sel.push(cur); cur = ""; } else cur += c;
    }
    sel.push(cur);
    baris.push(sel);
  }
  return baris;
}

export type HasilAturan = { bidang: Record<string, unknown>; lengkap: boolean; gagal: string[] };

/** Jalankan aturan pada teks berkas. `lengkap` false bila ada bidang atau sel yang tidak terbaca. */
export function jalankan(aturan: Aturan, teks: string): HasilAturan {
  const bidang: Record<string, unknown> = {};
  const gagal: string[] = [];
  if (aturan.bentuk === "kolom") {
    const sel = bacaCsv(teks);
    const norm = (s: string) => s.trim().toLowerCase();
    const iJudul = sel.findIndex((r) => aturan.jangkar.every((j) => r.map(norm).includes(norm(j))));
    if (iJudul < 0) return { bidang, lengkap: false, gagal: ["baris judul"] };
    const judul = sel[iJudul].map(norm);
    const indeks = Object.fromEntries(Object.entries(aturan.kolom).map(([k, v]) => [k, judul.indexOf(norm(v.judul))]));
    for (const [k, i] of Object.entries(indeks)) if (i < 0) gagal.push(`kolom ${k}`);
    bidang.baris = sel.slice(iJudul + 1).filter((r) => r.some((x) => x.trim())).map((r, nomor) => {
      const o: Record<string, unknown> = {};
      for (const [k, { tipe }] of Object.entries(aturan.kolom)) {
        const v = indeks[k] >= 0 ? ubah(r[indeks[k]] ?? "", tipe) : null;
        if (v === null && (r[indeks[k]] ?? "").trim() !== "") gagal.push(`baris ${nomor + 1} ${k}`);
        o[k] = v ?? "";
      }
      return o;
    });
    return { bidang, lengkap: gagal.length === 0, gagal };
  }

  for (const [nama, { pola, tipe, opsional }] of Object.entries(aturan.bidang)) {
    const m = teks.match(new RegExp(pola, "im"));
    // Bidang opsional yang barisnya tidak ada (mis. kasbon, lembur) bernilai kosong, bukan kegagalan.
    if (!m && opsional) {
      pasang(bidang, nama, tipe === "angka" || tipe === "rupiah" ? 0 : "");
      continue;
    }
    const v = m?.[1] !== undefined ? ubah(m[1], tipe) : null;
    if (v === null) gagal.push(nama);
    else pasang(bidang, nama, v);
  }
  if (aturan.tabel) {
    const baris = teks.split(/\r?\n/);
    const mulai = aturan.tabel.setelah ? baris.findIndex((l) => l.toLowerCase().includes(aturan.tabel!.setelah!.toLowerCase())) + 1 : 0;
    const relAkhir = aturan.tabel.sebelum ? baris.slice(mulai).findIndex((l) => l.toLowerCase().includes(aturan.tabel!.sebelum!.toLowerCase())) : -1;
    const akhir = relAkhir < 0 ? baris.length : mulai + relAkhir;
    const re = new RegExp(aturan.tabel.pola);
    const isi: Record<string, unknown>[] = [];
    const n = Math.max(1, Math.min(4, Math.round(aturan.tabel.gabung ?? 1)));
    let bagian = baris.slice(mulai, akhir);
    if (n > 1) {
      const terisi = bagian.filter((l) => l.trim());
      bagian = [];
      for (let i = 0; i < terisi.length; i += n) bagian.push(terisi.slice(i, i + n).map((l) => l.trim()).join(" "));
    }
    for (const l of bagian) {
      const m = l.trim().match(re);
      if (!m?.groups) {
        if (l.trim()) gagal.push(`baris tabel: ${l.trim().slice(0, 40)}`);
        continue;
      }
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(m.groups)) {
        const t = ubah(v ?? "", aturan.tabel.tipe[k] ?? "teks");
        if (t === null) gagal.push(`tabel ${k}`);
        o[k] = t ?? "";
      }
      isi.push(o);
    }
    if (!isi.length) gagal.push("tabel kosong");
    bidang.baris = isi;
  }
  return { bidang, lengkap: gagal.length === 0, gagal };
}

/** Pemeriksaan silang: angka yang seharusnya saling cocok. Hasil aturan hanya dipercaya bila semuanya lolos. */
export function konsisten(jenis: string, b: Record<string, any>): string[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const masalah: string[] = [];
  const dekat = (a: number, c: number) => Math.abs(a - c) < 1;
  if ((jenis === "nota" || jenis === "invoice") && Array.isArray(b.baris)) {
    const jumlah = b.baris.reduce((s: number, r: any) => s + (Number(r.jumlah) || 0), 0); // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!dekat(jumlah, Number(b.total))) masalah.push(`jumlah baris ${jumlah} != total ${b.total}`);
    for (const r of b.baris) if (r.qty && r.harga && !dekat(Number(r.qty) * Number(r.harga), Number(r.jumlah))) masalah.push(`qty x harga != jumlah (${r.nama})`);
  }
  if (jenis === "slip_gaji") {
    const pot = Object.values(b.potongan ?? {}).reduce((s: number, x) => s + (Number(x) || 0), 0);
    if (b.bruto !== undefined && b.neto !== undefined && !dekat(Number(b.bruto) - pot, Number(b.neto))) masalah.push(`bruto - potongan != neto`);
  }
  return masalah;
}

/** Sidik tata letak dari jangkar aturan: dipakai sebagai kunci unik ekstraktor per usaha. */
export async function sidik(aturan: Aturan): Promise<string> {
  const isi = `${aturan.bentuk}|${aturan.jenis}|${[...aturan.jangkar].map((j) => j.toLowerCase().trim()).sort().join("|")}`;
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(isi));
  return Array.from(new Uint8Array(h), (x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ---------- model menulis aturan sekali ----------

const TIPE = ["teks", "angka", "rupiah", "tanggal", "periode", "jam"];
const obj = (p: Record<string, unknown>) => ({ type: "object", properties: p, required: Object.keys(p), additionalProperties: false });
const str = { type: "string" };

/** Skema kecil (tanpa anyOf) agar grammar keluaran terstruktur tidak terlalu besar. */
export const SKEMA_ATURAN = obj({
  bentuk: { type: "string", enum: ["teks", "kolom"] },
  jangkar: { type: "array", items: str },
  bidang: { type: "array", items: obj({ nama: str, pola: str, tipe: { type: "string", enum: TIPE }, opsional: { type: "boolean" } }) },
  tabel_pola: str,
  tabel_setelah: str,
  tabel_sebelum: str,
  tabel_gabung: { type: "integer" },
  tabel_kolom: { type: "array", items: obj({ nama: str, tipe: { type: "string", enum: TIPE } }) },
  kolom: { type: "array", items: obj({ nama: str, judul: str, tipe: { type: "string", enum: TIPE } }) },
});

export type AturanMentah = {
  bentuk: "teks" | "kolom";
  jangkar: string[];
  bidang: { nama: string; pola: string; tipe: Tipe; opsional: boolean }[];
  tabel_pola: string;
  tabel_setelah: string;
  tabel_sebelum: string;
  /** Jumlah baris teks per satu baris tabel (1 bila satu baris); aturan lama tidak memilikinya. */
  tabel_gabung?: number;
  tabel_kolom: { nama: string; tipe: Tipe }[];
  kolom: { nama: string; judul: string; tipe: Tipe }[];
};

export const INSTRUKSI_ATURAN = `Kamu menulis aturan ekstraksi deterministik untuk satu tata letak berkas usaha di Indonesia. Aturan ini akan dipakai ulang tanpa model untuk berkas lain dengan tata letak yang sama, jadi harus umum, bukan hafalan isi berkas ini.
Bentuk "teks" (PDF/teks berbaris):
- jangkar: 3-6 label tetap yang pasti muncul di setiap berkas tata letak ini (mis. "INVOICE", "Jatuh tempo", "Total tagihan"). JANGAN memakai nilai yang berubah: nama orang, nama usaha, nomor, tanggal, angka.
- bidang: satu entri per bidang skalar. nama memakai titik untuk bidang bersarang (mis. "potongan.jht"). pola = regex JavaScript dengan TEPAT SATU grup tangkap, dijalankan dengan flag "im" (^ dan $ per baris). tipe: teks | angka | rupiah ("Rp1.250.000") | tanggal ("11 Oktober 2026" atau "07/10/2026") | periode ("OKTOBER 2026") | jam ("07.15"). opsional=true hanya untuk baris yang kadang tidak ada (mis. kasbon, lembur).
- tabel (bila ada daftar baris barang): tabel_pola = regex untuk SATU baris tabel dengan grup bernama sesuai nama kolom, mis. (?<nama>.+?)\\s+(?<qty>\\d+)\\s+(?<harga>Rp[\\d.,]+)\\s+(?<jumlah>Rp[\\d.,]+)$ ; tabel_setelah = teks baris judul tabel; tabel_sebelum = teks baris setelah tabel; tabel_kolom = tipe tiap grup; tabel_gabung = jumlah baris teks untuk satu baris tabel (biasanya 1; 2 bila nama barang di satu baris dan "qty x harga jumlah" di baris berikutnya; baris kosong diabaikan dan baris-baris itu disatukan dengan spasi sebelum dicocokkan). Kosongkan semuanya (tabel_gabung 1) bila tidak ada tabel.
Teks hasil OCR foto: huruf bisa salah baca (mis. "NT" terbaca "NI", "kg" terbaca "ko") dan spasi tidak tetap ("9x" atau "9 x"). Tulis pola yang menangkap teks OCR apa adanya dan longgar terhadap spasi.
Berkas berikutnya dengan tata letak sama bisa menulis tanggal dan angka dengan pemisah lain (04/10/2026, 26-09-2026, 26.09.2026; Rp. 64.800 atau Rp64.800): tulis pola tanggal dengan pemisah [/.-] dan pola angka yang longgar terhadap titik, koma, dan spasi, bukan hanya pemisah di berkas contoh.
Bentuk "kolom" (CSV/Excel): jangkar = judul kolom persis; kolom = pemetaan nama bidang baris ke judul kolom dan tipenya. Kosongkan bidang dan tabel.
Nama bidang harus sama dengan kunci di hasil bacaan yang diberikan. Aturan akan langsung diuji pada berkas ini dan ditolak bila hasilnya berbeda.
Pemeriksa otomatis juga menolak: pola lebih dari 300 huruf, rujukan balik (\\1), lookahead/lookbehind, pengulangan bersarang seperti (\\w+\\s?)+, dan jangkar yang juga cocok dengan jenis berkas lain. Pakai label yang khas untuk tata letak ini.`;

/**
 * Label tetap tanpa nilai: potong di angka/rupiah pertama ("Total tagihan Rp3.558.000" menjadi "Total tagihan").
 * Model kadang menghafal nilai berkas asal di jangkar atau batas tabel; aturan seperti itu lulus uji di berkas asal
 * tetapi tidak pernah cocok dengan berkas kembarannya.
 */
export const labelSaja = (s: string) => s.split(/\s*(?:Rp\.?\s*)?\d/i)[0].trim();

export function aturanDari(jenis: string, m: AturanMentah): Aturan {
  if (m.bentuk === "kolom") {
    return { bentuk: "kolom", jenis, jangkar: m.jangkar, kolom: Object.fromEntries(m.kolom.map((k) => [k.nama, { judul: k.judul, tipe: k.tipe }])) };
  }
  const jangkar = [...new Set(m.jangkar.map(labelSaja).filter((j) => j.length >= 3))];
  m = { ...m, tabel_setelah: labelSaja(m.tabel_setelah), tabel_sebelum: labelSaja(m.tabel_sebelum) };
  const aturan: AturanTeks = {
    bentuk: "teks", jenis, jangkar,
    bidang: Object.fromEntries(m.bidang.map((b) => [b.nama, { pola: b.pola, tipe: b.tipe, ...(b.opsional ? { opsional: true } : {}) }])),
  };
  if (m.tabel_pola) {
    aturan.tabel = {
      pola: m.tabel_pola,
      ...(m.tabel_setelah ? { setelah: m.tabel_setelah } : {}),
      ...(m.tabel_sebelum ? { sebelum: m.tabel_sebelum } : {}),
      ...((m.tabel_gabung ?? 1) > 1 ? { gabung: m.tabel_gabung } : {}),
      tipe: Object.fromEntries(m.tabel_kolom.map((k) => [k.nama, k.tipe])),
    };
  }
  return aturan;
}

/** Jarak edit Levenshtein (untuk membandingkan teks hasil OCR). */
export function jarakEdit(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Dua nilai daun dianggap sama. `longgar` (teks OCR): teks biasa boleh beda sedikit huruf
 * (paling banyak 1 huruf per 6, mis. "NT-4671" terbaca "NI-4671", "1 kg" terbaca "1 ko");
 * angka, tanggal, dan periode tetap harus persis.
 */
export function samaNilai(benar: unknown, hasil: unknown, longgar = false): boolean {
  const a = norm(benar);
  const b = norm(hasil);
  if (a === b) return true;
  if (!longgar || typeof benar !== "string" || !a || /^[-\d.,]+$|^\d{4}-\d{2}(-\d{2})?$/.test(a)) return false;
  return jarakEdit(a, b) <= Math.max(1, Math.floor(a.length / 6));
}

/** Akurasi tingkat bidang: setiap nilai daun di `benar` dibandingkan dengan `hasil`. */
export function akurasi(benar: unknown, hasil: unknown, longgar = false): { cocok: number; total: number } {
  if (Array.isArray(benar)) {
    return benar.reduce((s, x, i) => { const r = akurasi(x, (hasil as unknown[] | undefined)?.[i], longgar); return { cocok: s.cocok + r.cocok, total: s.total + r.total }; }, { cocok: 0, total: 0 });
  }
  if (benar && typeof benar === "object") {
    return Object.entries(benar).reduce((s, [k, x]) => { const r = akurasi(x, (hasil as Record<string, unknown> | undefined)?.[k], longgar); return { cocok: s.cocok + r.cocok, total: s.total + r.total }; }, { cocok: 0, total: 0 });
  }
  return { cocok: samaNilai(benar, hasil, longgar) ? 1 : 0, total: 1 };
}

/**
 * Uji aturan baru pada berkas asalnya sebelum disimpan: harus cocok, lengkap, konsisten,
 * dan menghasilkan bidang yang sama persis dengan hasil bacaan model (setelah dirapikan).
 */
export function ujiAturan(aturan: Aturan, teks: string, benar: Record<string, unknown>, rapikanBidang: (b: Record<string, unknown>) => Record<string, unknown>, longgar = false) {
  if (aturan.jangkar.length < 2) return { lulus: false, alasan: "jangkar terlalu sedikit" };
  if (!cocok(aturan, teks)) return { lulus: false, alasan: "jangkar tidak cocok" };
  try {
    const h = jalankan(aturan, teks);
    if (!h.lengkap) return { lulus: false, alasan: `tidak lengkap: ${h.gagal.slice(0, 3).join("; ")}` };
    const masalah = konsisten(aturan.jenis, h.bidang);
    if (masalah.length) return { lulus: false, alasan: masalah[0] };
    const harapan = rapikanBidang(benar);
    const didapat = rapikanBidang(h.bidang);
    const a = akurasi(harapan, didapat, longgar);
    if (a.cocok !== a.total) {
      const contoh = beda(harapan, didapat, "", longgar).slice(0, 4).map((d) => `${d.jalur}: harap ${JSON.stringify(d.harap)}, dapat ${JSON.stringify(d.dapat)}`);
      return { lulus: false, alasan: `berbeda ${a.total - a.cocok} dari ${a.total} bidang; ${contoh.join("; ")}` };
    }
    return { lulus: true, alasan: "" };
  } catch (e) {
    return { lulus: false, alasan: `regex rusak: ${e instanceof Error ? e.message : e}` };
  }
}

/** Daftar nilai daun yang berbeda (jalur, harapan, didapat), untuk umpan balik ke model dan log. */
export function beda(harap: unknown, dapat: unknown, jalur = "", longgar = false): { jalur: string; harap: unknown; dapat: unknown }[] {
  if (Array.isArray(harap)) return harap.flatMap((x, i) => beda(x, (dapat as unknown[] | undefined)?.[i], `${jalur}[${i}]`, longgar));
  if (harap && typeof harap === "object") {
    return Object.entries(harap).flatMap(([k, x]) => beda(x, (dapat as Record<string, unknown> | undefined)?.[k], jalur ? `${jalur}.${k}` : k, longgar));
  }
  return samaNilai(harap, dapat, longgar) ? [] : [{ jalur, harap, dapat }];
}

const SEMUA_TIPE: Tipe[] = ["teks", "angka", "rupiah", "tanggal", "periode", "jam"];

/**
 * Perbaikan deterministik tanpa token: bila sebuah bidang/kolom salah hanya karena tipenya, coba tipe lain
 * dan pilih yang membuat semua nilai bidang itu sama dengan hasil yang benar.
 */
export function perbaikiTipe(aturan: Aturan, teks: string, benar: Record<string, unknown>, rapikanBidang: (b: Record<string, unknown>) => Record<string, unknown>, longgar = false): Aturan {
  const harapan = rapikanBidang(benar);
  const salinan = JSON.parse(JSON.stringify(aturan)) as Aturan;
  const bedaDi = (a: Aturan, awalan: (j: string) => boolean) => {
    try {
      return beda(harapan, rapikanBidang(jalankan(a, teks).bidang), "", longgar).filter((d) => awalan(d.jalur)).length;
    } catch {
      return Infinity;
    }
  };
  if (salinan.bentuk === "kolom") {
    for (const [k, v] of Object.entries(salinan.kolom)) {
      const milik = (j: string) => j.startsWith("baris[") && j.endsWith(`].${k}`);
      let terbaik = { tipe: v.tipe, n: bedaDi(salinan, milik) };
      for (const t of SEMUA_TIPE) {
        v.tipe = t;
        const n = bedaDi(salinan, milik);
        if (n < terbaik.n) terbaik = { tipe: t, n };
      }
      v.tipe = terbaik.tipe;
    }
    return salinan;
  }
  for (const [k, v] of Object.entries(salinan.bidang)) {
    const milik = (j: string) => j === k;
    let terbaik = { tipe: v.tipe, n: bedaDi(salinan, milik) };
    for (const t of SEMUA_TIPE) {
      v.tipe = t;
      const n = bedaDi(salinan, milik);
      if (n < terbaik.n) terbaik = { tipe: t, n };
    }
    v.tipe = terbaik.tipe;
  }
  if (salinan.tabel) {
    for (const k of Object.keys(salinan.tabel.tipe)) {
      const milik = (j: string) => j.startsWith("baris[") && j.endsWith(`].${k}`);
      let terbaik = { tipe: salinan.tabel.tipe[k], n: bedaDi(salinan, milik) };
      for (const t of SEMUA_TIPE) {
        salinan.tabel.tipe[k] = t;
        const n = bedaDi(salinan, milik);
        if (n < terbaik.n) terbaik = { tipe: t, n };
      }
      salinan.tabel.tipe[k] = terbaik.tipe;
    }
  }
  return salinan;
}
