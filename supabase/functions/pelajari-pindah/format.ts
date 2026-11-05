// M-24 pindah dari aplikasi lain: kenali berkas ekspor/template dari judul kolomnya lalu ubah barisnya ke bentuk Nadi, tanpa model.
// salinan untuk Edge Function pelajari-pindah; fungsi yang dipakai: angka, tanggal, hp.
export function angka(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").trim().replace(/^'/, "").replace(/rp\.?/i, "").replace(/\s/g, "");
  if (!s) return null;
  const singkat = /^(\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta)$/i.exec(s);
  if (singkat) return Number(singkat[1].replace(",", ".")) * (/^(jt|juta)$/i.test(singkat[2]) ? 1_000_000 : 1_000);
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()-]/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return (neg ? -1 : 1) * Number(s);
}
export function tanggal(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim().replace(/^'/, "");
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m && Number(m[2]) <= 12 && Number(m[1]) <= 31) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}
export function hp(v: unknown): string | null {
  const d = String(v ?? "").trim().replace(/^'/, "").replace(/[^0-9]/g, "");
  if (/^0\d{8,13}$/.test(d)) return `62${d.slice(1)}`;
  if (/^62\d{8,13}$/.test(d)) return d;
  return null;
}
