// Peta Organisasi Nyata (F3-04, docs/design/peta-organisasi.md). Fungsi murni, 0 token: angka, persen, ambang, dan kalimat kepala
// datang dari public.peta_organisasi (migrasi peta_organisasi); modul ini menyusun tata letak graf dua kolom (kiri orang, kanan
// topi) dan kalimat per orang, per topi, dan per alur serah. Tidak ada model AI.
import { angka } from "./kpi";
import { formatPoin } from "./poin";

export type OrangPeta = {
  id: string;
  nama: string;
  jabatan: string | null;
  /** Kerja selesai di jendela. */
  n: number;
  poin: number;
  /** n >= ambang: persen dari poin orang ini boleh ditampilkan. */
  cukup: boolean;
  tanpa_topi_poin: number;
  /** Topi yang dipakai di atas kertas hari ini. */
  topi_ids: string[];
};
export type TopiPeta = { id: string; nama: string; n: number; poin: number; cukup: boolean };
export type GarisPeta = {
  orang_id: string;
  topi_id: string;
  /** Dipakai di atas kertas (pakai_topi). */
  kertas: boolean;
  porsi: number | null;
  n: number;
  poin: number;
  /** Ada kerja lintas topi (kerja.lintas_topi) dan topinya belum dipakai. */
  lintas: boolean;
  lintas_n: number;
  lintas_poin: number;
  persen_topi: number | null;
  persen_orang: number | null;
  persen_lintas: number | null;
};
export type SaranPeta = {
  orang_id: string;
  topi_id: string;
  orang_nama: string;
  topi_nama: string;
  persen: number;
  lintas_poin: number;
  orang_poin: number;
  kertas_nama: string | null;
  usulan_id: string | null;
};
export type SerahPeta = {
  pemberi_id: string | null;
  pemberi_peran: string | null;
  pemberi_nama: string;
  pelaksana_id: string;
  pelaksana_nama: string;
  n: number;
  selesai_n: number;
};
export type Peta = {
  mulai: string;
  akhir: string;
  zona: string;
  minggu: number;
  ambang: number;
  selesai_n: number;
  poin: number;
  kepala: string;
  orang: OrangPeta[];
  topi: TopiPeta[];
  garis: GarisPeta[];
  saran: SaranPeta[];
  serah: SerahPeta[];
  serah_tanpa_pemberi: number;
  tanpa_peta_n: number;
};

/** Ambang persen saran pasang topi (sama dengan migrasi: lintas >= 30% poin orang itu). */
export const AMBANG_SARAN = 30;

/** Angka dari jsonb numeric (bisa datang sebagai string "2.00") menjadi number. */
const num = (x: unknown) => Number(x ?? 0);

/** Normalisasi keluaran RPC: angka numeric menjadi number, larik kosong bila hilang. */
export function bacaPeta(d: Peta): Peta {
  return {
    ...d,
    poin: num(d.poin),
    orang: (d.orang ?? []).map((o) => ({ ...o, poin: num(o.poin), tanpa_topi_poin: num(o.tanpa_topi_poin), topi_ids: o.topi_ids ?? [] })),
    topi: (d.topi ?? []).map((t) => ({ ...t, poin: num(t.poin) })),
    garis: (d.garis ?? []).map((g) => ({ ...g, poin: num(g.poin), lintas_poin: num(g.lintas_poin), porsi: g.porsi === null ? null : num(g.porsi) })),
    saran: (d.saran ?? []).map((s) => ({ ...s, lintas_poin: num(s.lintas_poin), orang_poin: num(s.orang_poin) })),
    serah: d.serah ?? [],
  };
}

/** Nama topi di tengah kalimat: huruf pertama kecil ("Kasir" -> "kasir"), sama dengan app.awal_kecil. */
export const awalKecil = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** "a", "a dan b", "a, b, dan c" (sama dengan app.gabung_teks). */
export function gabung(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  if (xs.length === 2) return `${xs[0]} dan ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")}, dan ${xs[xs.length - 1]}`;
}

export type SimpulLetak = { id: string; nama: string; y: number; poin: number };
export type GarisLetak = GarisPeta & { y1: number; y2: number; /** Ketebalan garis nyata (px); 0 bila tanpa kerja. */ tebal: number };
export type TataLetak = { tinggi: number; baris: number; orang: SimpulLetak[]; topi: SimpulLetak[]; garis: GarisLetak[] };

export const TEBAL_MIN = 2;
export const TEBAL_MAKS = 10;

/** Ketebalan garis nyata: 2 px untuk poin terkecil di atas 0 sampai 10 px untuk poin terbesar di peta, kelipatan 0,5. */
export function tebalGaris(poin: number, poinMaks: number): number {
  if (!(poin > 0) || !(poinMaks > 0)) return 0;
  const t = TEBAL_MIN + (TEBAL_MAKS - TEBAL_MIN) * Math.min(1, poin / poinMaks);
  return Math.round(t * 2) / 2;
}

