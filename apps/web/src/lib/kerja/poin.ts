// Poin Beban dan papan kerja (F3-01, docs/research/poin-beban.md). Fungsi murni; pembulatan dan teks menit sama dengan
// app.poin_dari_menit dan app.teks_menit di migrasi papan_kerja.
export const STATUS_KERJA = ["baru", "jalan", "tunggu", "review", "selesai"] as const;
export type StatusKerja = (typeof STATUS_KERJA)[number];
export const LABEL_STATUS: Record<StatusKerja, string> = { baru: "Baru", jalan: "Jalan", tunggu: "Tunggu", review: "Review", selesai: "Selesai" };

export type Estimasi = {
  menit: number;
  poin: number;
  sumber: "riwayat" | "model" | "manual";
  alasan: string;
  faktor: number | null;
  n: number | null;
  menit_model?: number | null;
  dihitung_at?: string;
};

export type KerjaPapan = {
  id: string;
  judul: string;
  status: StatusKerja;
  poin: number | null;
  tenggat: string | null;
  mulai_at: string | null;
  selesai_at: string | null;
  lintas_topi: boolean;
  estimasi: Estimasi | null;
  aktual_menit: number | null;
  jeda_menit: number | null;
  topi: { id: string; nama: string } | null;
  pelaksana: { id: string; nama: string } | null;
  saya: boolean;
  /** X-10: anggota tim dengan porsi (PIC lebih dulu) dan progres checklist. */
  tim?: { id: string; nama: string | null; porsi: number; pic: boolean }[];
  butir?: { selesai: number; total: number };
  /** X-11: tenggat awal (baseline) dan hasil terakhir yang dikirim. */
  tenggat_awal?: string | null;
  hasil?: { status: "menunggu" | "diterima" | "revisi"; tautan: string | null; catatan: string | null; alasan: string | null } | null;
};

/** "Sari 60% (PIC), Budi 40%" untuk kerja bertim; null bila satu pelaksana. */
export function teksTim(tim: KerjaPapan["tim"], bahasa: "id" | "en" = "id"): string | null {
  if (!tim || tim.length < 2) return null;
  return tim.map((x) => `${x.nama ?? (bahasa === "en" ? "someone" : "seseorang")} ${x.porsi}%${x.pic ? " (PIC)" : ""}`).join(", ");
}

export const MENIT_PER_POIN = 15;

/** Kelipatan 0,25 terdekat dari menit / 15, dibatasi 0,25..99. */
export function poinDariMenit(menit: number): number {
  return Math.min(99, Math.max(0.25, Math.round(menit / 3.75) * 0.25));
}

export function menitDariPoin(poin: number): number {
  return poin * MENIT_PER_POIN;
}

/** Isian poin ("1,5", "2", "1.3") dibulatkan ke 0,25; null bila bukan angka atau di luar 0,25..99. */
export function bacaPoin(teks: string): number | null {
  const t = teks.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null;
  const p = Math.round(Number(t) * 4) / 4;
  return p >= 0.25 && p <= 99 ? p : null;
}

type B = "id" | "en";

export function formatPoin(poin: number, bahasa: B = "id"): string {
  if (bahasa === "en") return `${poin} ${poin === 1 ? "point" : "points"}`;
  return `${String(poin).replace(".", ",")} poin`;
}

/** "kurang dari 1 menit", "42 menit", "1 jam", "1 jam 5 menit". */
export function formatMenit(menit: number, bahasa: B = "id"): string {
  const [kurang, mnt, jm] = bahasa === "en" ? ["under 1 minute", "min", "h"] : ["kurang dari 1 menit", "menit", "jam"];
  if (menit < 1) return kurang;
  const m = Math.round(menit);
  if (m < 60) return `${m} ${mnt}`;
  return m % 60 === 0 ? `${m / 60} ${jm}` : `${Math.floor(m / 60)} ${jm} ${m % 60} ${mnt}`;
}

