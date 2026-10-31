import type { SupabaseClient } from "@supabase/supabase-js";

// Jalur Lempar Saja yang sama untuk browser (layar Lempar) dan server (share target): daftar -> unggah -> baca.

export const BATAS_BYTE = 10 * 1024 * 1024;
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DIKENAL = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/csv", XLSX]);

/** Jenis berkas yang dipercaya: browser sering memberi tipe kosong untuk xlsx atau "application/vnd.ms-excel" untuk CSV. */
export function mimeBerkas(nama: string, tipe: string): string | null {
  const ext = nama.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const dariExt: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf", csv: "text/csv", xlsx: XLSX };
  if (DIKENAL.has(tipe)) return tipe;
  return dariExt[ext] ?? null;
}

/** Kualitas JPEG foto yang dikompres di HP (Q-02B, docs/quality/kapasitas.md). */
export const KUALITAS_FOTO = 0.7;

/** Ukuran baru foto agar sisi terpanjang tidak lebih dari batas. 1600 px q0,7: foto nota HP 3,3 MB jadi 118 KB (2000 px q0,85: 289 KB),
 *  dibaca model sama benar (total, tanggal, 9 baris) dengan token 28% lebih sedikit. */
export function ukuranKompres(lebar: number, tinggi: number, sisiMaks = 1600): { lebar: number; tinggi: number } {
  const skala = Math.min(1, sisiMaks / Math.max(lebar, tinggi));
  return { lebar: Math.round(lebar * skala), tinggi: Math.round(tinggi * skala) };
}

export async function sha256Hex(isi: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", isi);
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type HasilLempar =
  | { status: "usulan"; berkasId: string; judul?: string; jenis?: string }
  | { status: "sudah"; berkasId?: string; pesan: string }
  | { status: "diunggah"; berkasId: string }
  | { status: "galat"; pesan: string };

const PESAN_SUDAH: Record<string, string> = {
  usulan: "Berkas ini sudah dibaca. Usulannya ada di Feed.",
  selesai: "Berkas ini sudah dibaca dan sudah diputuskan.",
  proses: "Berkas ini sedang dibaca.",
};

/** Daftarkan lalu unggah satu berkas. `baca: false` hanya mendaftar dan mengunggah (dipakai share target agar cepat). */
export async function lemparBerkas(
  sb: SupabaseClient,
  berkas: { isi: ArrayBuffer; nama: string; mime: string },
  opsi: { baca?: boolean } = {},
): Promise<HasilLempar> {
  if (berkas.isi.byteLength > BATAS_BYTE) return { status: "galat", pesan: "Berkas lebih dari 10 MB. Kirim halaman yang perlu saja, atau foto ulang." };
  const sha = await sha256Hex(berkas.isi);
  const { data: d, error } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: berkas.nama, p_mime: berkas.mime, p_ukuran: berkas.isi.byteLength });
  if (error) return { status: "galat", pesan: error.message.includes("belum bisa dibaca") ? "Jenis berkas ini belum bisa dibaca. Kirim foto, PDF, Excel, atau CSV." : "Nadi gagal mendaftarkan berkas. Coba lagi sebentar." };
  if (d.ada && !d.id) return { status: "sudah", pesan: "Berkas yang sama sudah pernah dilempar di usahamu." };
  if (d.ada && d.status !== "unggah" && d.status !== "gagal") return { status: "sudah", berkasId: d.id, pesan: PESAN_SUDAH[d.status] ?? "Berkas ini sudah pernah dilempar." };
  if (d.status === "unggah") {
    const { error: eUnggah } = await sb.storage.from("berkas").upload(d.jalur, berkas.isi, { contentType: berkas.mime });
    if (eUnggah && !/exists|duplicate/i.test(eUnggah.message)) return { status: "galat", pesan: "Unggah terputus. Periksa sinyal, lalu lempar lagi." };
  }
  if (opsi.baca === false) return { status: "diunggah", berkasId: d.id };
  return bacaBerkas(sb, d.id);
}

/** Minta Nadi membaca berkas yang sudah terunggah (aman dipanggil ulang: berkas selesai tidak diproses dua kali). */
export async function bacaBerkas(sb: SupabaseClient, berkasId: string): Promise<HasilLempar> {
  const { data, error } = await sb.functions.invoke<{ status: string; jenis?: string; galat?: string; usulan_id?: string }>("baca-berkas", { body: { berkas_id: berkasId } });
  if (error || !data) {
    const isi = await (error as { context?: Response } | null)?.context?.json?.().catch(() => null);
    return { status: "galat", pesan: isi?.galat ?? "Nadi gagal membaca berkas ini. Coba lagi sebentar." };
  }
  if (data.status === "usulan" && data.usulan_id) {
    const { data: u } = await sb.from("usulan").select("judul").eq("id", data.usulan_id).maybeSingle();
    return { status: "usulan", berkasId, judul: u?.judul, jenis: data.jenis };
  }
  return { status: "sudah", berkasId, pesan: PESAN_SUDAH[data.status] ?? "Berkas ini sudah pernah dibaca." };
}
