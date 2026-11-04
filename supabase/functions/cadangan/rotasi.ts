// Rotasi cadangan (Q-03B): murni, dipakai Edge Function `cadangan` dan diuji vitest (apps/web/src/lib/cadangan-rotasi.test.ts).
export const SIMPAN_MINIMAL = 8; // folder terbaru yang selalu disimpan, berapa pun umurnya
export const UMUR_HAPUS_HARI = 56; // folder lebih tua dari ini boleh dihapus (8 minggu)

/** Folder bertanggal AAAA-BB-HH yang boleh dihapus: lebih tua dari 56 hari dari hariIni dan bukan 8 terbaru. */
export function folderRotasi(folder: string[], hariIni: string): string[] {
  const urut = folder.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f)).sort().reverse();
  const batas = new Date(`${hariIni}T00:00:00Z`).getTime() - UMUR_HAPUS_HARI * 86_400_000;
  return urut.slice(SIMPAN_MINIMAL).filter((f) => new Date(`${f}T00:00:00Z`).getTime() < batas);
}
