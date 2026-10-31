import { formatPersen } from "@/lib/format";

/** Bidang keputusan yang dipakai kartu "Keputusan otomatis". */
export type BarisKeputusan = { jenis: string; tingkat: string; pilihan: string; yakin: number | null; dibatalkan_at: string | null };

const KE: Record<string, string> = { pemilik: "pemilik saja", keduanya: "pemilik dan admin" };

/** Baris kecil di atas alasan: siapa yang memutuskan dan seberapa yakin (VOICE.md: jujur soal AI). */
export function labelKeputusan(k: BarisKeputusan): string {
  if (k.tingkat !== "model") return "Aturan pasti";
  const yakin = formatPersen(k.yakin ?? 0);
  if (k.pilihan === "keduanya (ragu)") return `Nadi ragu (yakin ${yakin}), tetap ke pemilik dan admin`;
  // Model tidak pernah menyembunyikan usulan dari pemilik: pilihan admin hanya saran.
  if (k.pilihan === "admin (saran)") return `Saran Nadi: cukup admin, yakin ${yakin}. Tetap ke pemilik dan admin`;
  return `Dirute Nadi ke ${KE[k.pilihan] ?? k.pilihan}, yakin ${yakin}`;
}

/** Tombol batal hanya untuk keputusan yang mengubah sesuatu. Untuk rute, hanya penyempitan ke pemilik yang punya akibat untuk dibalik. */
export function bisaDibatalkan(k: BarisKeputusan): boolean {
  if (k.dibatalkan_at || k.tingkat === "manusia") return false;
  if (k.jenis === "usulan.rute") return k.pilihan === "pemilik";
  return true;
}
