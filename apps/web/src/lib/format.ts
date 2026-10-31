// Format angka, uang, dan waktu menurut docs/design/VOICE.md (EYD: Rp tanpa spasi, titik ribuan, koma desimal).
const ANGKA = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ZONA: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Pontianak": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };

/** Rp1.250.000 / -Rp12.500,5. `ringkas` untuk kartu kecil: Rp1,25 jt, Rp850 rb, Rp3,1 M. */
export function formatRupiah(nilai: number, opsi: { ringkas?: boolean } = {}): string {
  if (!Number.isFinite(nilai)) return "Rp0";
  const tanda = nilai < 0 ? "-" : "";
  const n = Math.abs(nilai);
  if (opsi.ringkas) {
    const satuan: [number, string][] = [[1e12, " T"], [1e9, " M"], [1e6, " jt"], [1e3, " rb"]];
    for (const [batas, akhiran] of satuan) {
      if (n >= batas) {
        const v = n / batas;
        return `${tanda}Rp${new Intl.NumberFormat("id-ID", { maximumFractionDigits: v < 10 ? 2 : 1 }).format(v)}${akhiran}`;
      }
    }
  }
  return `${tanda}Rp${ANGKA.format(n)}`;
}

function bagian(tanggal: Date, zona: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: zona, year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(tanggal)
      .map((x) => [x.type, x.value]),
  );
  return { tahun: Number(p.year), bulan: Number(p.month), hari: Number(p.day), jam: p.hour, menit: p.minute };
}

// Waktu (Date) selalu ditampilkan di zona usaha yang dioper pemanggil (lib/zona-usaha.ts); tidak ada zona bawaan,
// supaya pemanggil yang lupa ditunjuk TypeScript. Tanggal kalender YYYY-MM-DD memakai formatTanggalKalender.

/** 31 Okt 2026 */
export function formatTanggal(tanggal: Date, zona: string): string {
  const b = bagian(tanggal, zona);
  return `${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`;
}

/** 14.30 WITA */
export function formatJam(tanggal: Date, zona: string, denganZona = true): string {
  const b = bagian(tanggal, zona);
  return `${b.jam}.${b.menit}${denganZona && ZONA[zona] ? ` ${ZONA[zona]}` : ""}`;
}

/** Tanggal kalender YYYY-MM-DD (tanggal izin, sesi, lembur, awal minggu) jadi 31 Okt 2026, tanpa zona. Teks lain dikembalikan apa adanya. */
export function formatTanggalKalender(teks: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(teks);
  const bulan = m ? Number(m[2]) : 0;
  return m && bulan >= 1 && bulan <= 12 ? `${Number(m[3])} ${BULAN[bulan - 1]} ${m[1]}` : teks;
}

/** Selisih jam dinding `zona` terhadap UTC (ms) pada saat `ms`. */
function selisihZona(ms: number, zona: string): number {
  const b = bagian(new Date(ms), zona);
  return Date.UTC(b.tahun, b.bulan - 1, b.hari, Number(b.jam), Number(b.menit)) - Math.floor(ms / 60_000) * 60_000;
}

/**
 * Isian datetime-local (YYYY-MM-DDTHH:MM) dibaca sebagai jam dinding di zona usaha, hasilnya ISO UTC untuk kolom timestamptz.
 * null bila bukan tanggal dan jam yang ada. Dua putaran agar tetap benar di zona bermusim panas.
 */
export function waktuLokalKeIso(teks: string, zona: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(teks);
  if (!m) return null;
  const [tahun, bulan, hari, jam, menit] = m.slice(1).map(Number);
  const dinding = Date.UTC(tahun, bulan - 1, hari, jam, menit);
  const d = new Date(dinding);
  if (d.getUTCFullYear() !== tahun || d.getUTCMonth() !== bulan - 1 || d.getUTCDate() !== hari || d.getUTCHours() !== jam || d.getUTCMinutes() !== menit) return null;
  const kira = dinding - selisihZona(dinding, zona);
  return new Date(dinding - selisihZona(kira, zona)).toISOString();
}

/** 92% dari 0,92 */
export function formatPersen(rasio: number): string {
  return `${Math.round(rasio * 100)}%`;
}

/** 20.021 dari 20021 (pemisah ribuan titik, EYD) */
export function formatAngka(nilai: number): string {
  return Math.round(nilai).toLocaleString("id-ID");
}
