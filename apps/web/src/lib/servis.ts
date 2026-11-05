// W-07B: teks untuk pelanggan order servis. Selalu bahasa Indonesia karena penerimanya pelanggan di Indonesia (keputusan 4 Nov 2026).
export const STATUS_PELANGGAN: Record<string, string> = {
  diterima: "Barang sudah kami terima", dikerjakan: "Sedang dikerjakan", selesai: "Selesai, siap diambil", diambil: "Sudah diambil", batal: "Dibatalkan",
};
export const URUTAN_SERVIS = ["diterima", "dikerjakan", "selesai", "diambil"] as const;

export function pesanStatusServis(v: { pelanggan: string; nomor: string; item: string; usaha: string; status: string; url: string }) {
  return `Halo ${v.pelanggan}, order ${v.nomor} (${v.item}) di ${v.usaha}: ${(STATUS_PELANGGAN[v.status] ?? v.status).toLowerCase()}. Cek status kapan saja: ${v.url}`;
}

/** Langkah ke-n (0..3) yang sudah dilewati dari urutan status; batal = -1. */
export const langkahServis = (status: string) => (status === "batal" ? -1 : URUTAN_SERVIS.indexOf(status as (typeof URUTAN_SERVIS)[number]));
