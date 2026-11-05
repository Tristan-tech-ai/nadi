// M-15: tahap deal (sama dengan check constraint public.deal.tahap) untuk layar Pelanggan dan deal.
// Modul biasa (bukan "use client") agar komponen server dan klien memakai nilai yang sama: nilai yang diekspor dari modul
// "use client" sampai di komponen server sebagai referensi klien, bukan array.
export const TAHAP_AKTIF = ["prospek", "kualifikasi", "penawaran", "negosiasi"] as const;
export const SEMUA_TAHAP = [...TAHAP_AKTIF, "menang", "kalah"] as const;
export type Tahap = (typeof SEMUA_TAHAP)[number];

export const aktif = (t: Tahap) => (TAHAP_AKTIF as readonly string[]).includes(t);

/** Nilai deal berjalan (jumlah corong tahap aktif) dari laporan sales. */
export function nilaiTerbuka(corong: Partial<Record<Tahap, { nilai: number }>>): number {
  return TAHAP_AKTIF.reduce((s, t) => s + (corong[t]?.nilai ?? 0), 0);
}