/** "Selesai dalam 42 menit (perkiraan 30)". Tanpa nada menyalahkan bila lebih lama (VOICE prinsip 6). */
export function teksSelesai(aktual: number | null, perkiraan: number | null, bahasa: B = "id"): string {
  const en = bahasa === "en";
  if (aktual == null) return en ? "Done" : "Selesai";
  const p = perkiraan == null ? "" : ` (${en ? "estimate" : "perkiraan"} ${Math.round(perkiraan) < 60 ? Math.round(perkiraan) : formatMenit(perkiraan, bahasa)})`;
  return `${en ? "Done in" : "Selesai dalam"} ${formatMenit(aktual, bahasa)}${p}`;
}

/** Poin beserta sumbernya; jujur bila belum ada perkiraan. */
export function teksPoin(e: Estimasi | null, bahasa: B = "id"): string {
  if (bahasa === "en") {
    if (!e) return "Points not estimated yet; fill in manually";
    const sumber = e.sumber === "riwayat" ? `from ${e.n ?? "several"} similar tasks` : e.sumber === "model" ? "model estimate" : "entered manually";
    return `${formatPoin(e.poin, bahasa)}, ${sumber}`;
  }
  if (!e) return "Poin belum diperkirakan; isi manual";
  const sumber = e.sumber === "riwayat" ? `dari ${e.n ?? "beberapa"} kerja serupa` : e.sumber === "model" ? "perkiraan model" : "diisi manual";
  return `${formatPoin(e.poin)}, ${sumber}`;
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bagian(d: Date, zona: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: zona, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { tahun: Number(p.year), bulan: Number(p.month), hari: Number(p.day), jam: `${p.hour}.${p.minute}` };
}

/** "Hari ini, 15.00", "Besok, 09.30", "Kemarin, 09.30", "5 Nov, 09.30", "5 Jan 2027, 09.30" di zona usaha. */
export function formatTenggat(iso: string, sekarang: Date, zona: string, bahasa: B = "id"): string {
  const en = bahasa === "en";
  const t = bagian(new Date(iso), zona);
  const s = bagian(sekarang, zona);
  const hari = (b: { tahun: number; bulan: number; hari: number }) => Date.UTC(b.tahun, b.bulan - 1, b.hari) / 86_400_000;
  const selisih = hari(t) - hari(s);
  const tanggal = selisih === 0 ? (en ? "Today" : "Hari ini") : selisih === 1 ? (en ? "Tomorrow" : "Besok") : selisih === -1 ? (en ? "Yesterday" : "Kemarin")
    : `${t.hari} ${(en ? BULAN_EN : BULAN)[t.bulan - 1]}${t.tahun === s.tahun ? "" : ` ${t.tahun}`}`;
  return `${tanggal}, ${en ? t.jam.replace(".", ":") : t.jam}`;
}

export function ringkasStatus(daftar: KerjaPapan[]): Record<StatusKerja, number> {
  const r: Record<StatusKerja, number> = { baru: 0, jalan: 0, tunggu: 0, review: 0, selesai: 0 };
  for (const k of daftar) if (k.status in r) r[k.status] += 1;
  return r;
}

const URUT: Record<StatusKerja, number> = { jalan: 0, tunggu: 1, review: 2, baru: 3, selesai: 4 };

/** Layar staf: satu kerja aktif (jalan, lalu tunggu, lalu baru dengan tenggat terdekat), 5 berikutnya, dan yang selesai hari ini. */
export function pilihStaf(daftar: KerjaPapan[]): { aktif: KerjaPapan | null; berikutnya: KerjaPapan[]; selesai: KerjaPapan[] } {
  const terbuka = daftar
    .filter((k) => k.status !== "selesai")
    .map((k, i) => ({ k, i }))
    .sort((a, b) => URUT[a.k.status] - URUT[b.k.status]
      || (a.k.tenggat ? Date.parse(a.k.tenggat) : Infinity) - (b.k.tenggat ? Date.parse(b.k.tenggat) : Infinity)
      || a.i - b.i)
    .map((x) => x.k);
  return { aktif: terbuka[0] ?? null, berikutnya: terbuka.slice(1, 6), selesai: daftar.filter((k) => k.status === "selesai") };
}

/** Kolom papan yang dipilih lewat pil di HP (?kolom=). */
export function bacaKolom(nilai: string | string[] | undefined): StatusKerja {
  const v = Array.isArray(nilai) ? nilai[0] : nilai;
  return (STATUS_KERJA as readonly string[]).includes(v ?? "") ? (v as StatusKerja) : "baru";
}