const urutNama = (a: { nama: string; id: string }, b: { nama: string; id: string }) => a.nama.localeCompare(b.nama, "id") || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Tata letak dua kolom. Topi diurut poin nyata terbesar di atas (seri: nama). Orang diurut menurut titik berat posisi topi yang
 * dikerjakannya (rata-rata indeks topi berbobot poin; tanpa kerja: rata-rata indeks topi di atas kertas; tanpa keduanya: paling
 * bawah), seri: nama. Cara ini mengurangi garis bersilang tanpa pustaka graf. Kolom yang lebih pendek ditaruh di tengah.
 */
export function tataLetak(p: Pick<Peta, "orang" | "topi" | "garis">, opsi: { baris?: number; atas?: number } = {}): TataLetak {
  const baris = opsi.baris ?? 56;
  const atas = opsi.atas ?? 28;
  const topi = [...p.topi].sort((a, b) => b.poin - a.poin || urutNama(a, b));
  const iTopi = new Map(topi.map((t, i) => [t.id, i]));
  const berat = (o: OrangPeta) => {
    const nyata = p.garis.filter((g) => g.orang_id === o.id && g.poin > 0 && iTopi.has(g.topi_id));
    const total = nyata.reduce((s, g) => s + g.poin, 0);
    if (total > 0) return nyata.reduce((s, g) => s + g.poin * iTopi.get(g.topi_id)!, 0) / total;
    const kertas = p.garis.filter((g) => g.orang_id === o.id && g.kertas && iTopi.has(g.topi_id));
    return kertas.length ? kertas.reduce((s, g) => s + iTopi.get(g.topi_id)!, 0) / kertas.length : Number.POSITIVE_INFINITY;
  };
  const orang = [...p.orang].map((o) => ({ o, b: berat(o) })).sort((a, b) => a.b - b.b || urutNama(a.o, b.o)).map((x) => x.o);
  const n = Math.max(orang.length, topi.length, 1);
  const geser = (k: number) => ((n - k) * baris) / 2;
  const yOrang = new Map(orang.map((o, i) => [o.id, atas + geser(orang.length) + i * baris + baris / 2]));
  const yTopi = new Map(topi.map((t, i) => [t.id, atas + geser(topi.length) + i * baris + baris / 2]));
  const poinMaks = Math.max(0, ...p.garis.map((g) => g.poin));
  return {
    tinggi: atas * 2 + n * baris,
    baris,
    orang: orang.map((o) => ({ id: o.id, nama: o.nama, y: yOrang.get(o.id)!, poin: o.poin })),
    topi: topi.map((t) => ({ id: t.id, nama: t.nama, y: yTopi.get(t.id)!, poin: t.poin })),
    garis: p.garis
      .filter((g) => yOrang.has(g.orang_id) && yTopi.has(g.topi_id))
      .map((g) => ({ ...g, y1: yOrang.get(g.orang_id)!, y2: yTopi.get(g.topi_id)!, tebal: tebalGaris(g.poin, poinMaks) })),
  };
}

const kerjaTeks = (n: number) => `${n} kerja selesai`;
const jendela = (minggu: number) => `${minggu} minggu terakhir`;

/**
 * Kalimat satu orang: angka nyata, lalu selisih kertas vs nyata. "Budi memakai topi gudang, belum ada kerja gudang 4 minggu
 * terakhir." dan "Dewi: 60% kerjanya urusan kasir, padahal topinya pelayan." Persen hanya bila orang itu cukup kerja.
 */
export function kalimatOrang(p: Peta, orangId: string): string[] {
  const o = p.orang.find((x) => x.id === orangId);
  if (!o) return [];
  const nama = new Map(p.topi.map((t) => [t.id, t.nama]));
  const garis = p.garis.filter((g) => g.orang_id === o.id);
  const kertas = garis.filter((g) => g.kertas).map((g) => awalKecil(nama.get(g.topi_id) ?? "")).filter(Boolean);
  const hasil: string[] = [];
  hasil.push(o.n === 0
    ? `${o.nama} belum menyelesaikan kerja ${jendela(p.minggu)}.`
    : `${o.nama}: ${formatPoin(o.poin)} dari ${kerjaTeks(o.n)} ${jendela(p.minggu)}.`);
  for (const g of garis.filter((x) => x.kertas && x.n === 0)) {
    const t = awalKecil(nama.get(g.topi_id) ?? "");
    hasil.push(`${o.nama} memakai topi ${t}, belum ada kerja ${t} ${jendela(p.minggu)}.`);
  }
  const lintas = garis.filter((x) => x.lintas).sort((a, b) => b.lintas_poin - a.lintas_poin);
  for (const g of lintas) {
    const t = awalKecil(nama.get(g.topi_id) ?? "");
    const topinya = kertas.length ? `padahal topinya ${gabung(kertas)}` : "padahal belum memakai topi apa pun";
    hasil.push(g.persen_lintas !== null
      ? `${g.persen_lintas}% kerjanya urusan ${t} (lintas topi), ${topinya}.`
      : `${formatPoin(g.lintas_poin)} kerjanya urusan ${t} (lintas topi), ${topinya}. Persen muncul setelah minimal ${p.ambang} kerja selesai.`);
  }
  if (o.tanpa_topi_poin > 0) hasil.push(`${formatPoin(o.tanpa_topi_poin)} dari kerja tanpa topi.`);
  return hasil;
}

