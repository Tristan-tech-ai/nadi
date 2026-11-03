// Pembagi kerja adil (F3-02, docs/research/bagi-adil-algoritma.md). Fungsi murni, 0 token. Pilihan pelaksana di sini sama
// dengan public.usulan_pelaksana di migrasi bagi_adil: beban sesudah menerima kerja = (poin + antre + t) / jam, yang terkecil
// menang; seri diputus dengan yang paling lama tidak diberi kerja (belum pernah = paling lama), lalu id.
import { formatPoin } from "./poin";

export type OrangBeban = {
  id: string;
  nama?: string;
  /** Jam jadwal minggu ini (F3-06; sebelum ada jadwal semua orang 40). */
  jam: number;
  /** Poin minggu ini: kerja selesai + berjalan, dari poin estimasi (bukan durasi aktual). */
  poin: number;
  /** Poin kerja yang sudah ditugaskan tetapi belum dimulai. Ikut menentukan usulan agar usulan beruntun tidak menumpuk. */
  antre?: number;
  /** Id topi yang sedang dipakai. */
  topi: readonly string[];
  /** Waktu terakhir diberi kerja (ms); null = belum pernah. */
  terakhirDiberi: number | null;
};

export type KerjaBaru = { id: string; poin: number; topi: string };
export type Penugasan = { kerja: string; orang: string | null };
export type HasilBagi = { penugasan: Penugasan[]; orang: OrangBeban[] };

const EPS = 1e-9;
const sama = (a: number, b: number) => Math.abs(a - b) <= EPS * Math.max(1, Math.abs(a), Math.abs(b));

/** Beban per jam: poin minggu ini dibagi jam jadwal (tanpa antre; antre hanya dipakai untuk memilih pelaksana). */
export function bebanPerJam(o: Pick<OrangBeban, "poin" | "jam">): number {
  return o.jam > 0 ? o.poin / o.jam : 0;
}

/**
 * Koefisien Gini dengan rumus selisih rata-rata absolut: G = (sum_i sum_j |x_i - x_j|) / (2 n^2 mu).
 * 0 = rata, makin besar makin timpang. Daftar kosong atau semuanya 0: 0.
 */
export function gini(nilai: readonly number[]): number {
  const n = nilai.length;
  if (n === 0) return 0;
  const jumlah = nilai.reduce((a, b) => a + b, 0);
  if (jumlah <= 0) return 0;
  // Jumlah ganda apa adanya (UMKM < 100 orang, jadi n^2 murah); 2 n^2 mu = 2 n * jumlah.
  let selisih = 0;
  for (const a of nilai) for (const b of nilai) selisih += Math.abs(a - b);
  return selisih / (2 * n * jumlah);
}

