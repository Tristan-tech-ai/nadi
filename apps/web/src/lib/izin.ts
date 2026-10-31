// Pembantu layar izin dan cuti (F1-03). Tanggal izin adalah tanggal kalender WITA (YYYY-MM-DD), bukan waktu.
import type { JenisCap } from "@/components/ui/cap";

export const JENIS_IZIN = [
  { kode: "sakit", label: "Sakit" },
  { kode: "izin", label: "Izin" },
  { kode: "cuti", label: "Cuti" },
] as const;
export type JenisIzin = (typeof JENIS_IZIN)[number]["kode"];

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const POLA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Tanggal hari ini di zona usaha, bentuk YYYY-MM-DD (nilai bawaan isian tanggal). */
export function hariIni(sekarang: Date = new Date(), zona = "Asia/Makassar"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(sekarang);
}

/** Zona IANA usaha dari perusahaan.zona_waktu; cadangan Asia/Jakarta sama dengan bawaan kolom dan app.zona di database. */
export function zonaSah(zona: unknown): string {
  if (typeof zona !== "string" || zona === "") return "Asia/Jakarta";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zona });
    return zona;
  } catch {
    return "Asia/Jakarta";
  }
}

const pecah = (t: string) => {
  const m = POLA.exec(t);
  return m ? { tahun: Number(m[1]), bulan: Number(m[2]), hari: Number(m[3]) } : null;
};

/** Jumlah hari kalender, termasuk hari pertama dan terakhir. 0 bila tidak sah atau terbalik. */
export function jumlahHari(mulai: string, selesai: string): number {
  const a = pecah(mulai);
  const b = pecah(selesai);
  if (!a || !b) return 0;
  const n = (Date.UTC(b.tahun, b.bulan - 1, b.hari) - Date.UTC(a.tahun, a.bulan - 1, a.hari)) / 86_400_000 + 1;
  return n >= 1 ? n : 0;
}

/** "3 Nov 2026", "3 sampai 5 Nov 2026", "30 Nov sampai 2 Des 2026", "30 Des 2026 sampai 2 Jan 2027". */
export function rentangTanggal(mulai: string, selesai: string): string {
  const a = pecah(mulai);
  const b = pecah(selesai);
  if (!a || !b) return "";
  const penuh = (x: { tahun: number; bulan: number; hari: number }) => `${x.hari} ${BULAN[x.bulan - 1]} ${x.tahun}`;
  if (mulai === selesai) return penuh(a);
  if (a.tahun !== b.tahun) return `${penuh(a)} sampai ${penuh(b)}`;
  if (a.bulan !== b.bulan) return `${a.hari} ${BULAN[a.bulan - 1]} sampai ${penuh(b)}`;
  return `${a.hari} sampai ${penuh(b)}`;
}

export function capStatus(status: string): { jenis: JenisCap; label: string } {
  if (status === "disetujui") return { jenis: "diterima", label: "Disetujui" };
  if (status === "ditolak") return { jenis: "ditolak", label: "Belum disetujui" };
  return { jenis: "menunggu", label: "Menunggu" };
}

/** Angka isian kebijakan: kosong berarti tanpa batas (null); selain bilangan bulat dalam rentang dianggap tidak sah. */
export function angkaIsian(nilai: FormDataEntryValue | null, min: number, maks: number): number | null | "salah" {
  const t = String(nilai ?? "").trim();
  if (t === "") return null;
  if (!/^\d+$/.test(t)) return "salah";
  const n = Number(t);
  return n >= min && n <= maks ? n : "salah";
}