export type BagianTopi = { orang_id: string; nama: string; persen: number | null; poin: number; n: number; lintas: boolean; kertas: boolean };

/** Bagian nyata per topi, poin terbesar di atas; pemakai di atas kertas tanpa kerja ikut di bawah dengan 0 poin. */
export function bagianTopi(p: Peta, topiId: string): BagianTopi[] {
  const nama = new Map(p.orang.map((o) => [o.id, o.nama]));
  return p.garis
    .filter((g) => g.topi_id === topiId && nama.has(g.orang_id))
    .map((g) => ({ orang_id: g.orang_id, nama: nama.get(g.orang_id)!, persen: g.persen_topi, poin: g.poin, n: g.n, lintas: g.lintas, kertas: g.kertas }))
    .sort((a, b) => b.poin - a.poin || a.nama.localeCompare(b.nama, "id"));
}

/**
 * Kalimat satu topi: "Kasir: Sari 56%, Dewi 33% (lintas topi), Budi 11%." Topi dengan kerja kurang dari ambang tanpa persen:
 * "Pelayan: belum cukup kerja (2 kerja selesai, butuh 3)." Topi tanpa kerja menyebut pemakainya di atas kertas.
 */
export function kalimatTopi(p: Peta, topiId: string): string {
  const t = p.topi.find((x) => x.id === topiId);
  if (!t) return "";
  const bagian = bagianTopi(p, topiId);
  const dipakai = bagian.filter((b) => b.kertas).map((b) => b.nama);
  if (t.n === 0) {
    return `${t.nama}: belum ada kerja selesai ${jendela(p.minggu)}.${dipakai.length ? ` Dipakai ${gabung(dipakai)} di atas kertas.` : ""}`;
  }
  if (!t.cukup) {
    const siapa = bagian.filter((b) => b.n > 0).map((b) => `${b.nama}${b.lintas ? " (lintas topi)" : ""}`);
    return `${t.nama}: belum cukup kerja untuk persen (${kerjaTeks(t.n)}, butuh ${p.ambang}). Dikerjakan ${gabung(siapa)}.`;
  }
  const isi = bagian.filter((b) => b.n > 0).map((b) => `${b.nama} ${b.persen ?? 0}%${b.lintas ? " (lintas topi)" : ""}`);
  return `${t.nama}: ${isi.join(", ")}.`;
}

/** "Pemilik menyerahkan 3 kerja ke Sari (2 sudah selesai)." */
export function kalimatSerah(s: SerahPeta): string {
  const selesai = s.selesai_n === s.n ? "semua sudah selesai" : `${s.selesai_n} sudah selesai`;
  return `${s.pemberi_nama} menyerahkan ${s.n} kerja ke ${s.pelaksana_nama} (${selesai}).`;
}

/** Teks tombol utama dari saran SQL: "Pasang topi kasir ke Dewi". */
export const teksPasang = (s: Pick<SaranPeta, "topi_nama" | "orang_nama">) => `Pasang topi ${awalKecil(s.topi_nama)} ke ${s.orang_nama}`;

/** Dasar tombol: "60% kerja Dewi 4 minggu terakhir (6 dari 10 poin) urusan kasir." */
export const dasarSaran = (s: SaranPeta, minggu: number) =>
  `${s.persen}% kerja ${s.orang_nama} ${jendela(minggu)} (${angka(s.lintas_poin)} dari ${formatPoin(s.orang_poin)}) urusan ${awalKecil(s.topi_nama)}.`;

/** Ringkasan teks untuk pembaca layar pengganti graf (graf diberi aria-hidden). */
export function ringkasanGraf(p: Peta): string {
  const lintas = p.garis.filter((g) => g.lintas).length;
  return `Graf ${p.orang.length} orang dan ${p.topi.length} topi. ${lintas ? `${lintas} garis lintas topi.` : "Tanpa garis lintas topi."} Isi yang sama ada di tabel di bawahnya.`;
}
