// Penafsir tampilan Nadi Mod (X-05): fungsi murni yang mengubah manifest + catatan menjadi apa yang ditampilkan dan
// mengubah isian formulir menjadi data catatan. Tidak ada HTML atau kode dari manifest yang dijalankan; label dan nilai
// ditampilkan sebagai teks oleh komponen tetap Nadi. Database tetap menegakkan semuanya (app.mod_cek_catatan, app.mod_akses,
// mod_catatan_status); fungsi di sini hanya menyusun tampilan dan pesan yang lebih cepat.
import { formatAngka, formatRupiah, formatTanggalKalender, waktuLokalKeIso } from "@/lib/format";
import { hitung, urai, type Nilai } from "./rumus";
import { AKSES, AKSES_MAKS, type Akses, type Bidang, type Koleksi, type Manifest, type Peran, type Transisi } from "./skema";

export type Catatan = {
  id: string; data: Record<string, unknown>; status: string | null; ditugaskan: string[];
  dibuat_oleh: string; dibuat_at: string; diubah_at: string;
};
export type Lihat = "daftar" | "papan" | "kalender";
/** Label rujukan per tipe: id -> teks (orang, pelanggan, produk, proyek, dan judul catatan koleksi lain). */
export type Label = Record<"orang" | "pelanggan" | "produk" | "proyek" | "rujukan", Map<string, string>>;

export const PER_HALAMAN = 25;
const KODE = /^[a-z][a-z0-9_]{0,29}$/;

export function koleksiDari(m: Manifest, kode?: string | null): Koleksi | null {
  return (kode ? m.koleksi.find((k) => k.kode === kode) : m.koleksi[0]) ?? null;
}
export const bidangDari = (k: Koleksi, kode: string): Bidang | undefined => k.bidang.find((b) => b.kode === kode);

/** Tampilan yang bisa dipilih untuk satu koleksi, sesuai urutan manifest; daftar selalu ada, papan hanya bila ada status. */
export function tampilanLihat(k: Koleksi): Lihat[] {
  const ada = k.tampilan.map((t) => t.jenis).filter((j): j is Lihat => j === "daftar" || j === "kalender" || (j === "papan" && !!k.status));
  return [...new Set(ada.includes("daftar") ? ada : ["daftar" as const, ...ada])];
}

/** Kolom, urutan bawaan, dan saringan daftar. Tanpa tampilan daftar: judul + 3 bidang pertama yang bukan teks panjang. */
export function aturDaftar(k: Koleksi): { kolom: string[]; urut?: { bidang: string; arah: "naik" | "turun" }; saring: string[] } {
  const t = k.tampilan.find((x) => x.jenis === "daftar");
  if (t && t.jenis === "daftar") return { kolom: t.kolom.filter((c) => bidangDari(k, c)), urut: t.urut, saring: (t.saring ?? []).filter((c) => bidangDari(k, c)) };
  const lain = k.bidang.filter((b) => b.kode !== k.judul && b.tipe !== "teks_panjang").slice(0, 3).map((b) => b.kode);
  return { kolom: [k.judul, ...lain], saring: [] };
}

/** Bidang formulir buat (dari tampilan formulir, atau semua bidang isian). Bidang rumus tidak pernah diisi. */
export function bidangFormulir(k: Koleksi): Bidang[] {
  const t = k.tampilan.find((x) => x.jenis === "formulir");
  const kode = t && t.jenis === "formulir" ? t.bidang : k.bidang.map((b) => b.kode);
  return kode.map((c) => bidangDari(k, c)).filter((b): b is Bidang => !!b && b.tipe !== "rumus");
}

/** Bidang rincian (dari tampilan rincian, atau semua bidang). */
export function bidangRincian(k: Koleksi): Bidang[] {
  const t = k.tampilan.find((x) => x.jenis === "rincian");
  const kode = t && t.jenis === "rincian" ? t.bidang : k.bidang.map((b) => b.kode);
  return kode.map((c) => bidangDari(k, c)).filter((b): b is Bidang => !!b);
}

