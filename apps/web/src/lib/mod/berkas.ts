// X-17 berkas fitur tambahan (ekspor/impor). Berkas hanya berisi manifest: tanpa catatan, tanpa ID usaha atau orang, jadi
// aman dibagikan ke usaha lain. Impor selalu lewat pengawas yang sama dan menjadi draf yang harus diterapkan pemilik/admin.
import { BATAS } from "./skema";

export const FORMAT_BERKAS = "nadi-mod" as const;
export type BerkasMod = { format: typeof FORMAT_BERKAS; versi_format: 1; diekspor: string; versi_fitur: number | null; manifest: unknown };

/** Isi berkas unduhan: manifest apa adanya dibungkus penanda format. */
export function berkasEkspor(manifest: unknown, versi: number | null, kini = new Date()): string {
  const b: BerkasMod = { format: FORMAT_BERKAS, versi_format: 1, diekspor: kini.toISOString(), versi_fitur: versi, manifest };
  return JSON.stringify(b, null, 2) + "\n";
}

/** Nama berkas aman untuk Content-Disposition. */
export const namaBerkas = (kode: string, versi: number | null) => `nadi-fitur-${kode.replace(/[^a-z0-9-]/g, "")}${versi ? `-v${versi}` : ""}.json`;

/** Baca berkas impor: bungkus nadi-mod atau manifest polos (ditempel dari AI). Batas ukuran sama dengan manifest. */
export function bacaBerkasMod(teks: string): { manifest: Record<string, unknown> } | { galat: string } {
  const isi = teks.replace(/^﻿/, "").trim();
  if (!isi) return { galat: "Berkas kosong." };
  if (isi.length > BATAS.manifestByte + 1024) return { galat: "Berkas fitur maksimal 64 KB." };
  let j: unknown;
  try {
    j = JSON.parse(isi);
  } catch {
    return { galat: "Berkas bukan JSON yang sah. Unduh ulang dari Nadi atau periksa tanda kutip dan koma." };
  }
  if (typeof j !== "object" || j === null || Array.isArray(j)) return { galat: "Isi berkas harus berupa objek JSON." };
  const o = j as Record<string, unknown>;
  if ("format" in o) {
    if (o.format !== FORMAT_BERKAS) return { galat: "Berkas ini bukan berkas fitur Nadi." };
    if (o.versi_format !== 1) return { galat: "Versi berkas fitur tidak dikenal. Perbarui Nadi atau unduh ulang berkasnya." };
    const m = o.manifest;
    if (typeof m !== "object" || m === null || Array.isArray(m)) return { galat: "Berkas fitur tidak memuat manifest." };
    return { manifest: m as Record<string, unknown> };
  }
  return { manifest: o };
}
