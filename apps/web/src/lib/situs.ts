// Alamat situs Nadi untuk tautan kanonis (lowongan, JobPosting) dan cadangan bila header host tidak ada.
// Urutan: NADI_ASAL (diisi di Vercel produksi), domain produksi Vercel, lalu domain utama nadiusaha.my.id (12 Nov 2026).
export const DOMAIN_UTAMA = "https://nadiusaha.my.id";

export function asalSitus(env: Record<string, string | undefined> = process.env): string {
  const tetap = env.NADI_ASAL?.trim();
  if (tetap) return tetap.replace(/\/+$/, "").toLowerCase();
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`.toLowerCase();
  return DOMAIN_UTAMA;
}