/** Akses efektif peran: nilai manifest dibatasi AKSES_MAKS (sama dengan app.mod_akses). */
export function aksesPeran(k: Koleksi, peran: string): Akses {
  const p = (["pemilik", "admin", "akuntan", "staf"] as const).find((x) => x === peran);
  if (!p) return "tidak";
  const minta = k.akses[p] ?? "tidak";
  return AKSES.indexOf(minta) <= AKSES.indexOf(AKSES_MAKS[p]) ? minta : AKSES_MAKS[p];
}
export const bolehBuat = (a: Akses) => a === "milik_sendiri" || a === "tulis" || a === "kelola";
type Siapa = { uid: string; orang: string | null };
export function bolehUbah(a: Akses, c: Catatan, s: Siapa): boolean {
  if (a === "tulis" || a === "kelola") return true;
  return a === "milik_sendiri" && (c.dibuat_oleh === s.uid || (!!s.orang && c.ditugaskan.includes(s.orang)));
}

/** Transisi yang boleh dijalankan peran ini dari status catatan (cermin mod_catatan_status; database tetap memutuskan). */
export function transisiUntuk(k: Koleksi, c: Catatan, peran: string, s: Siapa): Transisi[] {
  if (!k.status) return [];
  const a = aksesPeran(k, peran);
  if (a === "tidak" || a === "lihat") return [];
  return k.status.transisi.filter((t) => (t.dari === "*" || t.dari.includes(c.status ?? "")) && t.ke !== c.status && (peran === "pemilik"
    || t.peran.includes(peran as Peran) || (t.peran.includes("pembuat") && c.dibuat_oleh === s.uid)
    || (t.peran.includes("ditugaskan") && !!s.orang && c.ditugaskan.includes(s.orang))));
}

export const labelStatus = (k: Koleksi, kode: string | null) => k.status?.daftar.find((s) => s.kode === kode)?.label ?? kode ?? "";
export const labelTransisi = (k: Koleksi, t: Transisi) => t.label ?? labelStatus(k, t.ke);

/**
 * Isian formulir menjadi data catatan. `ambil(kode)` mengembalikan semua nilai isian bernama kode. Hanya bidang di `bidang`
 * yang dibaca; data lama (`dasar`) dipertahankan untuk bidang lain, karena database mengganti data catatan utuh.
 */
export function bacaIsian(bidang: Bidang[], ambil: (kode: string) => string[], zona: string, dasar: Record<string, unknown> = {}):
  { data: Record<string, unknown>; galat: string[] } {
  const data: Record<string, unknown> = { ...dasar };
  const galat: string[] = [];
  for (const b of bidang) {
    if (b.tipe === "rumus" || !KODE.test(b.kode)) continue;
    const semua = ambil(b.kode).map((v) => v.trim()).filter((v) => v !== "");
    const v = semua[0] ?? "";
    delete data[b.kode];
    if (b.tipe === "centang") { data[b.kode] = semua.includes("ya"); continue; }
    if (b.tipe === "pilihan_banyak" || (b.tipe === "orang" && b.banyak)) {
      if (semua.length) data[b.kode] = [...new Set(semua)].slice(0, 50);
      else if (b.wajib) galat.push(`${b.label} wajib diisi`);
      continue;
    }
    if (v === "") { if (b.wajib) galat.push(`${b.label} wajib diisi`); continue; }
    if (b.tipe === "angka" || b.tipe === "rupiah") {
      const n = Number(b.tipe === "rupiah" ? v.replace(/[.\s]/g, "").replace(",", ".") : v.replace(",", "."));
      if (!Number.isFinite(n)) { galat.push(`${b.label} harus angka`); continue; }
      if ((b.min !== undefined && n < b.min) || (b.max !== undefined && n > b.max)) { galat.push(`${b.label} di luar batas`); continue; }
      data[b.kode] = n;
    } else if (b.tipe === "tanggal_jam") {
      const iso = waktuLokalKeIso(v, zona);
      if (!iso) { galat.push(`${b.label}: tanggal dan jam tidak sah`); continue; }
      data[b.kode] = iso;
    } else if (b.tipe === "tanggal") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { galat.push(`${b.label}: tanggal tidak sah`); continue; }
      data[b.kode] = v;
    } else if (b.tipe === "tautan") {
      if (!/^https:\/\/\S{3,}$/.test(v) || v.length > 2000) { galat.push(`${b.label} harus tautan https://`); continue; }
      data[b.kode] = v;
    } else {
      data[b.kode] = v.slice(0, b.tipe === "teks_panjang" ? 5000 : 500);
    }
  }
  return { data, galat };
}

