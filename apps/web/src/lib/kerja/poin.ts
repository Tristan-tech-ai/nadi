// Poin Beban dan papan kerja (F3-01, docs/research/poin-beban.md). Fungsi murni; pembulatan dan teks menit sama dengan
// app.poin_dari_menit dan app.teks_menit di migrasi papan_kerja.
export const STATUS_KERJA = ["baru", "jalan", "tunggu", "selesai"] as const;
export type StatusKerja = (typeof STATUS_KERJA)[number];
export const LABEL_STATUS: Record<StatusKerja, string> = { baru: "Baru", jalan: "Jalan", tunggu: "Tunggu", selesai: "Selesai" };

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
};

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

export function formatPoin(poin: number): string {
  return `${String(poin).replace(".", ",")} poin`;
}

/** "kurang dari 1 menit", "42 menit", "1 jam", "1 jam 5 menit". */
export function formatMenit(menit: number): string {
  if (menit < 1) return "kurang dari 1 menit";
  const m = Math.round(menit);
  if (m < 60) return `${m} menit`;
  return m % 60 === 0 ? `${m / 60} jam` : `${Math.floor(m / 60)} jam ${m % 60} menit`;
}

/** "Selesai dalam 42 menit (perkiraan 30)". Tanpa nada menyalahkan bila lebih lama (VOICE prinsip 6). */
export function teksSelesai(aktual: number | null, perkiraan: number | null): string {
  if (aktual == null) return "Selesai";
  const p = perkiraan == null ? "" : ` (perkiraan ${Math.round(perkiraan) < 60 ? Math.round(perkiraan) : formatMenit(perkiraan)})`;
  return `Selesai dalam ${formatMenit(aktual)}${p}`;
}

/** Poin beserta sumbernya; jujur bila belum ada perkiraan. */
export function teksPoin(e: Estimasi | null): string {
  if (!e) return "Poin belum diperkirakan; isi manual";
  const sumber = e.sumber === "riwayat" ? `dari ${e.n ?? "beberapa"} kerja serupa` : e.sumber === "model" ? "perkiraan model" : "diisi manual";
  return `${formatPoin(e.poin)}, ${sumber}`;
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function bagian(d: Date, zona: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: zona, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { tahun: Number(p.year), bulan: Number(p.month), hari: Number(p.day), jam: `${p.hour}.${p.minute}` };
}

/** "Hari ini, 15.00", "Besok, 09.30", "Kemarin, 09.30", "5 Nov, 09.30", "5 Jan 2027, 09.30" di zona usaha. */
export function formatTenggat(iso: string, sekarang: Date = new Date(), zona = "Asia/Makassar"): string {
  const t = bagian(new Date(iso), zona);
  const s = bagian(sekarang, zona);
  const hari = (b: { tahun: number; bulan: number; hari: number }) => Date.UTC(b.tahun, b.bulan - 1, b.hari) / 86_400_000;
  const selisih = hari(t) - hari(s);
  const tanggal = selisih === 0 ? "Hari ini" : selisih === 1 ? "Besok" : selisih === -1 ? "Kemarin"
    : `${t.hari} ${BULAN[t.bulan - 1]}${t.tahun === s.tahun ? "" : ` ${t.tahun}`}`;
  return `${tanggal}, ${t.jam}`;
}

export function ringkasStatus(daftar: KerjaPapan[]): Record<StatusKerja, number> {
  const r: Record<StatusKerja, number> = { baru: 0, jalan: 0, tunggu: 0, selesai: 0 };
  for (const k of daftar) if (k.status in r) r[k.status] += 1;
  return r;
}

const URUT: Record<StatusKerja, number> = { jalan: 0, tunggu: 1, baru: 2, selesai: 3 };

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
