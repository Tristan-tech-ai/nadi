// Lamar tanpa akun (F2-01, docs/research/rekrut.md): pemeriksaan isian di browser sebelum RPC, agar pelamar langsung tahu
// apa yang kurang. Database tetap memeriksa ulang semuanya.

export const MIME_CV = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const BATAS_CV = 10 * 1024 * 1024;

/** Kode lowongan: 8 huruf/angka tanpa karakter mirip. Huruf kecil dari tautan diterima. */
export const kodeSah = (k: string) => /^[A-HJ-NP-Z2-9]{8}$/.test(k.toUpperCase());

export function periksaLamaran(i: { nama: string; telepon: string; mime: string | null; ukuran: number }): string | null {
  if (i.nama.trim().length < 2) return "Tulis nama lengkapmu.";
  if (i.telepon.replace(/\D/g, "").length < 9) return "Tulis nomor HP yang aktif, misalnya 0812 3456 7890.";
  if (!i.mime || !MIME_CV.includes(i.mime)) return "CV harus berupa foto atau PDF.";
  if (i.ukuran <= 0) return "Pilih berkas CV dulu.";
  if (i.ukuran > BATAS_CV) return "CV paling besar 10 MB. Foto ulang lebih dekat atau kirim PDF yang lebih kecil.";
  return null;
}
