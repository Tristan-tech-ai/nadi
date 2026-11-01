// Hitungan invoice murni (docs/research/invoice.md): total baris, jadwal pengingat bertahap, kelompok umur piutang, dan teks
// pengingat wa.me. Database menghitung ulang total dan jadwal yang sama (migrasi invoice); fungsi ini dipakai layar dan tes.
import { formatRupiah, formatTanggalKalender } from "@/lib/format";

/** Batas nominal QRIS per transaksi (Bank Indonesia, halaman QRIS, dibaca 1 Nov 2026). */
export const BATAS_QRIS = 10_000_000;

export type BarisInvoice = { uraian: string; jumlah: number; harga: number };

export function totalBaris(baris: readonly BarisInvoice[]): number {
  return baris.reduce((t, b) => t + Math.round(b.jumlah * b.harga), 0);
}

const geser = (t: string, n: number) => {
  const d = new Date(`${t}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const selisihHari = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/** Hari relatif jatuh tempo untuk tahap 1..4: H-3 ramah, H0, H+3 sopan, H+14 tegas. */
export const TAHAP_PENGINGAT = [-3, 0, 3, 14] as const;
export type Tahap = 1 | 2 | 3 | 4;

/** Jadwal pengingat; tahap yang tanggalnya sebelum tanggal terbit dilewati. */
export function jadwalPengingat(jatuhTempo: string, terbit: string): { tahap: Tahap; tanggal: string }[] {
  return TAHAP_PENGINGAT.map((h, i) => ({ tahap: (i + 1) as Tahap, tanggal: geser(jatuhTempo, h) })).filter((p) => p.tanggal >= terbit);
}

export type Umur = "belum" | "1-30" | "31-60" | "61-90" | "90+";
export const LABEL_UMUR: Record<Umur, string> = {
  belum: "Belum jatuh tempo", "1-30": "Lewat 1-30 hari", "31-60": "Lewat 31-60 hari", "61-90": "Lewat 61-90 hari", "90+": "Lewat lebih dari 90 hari",
};

/** Kelompok umur piutang menurut hari lewat jatuh tempo. */
export function kelompokUmur(jatuhTempo: string, hariIni: string): Umur {
  const lewat = selisihHari(hariIni, jatuhTempo);
  return lewat <= 0 ? "belum" : lewat <= 30 ? "1-30" : lewat <= 60 ? "31-60" : lewat <= 90 ? "61-90" : "90+";
}

export type DataPengingat = { usaha: string; pelanggan: string; nomor: string; total: number; jatuhTempo: string; tautan: string };

/** Teks pesan wa.me per tahap. Nada naik pelan; tidak pernah mengancam atau mempermalukan. */
export function teksPengingat(tahap: Tahap, d: DataPengingat): string {
  const tgl = formatTanggalKalender(d.jatuhTempo);
  const rp = formatRupiah(d.total);
  switch (tahap) {
    case 1:
      return `Halo ${d.pelanggan}, dari ${d.usaha}. Mengingatkan tagihan ${d.nomor} sebesar ${rp} jatuh tempo ${tgl}. Rinciannya dan cara bayar ada di sini: ${d.tautan}. Terima kasih.`;
    case 2:
      return `Halo ${d.pelanggan}, tagihan ${d.nomor} dari ${d.usaha} sebesar ${rp} jatuh tempo hari ini (${tgl}). Bisa dibayar lewat ${d.tautan}. Kalau sudah dibayar, abaikan pesan ini.`;
    case 3:
      return `Halo ${d.pelanggan}, tagihan ${d.nomor} sebesar ${rp} sudah lewat jatuh tempo ${tgl}. Mohon dibayar lewat ${d.tautan}, atau kabari kami kapan bisa dibayar.`;
    case 4:
      return `Halo ${d.pelanggan}, tagihan ${d.nomor} dari ${d.usaha} sebesar ${rp} sudah lewat 14 hari dari jatuh tempo ${tgl}. Mohon diselesaikan minggu ini lewat ${d.tautan}, atau balas pesan ini untuk membicarakan jadwal bayar.`;
  }
}

/** Pesan pertama saat invoice dibagikan (sebelum pengingat bertahap). */
export function teksKirim(d: DataPengingat): string {
  return `Halo ${d.pelanggan}, berikut invoice ${d.nomor} dari ${d.usaha} sebesar ${formatRupiah(d.total)}, jatuh tempo ${formatTanggalKalender(d.jatuhTempo)}. Rincian dan cara bayar: ${d.tautan}`;
}

/** Tautan wa.me berisi pesan; null bila nomor tidak ada. */
export function tautanWa(hp: string | null | undefined, teks: string): string | null {
  return hp ? `https://wa.me/${hp}?text=${encodeURIComponent(teks)}` : null;
}
