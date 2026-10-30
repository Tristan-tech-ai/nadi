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
  /** Baris tabel: regex dengan grup bernama per kolom, dicari di antara baris `setelah` dan `sebelum`. */
  tabel?: { pola: string; setelah?: string; sebelum?: string; tipe: Record<string, Tipe> };
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
    for (const l of baris.slice(mulai, akhir)) {
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