/** Bagian tanggal-jam di zona usaha. */
function bagianZona(iso: string, zona: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { tanggal: `${p.year}-${p.month}-${p.day}`, jam: `${p.hour}:${p.minute}` };
}
/** Nilai isian datetime-local (YYYY-MM-DDTHH:MM) dari ISO, di zona usaha. */
export function isoKeLokal(iso: unknown, zona: string): string {
  const b = typeof iso === "string" ? bagianZona(iso, zona) : null;
  return b ? `${b.tanggal}T${b.jam}` : "";
}
/** Tanggal kalender (YYYY-MM-DD) catatan menurut bidang tanggal/tanggal_jam, di zona usaha. */
export function tanggalCatatan(nilai: unknown, tipe: Bidang["tipe"], zona: string): string | null {
  if (typeof nilai !== "string") return null;
  if (tipe === "tanggal") return /^\d{4}-\d{2}-\d{2}$/.test(nilai) ? nilai : null;
  return bagianZona(nilai, zona)?.tanggal ?? null;
}

/** Nilai rumus untuk satu catatan (null bila rumus tidak sah atau gagal dihitung). */
export function nilaiRumus(b: Bidang, data: Record<string, unknown>, sekarang = new Date()): Nilai {
  if (b.tipe !== "rumus" || !b.rumus) return null;
  try {
    const d: Record<string, Nilai> = {};
    for (const [k, v] of Object.entries(data)) d[k] = typeof v === "number" || typeof v === "string" || typeof v === "boolean" ? v : null;
    return hitung(urai(b.rumus), d, sekarang);
  } catch {
    return null;
  }
}

/** Teks tampilan satu nilai bidang. Nilai dari pengguna dikembalikan sebagai teks biasa (komponen tidak memakai HTML mentah). */
export function teksNilai(b: Bidang, data: Record<string, unknown>, label: Label, zona: string, sekarang = new Date()): string {
  const v = b.tipe === "rumus" ? nilaiRumus(b, data, sekarang) : data[b.kode];
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "";
  const satu = (x: unknown): string => {
    const s = String(x);
    switch (b.tipe) {
      case "rupiah": return typeof x === "number" ? formatRupiah(x) : s;
      case "angka": return typeof x === "number" ? (Number.isInteger(x) ? formatAngka(x) : String(x).replace(".", ",")) : s;
      case "tanggal": return formatTanggalKalender(s);
      case "tanggal_jam": { const p = bagianZona(s, zona); return p ? `${formatTanggalKalender(p.tanggal)}, ${p.jam.replace(":", ".")}` : s; }
      case "pilihan": case "pilihan_banyak": return b.pilihan?.find((p) => p.kode === s)?.label ?? s;
      case "centang": return x === true ? "Ya" : "Tidak";
      case "orang": case "pelanggan": case "produk": case "proyek": case "rujukan": return label[b.tipe].get(s) ?? "(tidak terbaca)";
      case "rumus": return typeof x === "number" ? (Number.isInteger(x) ? formatAngka(x) : x.toFixed(2).replace(".", ",")) : x instanceof Date ? formatTanggalKalender(x.toISOString().slice(0, 10)) : typeof x === "boolean" ? (x ? "Ya" : "Tidak") : s;
      default: return s;
    }
  };
  return Array.isArray(v) ? v.map(satu).join(", ") : satu(v);
}

