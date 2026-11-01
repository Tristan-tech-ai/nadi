import { formatAngka } from "@/lib/format";

/** Hasil RPC alur_proses / demo_lihat.alur (lihat supabase/migrations/20261101034000_alur_proses.sql). */
export type Alur = {
  jenis: "invoice" | "rekrut";
  hari: number;
  kasus: number;
  selesai: number;
  sesuai: number;
  siklus_hari: number | null;
  kertas: string[];
  langkah: { langkah: string; kasus: number }[];
  sisi: { dari: string; ke: string; jumlah: number; median_hari: number | null }[];
  varian: { jalur: string[]; jumlah: number; selesai: boolean }[];
  penyimpangan: { kode: string; jumlah: number; dari: number }[];
};

const URUTAN = ["terbit", "pengingat_1", "pengingat_2", "pengingat_3", "pengingat_4", "masuk", "ditinjau", "ditawari", "lunas", "batal", "diterima", "ditolak"];

const LABEL: Record<string, string> = {
  terbit: "Invoice terbit", lunas: "Lunas", batal: "Dibatalkan",
  masuk: "Lamaran masuk", ditinjau: "Ditinjau", ditawari: "Ditawari kerja", diterima: "Diterima", ditolak: "Ditolak",
};

export function labelLangkah(langkah: string): string {
  const p = /^pengingat_(\d)$/.exec(langkah);
  if (p) return `Pengingat ke-${p[1]}`;
  return LABEL[langkah] ?? langkah;
}

export function jalurTeks(jalur: string[]): string {
  return jalur.map(labelLangkah).join(" → ");
}

/** 2,2 hari; di bawah satu hari ditulis sebagai kalimat supaya tidak terbaca "0 hari". */
export function formatHari(hari: number | null): string {
  if (hari === null || Number.isNaN(hari)) return "belum ada";
  if (hari < 1) return "di hari yang sama";
  const bulat = Math.round(hari * 10) / 10;
  return `${Number.isInteger(bulat) ? formatAngka(bulat) : bulat.toLocaleString("id-ID", { maximumFractionDigits: 1 })} hari`;
}

const KALIMAT: Record<string, (j: number, d: number) => string> = {
  lunas_terlambat: (j, d) => `${formatAngka(j)} dari ${formatAngka(d)} invoice lunas lewat jatuh tempo.`,
  terlambat_tanpa_pengingat: (j) => `${formatAngka(j)} invoice lewat jatuh tempo tanpa satu pun pengingat dikirim.`,
  batal_setelah_pengingat: (j) => `${formatAngka(j)} invoice dibatalkan setelah pelanggan diingatkan.`,
  diterima_tanpa_tinjau: (j, d) => `${formatAngka(j)} dari ${formatAngka(d)} pelamar diterima tanpa ditinjau atau ditawari tertulis dulu.`,
  ditolak_tanpa_tinjau: (j, d) => `${formatAngka(j)} dari ${formatAngka(d)} pelamar ditolak tanpa ditinjau dulu.`,
  menggantung: (j) => `${formatAngka(j)} pelamar menunggu lebih dari 14 hari tanpa kabar.`,
};

/** Kalimat berangka untuk satu penyimpangan; null bila tidak terjadi (tidak ada pesan bila tidak penting) atau kode tidak dikenal. */
export function kalimatPenyimpangan(p: { kode: string; jumlah: number; dari: number }): string | null {
  if (!p.jumlah) return null;
  return KALIMAT[p.kode]?.(p.jumlah, p.dari) ?? null;
}

function posisi(langkah: string): number {
  const i = URUTAN.indexOf(langkah);
  return i < 0 ? URUTAN.length : i;
}

/** Sisi graf urut menurut letak langkah di alur (dari, lalu ke). */
export function sisiBerurut(alur: Alur): Alur["sisi"] {
  return [...alur.sisi].sort((a, b) => posisi(a.dari) - posisi(b.dari) || posisi(a.ke) - posisi(b.ke));
}

export function ringkasAlur(alur: Alur): string | null {
  if (!alur.kasus) return null;
  const benda = alur.jenis === "invoice" ? "invoice" : "lamaran";
  const awal = `${formatAngka(alur.kasus)} ${benda} dalam ${formatAngka(alur.hari)} hari terakhir.`;
  if (!alur.selesai) return `${awal} Belum ada yang selesai.`;
  return `${awal} ${formatAngka(alur.sesuai)} dari ${formatAngka(alur.selesai)} yang selesai mengikuti alur kertas.`;
}
