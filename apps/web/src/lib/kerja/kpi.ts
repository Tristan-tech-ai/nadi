// KPI dari jejak (F3-03, docs/design/kpi-cermin.md). Fungsi murni, 0 token: angka dan daftar kerja datang dari public.kpi_saya /
// public.kpi_minggu (migrasi kpi); modul ini hanya menyusunnya menjadi kalimat. Tidak ada skor gabungan dan tidak ada model AI.
// Nada tidak menyalahkan (VOICE prinsip 6): "2 kerja lewat tenggat", bukan "kamu terlambat 2 kali".
import { formatMenit, formatPoin } from "./poin";

export type Lewat = { id: string; judul: string; lewat_menit: number; tanggal: string };
export type StatusBanding = "menunggu" | "diterima" | "ditolak";
export type RincianKerja = {
  id: string;
  judul: string;
  poin: number;
  /** Tanggal selesai di zona usaha (YYYY-MM-DD). */
  tanggal: string;
  selesai_at: string;
  tenggat: string | null;
  lewat_menit: number | null;
  lintas_topi: boolean;
  banding: StatusBanding | null;
};
type Ukuran = { nilai: number; ids: string[]; kosong: string | null };
export type Kpi = {
  id: string;
  nama: string;
  poin_selesai: Ukuran & { kerja: number };
  tepat: Ukuran & { dari: number; lewat: Lewat[] };
  lintas: Ukuran & { kerja: number };
  hadir: { nilai: null; alasan: string };
  minggu_lalu: { poin_selesai: number; kerja: number; tepat: number; bertenggat: number; lintas_poin: number };
  rincian: RincianKerja[];
};
export type RataTim = { n: number; poin_selesai: number; lintas_poin: number; tepat_persen: number | null } | null;
export type KpiSaya = { mulai: string; akhir: string; zona: string; orang: Kpi | null; rata_rata_tim: RataTim };
export type KpiMinggu = { mulai: string; akhir: string; zona: string; selesai_n: number; orang: Kpi[]; rata_rata_tim: RataTim };