/** Parameter daftar dari URL, hanya nilai yang sah menurut manifest (nama bidang tidak pernah diambil mentah dari URL). */
export type Param = { q: string; saring: Record<string, string>; urut: string; arah: "naik" | "turun"; hal: number; status: string };
export function bacaParam(k: Koleksi, sp: Record<string, string | string[] | undefined>): Param {
  const ambil = (n: string) => { const v = sp[n]; return (Array.isArray(v) ? v[0] : v) ?? ""; };
  const d = aturDaftar(k);
  const saring: Record<string, string> = {};
  for (const kode of d.saring) {
    const v = ambil(`s_${kode}`).slice(0, 64);
    const b = bidangDari(k, kode);
    if (!v || !b) continue;
    if ((b.tipe === "pilihan" || b.tipe === "pilihan_banyak") && !b.pilihan?.some((p) => p.kode === v)) continue;
    if (["orang", "pelanggan", "produk", "proyek", "rujukan"].includes(b.tipe) && !/^[0-9a-f-]{36}$/.test(v)) continue;
    saring[kode] = v;
  }
  const urutMinta = ambil("urut");
  const bisaUrut = new Set(["dibuat_at", "diubah_at", ...k.bidang.filter((b) => b.tipe !== "rumus" && b.tipe !== "pilihan_banyak" && !(b.tipe === "orang" && b.banyak)).map((b) => b.kode)]);
  const urut = bisaUrut.has(urutMinta) ? urutMinta : d.urut?.bidang && bisaUrut.has(d.urut.bidang) ? d.urut.bidang : "dibuat_at";
  const arahMinta = ambil("arah");
  const arah = arahMinta === "naik" || arahMinta === "turun" ? arahMinta : urutMinta ? "naik" : d.urut?.arah ?? "turun";
  const status = k.status?.daftar.some((s) => s.kode === ambil("status")) ? ambil("status") : "";
  const hal = Math.min(Math.max(1, Number.parseInt(ambil("hal"), 10) || 1), 800);
  // kata cari: tanpa karakter operator PostgREST dan wildcard (pelajaran M-23 wawasan)
  const q = ambil("q").replace(/[%_*,()\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return { q, saring, urut, arah, hal, status };
}

/** Kolom PostgREST untuk urut: angka dan rupiah dibandingkan sebagai jsonb (urut angka), lainnya sebagai teks. */
export function kolomUrut(k: Koleksi, urut: string): string {
  if (urut === "dibuat_at" || urut === "diubah_at") return urut;
  const b = bidangDari(k, urut);
  if (!b || !KODE.test(b.kode)) return "dibuat_at";
  return b.tipe === "angka" || b.tipe === "rupiah" ? `data->${b.kode}` : `data->>${b.kode}`;
}

/** Bulan kalender YYYY-MM yang sah (bawaan bulan berjalan), dengan hari-hari grid Senin pertama. */
export function bulanKalender(minta: string | undefined, hariIni: string): { bulan: string; mulai: string; akhir: string; sel: (string | null)[]; lalu: string; depan: string } {
  const bulan = minta && /^\d{4}-(0[1-9]|1[0-2])$/.test(minta) ? minta : hariIni.slice(0, 7);
  const [th, bl] = bulan.split("-").map(Number);
  const jumlah = new Date(Date.UTC(th, bl, 0)).getUTCDate();
  const geser = (new Date(Date.UTC(th, bl - 1, 1)).getUTCDay() + 6) % 7;
  const sel: (string | null)[] = [...Array(geser).fill(null), ...Array.from({ length: jumlah }, (_, i) => `${bulan}-${String(i + 1).padStart(2, "0")}`)];
  while (sel.length % 7) sel.push(null);
  const ke = (n: number) => { const d = new Date(Date.UTC(th, bl - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  return { bulan, mulai: `${bulan}-01`, akhir: `${bulan}-${String(jumlah).padStart(2, "0")}`, sel, lalu: ke(-1), depan: ke(1) };
}
