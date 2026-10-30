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

/** 31 Okt 2026 */
export function formatTanggal(tanggal: Date, zona = "Asia/Makassar"): string {
  const b = bagian(tanggal, zona);
  return `${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`;
}

/** 14.30 WITA */
export function formatJam(tanggal: Date, zona = "Asia/Makassar", denganZona = true): string {
  const b = bagian(tanggal, zona);
  return `${b.jam}.${b.menit}${denganZona && ZONA[zona] ? ` ${ZONA[zona]}` : ""}`;
}

/** 92% dari 0,92 */
export function formatPersen(rasio: number): string {
  return `${Math.round(rasio * 100)}%`;
}
