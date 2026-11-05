// M-14: data terstruktur JobPosting untuk /lamar/<kode> (Google Search Central, dibaca 6 Nov 2026). Wajib: datePosted, description,
// hiringOrganization, jobLocation (PostalAddress dengan addressCountry), title. Lowongan tutup atau lewat validThrough tidak diberi data
// (aturan lowongan kedaluwarsa), dan data hanya dipasang bila pemilik memilih lowongan tampil di pencarian (halaman tanpa noindex).

export type LowonganPublik = {
  judul: string; ringkasan: string | null; usaha: string; buka: boolean; dibuat_at?: string | null; kota?: string | null; wilayah?: string | null;
  jenis?: string | null; gaji_min?: number | null; gaji_max?: number | null; gaji_satuan?: string | null; berlaku_sampai?: string | null; terindeks?: boolean | null;
};

export const JENIS_KERJA = ["FULL_TIME", "PART_TIME", "CONTRACTOR", "TEMPORARY", "INTERN", "VOLUNTEER", "PER_DIEM", "OTHER"] as const;
export const SATUAN_GAJI = ["HOUR", "DAY", "WEEK", "MONTH", "YEAR"] as const;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** null bila lowongan tidak boleh diberi data (tertutup, tidak terindeks, kedaluwarsa, tanpa kota). */
export function jobPosting(l: LowonganPublik, kode: string, url: string, hariIni: string): Record<string, unknown> | null {
  if (!l.buka || !l.terindeks || !l.kota || !l.dibuat_at) return null;
  if (l.berlaku_sampai && l.berlaku_sampai < hariIni) return null;
  const teks = (l.ringkasan ?? "").trim();
  const deskripsi = teks && teks !== l.judul ? teks.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("") : `<p>${esc(l.judul)} di ${esc(l.usaha)}, ${esc(l.kota)}.</p>`;
  const gaji = l.gaji_min || l.gaji_max
    ? { "@type": "MonetaryAmount", currency: "IDR", value: { "@type": "QuantitativeValue", unitText: SATUAN_GAJI.includes(l.gaji_satuan as never) ? l.gaji_satuan : "MONTH",
        ...(l.gaji_min && l.gaji_max && l.gaji_min !== l.gaji_max ? { minValue: l.gaji_min, maxValue: l.gaji_max } : { value: l.gaji_min ?? l.gaji_max }) } }
    : undefined;
  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: l.judul,
    description: deskripsi,
    datePosted: l.dibuat_at.slice(0, 10),
    ...(l.berlaku_sampai ? { validThrough: `${l.berlaku_sampai}T23:59:59+07:00` } : {}),
    employmentType: JENIS_KERJA.includes(l.jenis as never) ? l.jenis : "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: l.usaha },
    jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: l.kota, ...(l.wilayah ? { addressRegion: l.wilayah } : {}), addressCountry: "ID" } },
    identifier: { "@type": "PropertyValue", name: l.usaha, value: kode },
    directApply: true,
    url,
    ...(gaji ? { baseSalary: gaji } : {}),
  };
}

/** Uji struktur: properti wajib ada dan berbentuk benar. Mengembalikan daftar masalah (kosong = sah). */
export function periksaJobPosting(d: Record<string, unknown>): string[] {
  const m: string[] = [];
  const s = (k: string) => typeof d[k] === "string" && (d[k] as string).length > 0;
  if (d["@type"] !== "JobPosting") m.push("@type");
  if (!s("title")) m.push("title");
  if (!s("description") || d.description === d.title) m.push("description");
  if (!s("datePosted") || !/^\d{4}-\d{2}-\d{2}/.test(d.datePosted as string)) m.push("datePosted");
  const org = d.hiringOrganization as { name?: unknown } | undefined;
  if (!org || typeof org.name !== "string" || !org.name) m.push("hiringOrganization.name");
  const lok = d.jobLocation as { address?: { addressCountry?: unknown; "@type"?: unknown } } | undefined;
  if (!lok?.address || lok.address["@type"] !== "PostalAddress" || typeof lok.address.addressCountry !== "string") m.push("jobLocation.address.addressCountry");
  if (d.employmentType && !JENIS_KERJA.includes(d.employmentType as never)) m.push("employmentType");
  const g = d.baseSalary as { currency?: unknown; value?: { unitText?: unknown } } | undefined;
  if (g && (typeof g.currency !== "string" || !SATUAN_GAJI.includes(g.value?.unitText as never))) m.push("baseSalary");
  return m;
}
