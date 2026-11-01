// Penyusun nomor dokumen untuk pratinjau di layar (F4-01). Meniru app.susun_nomor, app.periode_nomor, dan penolakan
// atur_templat_nomor di supabase/migrations/20261101019000_nomor_sakti.sql + 20261101019100_nomor_sakti_lebar.sql;
// nomor yang sah tetap diterbitkan database lewat RPC ambil_nomor. Tanggal berbentuk YYYY-MM-DD di zona usaha.

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const;
const TOKEN = /\{(no(:[1-9])?|kode|jenis|bulan_romawi|bulan|tahun2|tahun)\}/g;

export function romawi(bulan: number): string {
  return ROMAWI[bulan - 1] ?? "";
}

function bagian(tanggal: string) {
  const [tahun, bulan] = tanggal.split("-");
  return { tahun, bulan, angkaBulan: Number(bulan) };
}

export function periodeNomor(templat: string, tanggal: string): string {
  const { tahun, bulan } = bagian(tanggal);
  if (/\{(bulan|bulan_romawi)\}/.test(templat)) return `${tahun}-${bulan}`;
  if (/\{(tahun|tahun2)\}/.test(templat)) return tahun;
  return "selamanya";
}

export function susunNomor(templat: string, urut: number, kode: string | null, jenis: string, tanggal: string): string {
  const { tahun, bulan, angkaBulan } = bagian(tanggal);
  const s = String(urut);
  // {no:N}: paling sedikit N digit dengan nol di depan; nomor yang lebih panjang ditulis utuh.
  return templat
    .replace(/\{no:([1-9])\}/g, (_, n: string) => s.padStart(Number(n), "0"))
    .replaceAll("{no}", s)
    .replaceAll("{kode}", kode ?? "")
    .replaceAll("{jenis}", jenis)
    .replaceAll("{bulan_romawi}", romawi(angkaBulan))
    .replaceAll("{bulan}", bulan)
    .replaceAll("{tahun2}", tahun.slice(2))
    .replaceAll("{tahun}", tahun);
}

/** Pesan galat untuk templat yang akan ditolak database, atau null bila templat bisa disimpan. */
export function cekTemplat(templat: string): string | null {
  if (templat.replace(TOKEN, "").match(/[{}]/)) {
    return "Templat memuat token yang tidak dikenal. Pakai {no:3}, {kode}, {jenis}, {bulan_romawi}, {bulan}, {tahun}, atau {tahun2}";
  }
  if (!/\{no(:[1-9])?\}/.test(templat)) return "Templat wajib memuat {no} atau {no:3} untuk nomor urut";
  if (templat.length < 4 || templat.length > 120) return "Templat terdiri dari 4 sampai 120 karakter";
  return null;
}