/** Minimal kerja selesai di kedua minggu sebelum naik/turun ditampilkan (ambang sama dengan bagi-adil). */
export const MIN_BANDING = 5;
/** Banyak judul kerja yang disebut dalam satu kalimat; sisanya "dan N lainnya" (daftar lengkap di "lihat rinciannya"). */
export const MAKS_SEBUT = 3;
export const BELUM_CUKUP = "belum cukup kerja untuk dibandingkan";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const KATA = ["Nol", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh"];

/** "2,5", "6": angka Indonesia tanpa nol berlebih, paling banyak 2 desimal. */
export const angka = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");

/** Nama hari dari tanggal zona usaha "2026-10-20" -> "Selasa". */
export function namaHari(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? tanggal : HARI[d.getUTCDay()];
}

/** Awal kalimat: "Dua", "Sepuluh", lalu angka biasa. */
export function kataBilangan(n: number): string {
  return Number.isInteger(n) && n >= 0 && n < KATA.length ? KATA[n] : String(n);
}

function daftar(nama: string[], total: number): string {
  const sisa = total - nama.length;
  return sisa > 0 ? `${nama.join(", ")}, dan ${sisa} lainnya` : nama.join(", ");
}

/** "Tepat tenggat 8 dari 10. Dua yang lewat: Cek stok beras (Selasa, lewat 40 menit), Setor kas (Jumat, lewat 1 jam)." */
export function kalimatTepat(t: Kpi["tepat"]): string {
  if (t.dari === 0) return t.kosong ?? "Belum ada kerja bertenggat yang selesai minggu ini.";
  const awal = `Tepat tenggat ${t.nilai} dari ${t.dari}.`;
  if (t.lewat.length === 0) return `${awal} Tidak ada yang lewat.`;
  const sebut = t.lewat.slice(0, MAKS_SEBUT).map((l) => `${l.judul} (${namaHari(l.tanggal)}, lewat ${formatMenit(l.lewat_menit)})`);
  return `${awal} ${kataBilangan(t.lewat.length)} yang lewat: ${daftar(sebut, t.lewat.length)}.`;
}

/** "7 poin dari 4 kerja selesai: Setor kas (3 poin), Cek stok beras (2 poin), Tutup kas (1 poin), dan 1 lainnya." */
export function kalimatPoin(p: Kpi["poin_selesai"], rincian: readonly RincianKerja[]): string {
  if (p.kerja === 0) return p.kosong ?? "Belum ada kerja selesai minggu ini.";
  const urut = [...rincian].sort((a, b) => b.poin - a.poin || a.selesai_at.localeCompare(b.selesai_at));
  const sebut = urut.slice(0, MAKS_SEBUT).map((k) => `${k.judul} (${formatPoin(Number(k.poin))})`);
  return `${formatPoin(p.nilai)} dari ${p.kerja} kerja selesai: ${daftar(sebut, p.kerja)}.`;
}

/** Lintas topi selalu kontribusi: "1 poin dari 1 kerja lintas topi: Cuci gelas. Dihitung sebagai bantuan, tidak mengurangi angka lain." */
export function kalimatLintas(l: Kpi["lintas"], rincian: readonly RincianKerja[]): string {
  if (l.kerja === 0) return l.kosong ?? "Belum ada kerja lintas topi minggu ini.";
  const judul = rincian.filter((k) => k.lintas_topi).map((k) => k.judul);
  return `${formatPoin(l.nilai)} dari ${l.kerja} kerja lintas topi: ${daftar(judul.slice(0, MAKS_SEBUT), l.kerja)}. Dihitung sebagai bantuan, tidak mengurangi angka lain.`;
}

/** "naik 6", "turun 2,5", "sama". */
export function teksNaikTurun(selisih: number): string {
  if (Math.abs(selisih) < 0.005) return "sama";
  return selisih > 0 ? `naik ${angka(selisih)}` : `turun ${angka(-selisih)}`;
}

export type Banding = { teks: string; arah: "naik" | "turun" | "sama" | null };

/** Pembanding dengan minggu lalu; disembunyikan bila salah satu minggu punya kurang dari MIN_BANDING kerja selesai. */
export function banding(sekarang: number, lalu: number, kerjaSekarang: number, kerjaLalu: number, satuan = ""): Banding {
  if (kerjaSekarang < MIN_BANDING || kerjaLalu < MIN_BANDING) return { teks: BELUM_CUKUP, arah: null };
  const teks = teksNaikTurun(sekarang - lalu);
  const arah = teks === "sama" ? "sama" : teks.startsWith("naik") ? "naik" : "turun";
  return { teks: teks === "sama" ? "sama dengan minggu lalu" : `${teks}${satuan} dari minggu lalu`, arah };
}

/** Persen tepat tenggat (bulat), null bila tidak ada kerja bertenggat. */
export const persen = (tepat: number, dari: number) => (dari > 0 ? Math.round((100 * tepat) / dari) : null);

/** Tepat tenggat dibandingkan dalam persen kedua minggu ("naik dari 70% ke 80%"), bukan selisih yang terbaca sebagai persen naik. */
export function bandingTepat(sekarang: number | null, lalu: number | null, kerjaSekarang: number, kerjaLalu: number): Banding | null {
  if (sekarang === null) return null;
  if (lalu === null) return { teks: BELUM_CUKUP, arah: null };
  const b = banding(sekarang, lalu, kerjaSekarang, kerjaLalu);
  return b.arah === "naik" || b.arah === "turun" ? { teks: `${b.arah} dari ${lalu}% ke ${sekarang}%`, arah: b.arah } : b;
}

export type BarisUkuran = {
  kunci: "poin" | "tepat" | "lintas" | "hadir";
  label: string;
  angka: string;
  penjelasan: string;
  banding: Banding | null;
  rata: string | null;
  /** Id kerja yang dihitung (bahan "lihat rinciannya"). Kosong bila angkanya 0 atau belum dihitung. */
  ids: string[];
};

/** Empat ukuran satu orang, urut seperti layar (docs/design/kpi-cermin.md). */
export function ukuranKpi(k: Kpi, tim: RataTim): BarisUkuran[] {
  const lalu = k.minggu_lalu;
  const nSekarang = k.poin_selesai.kerja;
  const tepatSekarang = persen(k.tepat.nilai, k.tepat.dari);
  const tepatLalu = persen(lalu.tepat, lalu.bertenggat);
  const timKosong = "Rata-rata tim tampil bila minimal 3 orang punya kerja selesai minggu ini.";
  return [
    {
      kunci: "poin", label: "Kerja selesai", angka: formatPoin(k.poin_selesai.nilai), penjelasan: kalimatPoin(k.poin_selesai, k.rincian),
      banding: banding(k.poin_selesai.nilai, lalu.poin_selesai, nSekarang, lalu.kerja, " poin"),
      rata: tim ? `Rata-rata tim ${formatPoin(tim.poin_selesai)}.` : timKosong, ids: k.poin_selesai.ids,
    },
    {
      kunci: "tepat", label: "Tepat tenggat", angka: k.tepat.dari ? `${k.tepat.nilai} dari ${k.tepat.dari}` : "Belum ada", penjelasan: kalimatTepat(k.tepat),
      banding: bandingTepat(tepatSekarang, tepatLalu, nSekarang, lalu.kerja),
      rata: tim?.tepat_persen != null ? `Tim tepat tenggat ${tim.tepat_persen}%.` : null, ids: k.tepat.ids,
    },
    {
      kunci: "lintas", label: "Kerja lintas topi", angka: formatPoin(k.lintas.nilai), penjelasan: kalimatLintas(k.lintas, k.rincian),
      banding: null, rata: tim ? `Rata-rata tim ${formatPoin(tim.lintas_poin)}.` : null, ids: k.lintas.ids,
    },
    { kunci: "hadir", label: "Hadir sesuai jadwal", angka: "Belum dihitung", penjelasan: k.hadir.alasan, banding: null, rata: null, ids: [] },
  ];
}

/** Teks status banding di rincian. Tanpa nada menyalahkan; pemilik yang memutuskan. */
export function teksBanding(s: StatusBanding | null): string | null {
  if (s === "menunggu") return "Sudah ditandai keliru, menunggu pemilik.";
  if (s === "diterima") return "Tanda keliru disetujui pemilik.";
  if (s === "ditolak") return "Tanda keliru sudah ditinjau pemilik; angka tetap.";
  return null;
}