/** Bandingkan dua kandidat: beban sesudah menerima t poin, lalu paling lama tidak diberi kerja, lalu id. */
function lebihRingan(a: OrangBeban, b: OrangBeban, t: number): number {
  const ba = ((a.poin + (a.antre ?? 0)) + t) / a.jam;
  const bb = ((b.poin + (b.antre ?? 0)) + t) / b.jam;
  if (!sama(ba, bb)) return ba - bb;
  if (a.terakhirDiberi !== b.terakhirDiberi) {
    if (a.terakhirDiberi === null) return -1;
    if (b.terakhirDiberi === null) return 1;
    return a.terakhirDiberi - b.terakhirDiberi;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export type Usulan = { orang: OrangBeban; kandidat: number; seriDengan: OrangBeban | null };

/** Usulan pelaksana untuk satu kerja bertopi `topi` seberat `t` poin. null bila tidak ada orang aktif yang memakai topi itu. */
export function usulkanPelaksana(orang: readonly OrangBeban[], topi: string, t: number): Usulan | null {
  const kandidat = orang.filter((o) => o.jam > 0 && o.topi.includes(topi)).sort((a, b) => lebihRingan(a, b, t));
  if (kandidat.length === 0) return null;
  const [pilih, kedua] = kandidat;
  const beban = (o: OrangBeban) => (o.poin + (o.antre ?? 0) + t) / o.jam;
  return { orang: pilih, kandidat: kandidat.length, seriDengan: kedua && sama(beban(pilih), beban(kedua)) ? kedua : null };
}

/**
 * Pembagi adil v1: kerja diurutkan dari poin terbesar (seri: urutan masuk), tiap kerja ke kandidat bertopi cocok dengan beban
 * per jam sesudah menerima kerja paling kecil. Kerja yang dibagi dalam satu kali bagi dianggap diberikan pada saat yang sama
 * (`sekarang`), sama seperti kerja yang dibuat dalam satu transaksi database (dibuat_at = now()).
 */
export function bagiAdil(orang: readonly OrangBeban[], kerja: readonly KerjaBaru[], sekarang = 0): HasilBagi {
  const kini = orang.map((o) => ({ ...o }));
  const urut = kerja.map((k, i) => ({ k, i })).sort((a, b) => b.k.poin - a.k.poin || a.i - b.i).map((x) => x.k);
  const penugasan: Penugasan[] = [];
  for (const k of urut) {
    const u = usulkanPelaksana(kini, k.topi, k.poin);
    if (u) {
      u.orang.poin += k.poin;
      u.orang.terakhirDiberi = sekarang;
    }
    penugasan.push({ kerja: k.id, orang: u?.orang.id ?? null });
  }
  return { penugasan, orang: kini };
}

/**
 * Pembanding rakus (kebiasaan yang membuat P11): setiap kerja ke orang yang poin awalnya terbesar di antara kandidat bertopi
 * cocok, yaitu yang "paling bisa diandalkan". Seri: id.
 */
export function bagiRakus(orang: readonly OrangBeban[], kerja: readonly KerjaBaru[]): HasilBagi {
  const kini = orang.map((o) => ({ ...o }));
  const awal = new Map(orang.map((o) => [o.id, o.poin]));
  const penugasan: Penugasan[] = [];
  for (const k of kerja) {
    const kandidat = kini
      .filter((o) => o.jam > 0 && o.topi.includes(k.topi))
      .sort((a, b) => awal.get(b.id)! - awal.get(a.id)! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const pilih = kandidat[0];
    if (pilih) pilih.poin += k.poin;
    penugasan.push({ kerja: k.id, orang: pilih?.id ?? null });
  }
  return { penugasan, orang: kini };
}

/** Satu kalimat alasan usulan (sama dengan teks di public.usulan_pelaksana). */
export function alasanUsulan(u: Usulan, namaTopi: string): string {
  const nama = u.orang.nama ?? u.orang.id;
  const topi = namaTopi.toLowerCase();
  if (u.kandidat === 1) return `${nama}: satu-satunya yang memakai topi ${topi}, ${formatPoin(u.orang.poin)} minggu ini.`;
  const antre = u.orang.antre ? ` dan ${formatPoin(u.orang.antre)} antre` : "";
  const seri = u.seriDengan ? `; sama ringan dengan ${u.seriDengan.nama ?? u.seriDengan.id}` : "";
  return `${nama}: ${formatPoin(u.orang.poin)} minggu ini${antre}, paling ringan di antara ${topi}${seri}.`;
}

export type RingkasBeban = {
  /** Orang dengan beban per jam terbesar (> 0), atau null. */
  terberat: { id: string; nama: string; porsiPoin: number; porsiJam: number } | null;
  gini: number;
  totalPoin: number;
};

/** Ringkasan layar beban: yang paling berat beserta porsi poin dan porsi jamnya (persen bulat), dan Gini beban per jam. */
export function ringkasBeban(orang: readonly (OrangBeban & { nama: string })[]): RingkasBeban {
  const totalPoin = orang.reduce((a, o) => a + o.poin, 0);
  const totalJam = orang.reduce((a, o) => a + o.jam, 0);
  let terberat: (OrangBeban & { nama: string }) | null = null;
  for (const o of orang) if (o.poin > 0 && (!terberat || bebanPerJam(o) > bebanPerJam(terberat) + EPS)) terberat = o;
  return {
    terberat: terberat && totalPoin > 0 && totalJam > 0
      ? { id: terberat.id, nama: terberat.nama, porsiPoin: Math.round((terberat.poin / totalPoin) * 100), porsiJam: Math.round((terberat.jam / totalJam) * 100) }
      : null,
    gini: gini(orang.map(bebanPerJam)),
    totalPoin,
  };
}

/**
 * Kolom daftar beban (Q-30, docs/design/beban-tanpa-jam.md): selama jam kerja belum diatur (semua orang dianggap 40 jam),
 * kolom jam dan poin per jam tidak ditampilkan dan batang perbandingan memakai poin; bila jam dari jadwal, memakai poin per jam.
 */
export function kolomBeban(jamSamaRata: boolean, orang: readonly { poin: number; jam: number }[]) {
  const nilai = (o: { poin: number; jam: number }) => (jamSamaRata ? o.poin : o.jam > 0 ? o.poin / o.jam : 0);
  const terbesar = Math.max(0, ...orang.map(nilai));
  return {
    pakaiJam: !jamSamaRata,
    lebar: (o: { poin: number; jam: number }) => (terbesar > 0 ? Math.max(2, Math.round((nilai(o) / terbesar) * 100)) : 0),
  };
}

const koma = (x: number, digit: number) => String(Math.round(x * 10 ** digit) / 10 ** digit).replace(".", ",");

/**
 * Teks kolom jam dan poin per jam bila jam dari jadwal shift (beban_jadwal): jam pecahan berkoma; orang tanpa shift minggu itu
 * berjam 0, jadi poin per jamnya tidak ada ("-"), bukan hasil bagi nol.
 */
export function teksJamBeban(o: { poin: number; jam: number }, bahasa: "id" | "en" = "id"): { jam: string; perJam: string | null } {
  if (bahasa === "en") {
    const titik = (x: number, d: number) => String(Math.round(x * 10 ** d) / 10 ** d);
    return o.jam > 0 ? { jam: `${titik(o.jam, 1)} h`, perJam: titik(o.poin / o.jam, 2) } : { jam: "no shift", perJam: null };
  }
  return o.jam > 0 ? { jam: `${koma(o.jam, 1)} jam`, perJam: koma(o.poin / o.jam, 2) } : { jam: "tanpa shift", perJam: null };
}

/** Minimal kerja selesai minggu ini sebelum beban dibandingkan (docs/design/bagi-adil.md). */
export const MIN_SELESAI = 5;

/** Satu baris public.beban_minggu. */
export type BarisBeban = {
  id: string;
  nama: string;
  topi: string[];
  poin: number;
  antre: number;
  jam: number;
  beban_per_jam: number;
  lintas_poin: number;
  lintas_n: number;
  selesai_n: number;
  terakhir_diberi: string | null;
};
export type BebanMinggu = { mulai: string; akhir: string; jam_sama_rata: boolean; jam_bawaan: number; selesai_n: number; orang: BarisBeban[] };
/**
 * Satu jawaban public.beban_saya. Sejak Q-27, n dan n_kelompok = jumlah orang yang memakai papan kerja minggu itu (poin, antre,
 * atau kerja selesai > 0); rata_rata null bila kelompok itu kurang dari 3 orang.
 */
export type BebanSaya = { mulai: string; akhir: string; poin: number | null; n: number; n_kelompok?: number; rata_rata: number | null; di_atas: boolean };

/** Minimal orang di kelompok pembanding sebelum rata-rata tim tampil (sama dengan public.beban_saya). */
export const MIN_KELOMPOK = 3;

const angka = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");

/**
 * "Sari memikul 31% kerja minggu ini dengan 20% jam kerja." Tanpa kata sifat (docs/design/bagi-adil.md).
 * Bila jam kerja belum diatur (semua orang dianggap sama), porsi jam hanya anggapan, jadi tidak disebut (Q-28, docs/research/beban-per-jam.md).
 */
export function kalimatTerberat(r: RingkasBeban, jamSamaRata = false, bahasa: "id" | "en" = "id"): string | null {
  if (!r.terberat) return null;
  if (bahasa === "en") {
    const awal = `${r.terberat.nama} carries ${r.terberat.porsiPoin}% of this week's work`;
    return jamSamaRata ? `${awal}.` : `${awal} with ${r.terberat.porsiJam}% of the working hours.`;
  }
  const awal = `${r.terberat.nama} memikul ${r.terberat.porsiPoin}% kerja minggu ini`;
  return jamSamaRata ? `${awal}.` : `${awal} dengan ${r.terberat.porsiJam}% jam kerja.`;
}

/**
 * Layar staf: "Minggu ini 18 poin. Rata-rata tim 15." Tanpa nama rekan. Rata-rata tim tidak pernah tertulis nol (Q-27,
 * docs/design/rata-rata-beban.md): kelompok di bawah 3 orang menjelaskan kapan rata-rata tampil, rata-rata di bawah 0,1 ditulis
 * belum ada.
 */
export function teksBebanSaya(b: BebanSaya, bahasa: "id" | "en" = "id"): string {
  if (bahasa === "en") {
    if (b.poin === null) return "Your workload this week is not recorded because your account is not linked to a staff record in this business.";
    const kelompok = b.n_kelompok ?? b.n;
    const titik = (x: number) => String(Math.round(x * 100) / 100);
    const rata = b.rata_rata === null || kelompok < MIN_KELOMPOK
      ? "The team average shows when at least 3 people use the work board this week."
      : b.rata_rata < 0.1 ? "No team average yet." : `Team average ${titik(b.rata_rata)}.`;
    return `This week ${titik(b.poin)} points. ${rata}`;
  }
  if (b.poin === null) return "Bebanmu minggu ini belum tercatat karena akunmu belum terhubung ke data orang di usaha ini.";
  const kelompok = b.n_kelompok ?? b.n;
  const rata = b.rata_rata === null || kelompok < MIN_KELOMPOK
    ? "Rata-rata tim tampil bila minimal 3 orang memakai papan kerja minggu ini."
    : b.rata_rata < 0.1 ? "Rata-rata tim belum ada." : `Rata-rata tim ${angka(b.rata_rata)}.`;
  return `Minggu ini ${angka(b.poin)} poin. ${rata}`;
}
