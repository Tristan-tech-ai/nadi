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

/** Usulan hasil bacaan, untuk kartu yang bisa langsung diputuskan di layar Lempar (D-13). Null bila peran tidak boleh melihatnya. */
export type UsulanLempar = { id: string; judul: string; penjelasan: string; keyakinan?: number; dampakRp?: number; aksi?: string };

export type HasilLempar =
  | { status: "usulan"; berkasId: string; judul?: string; jenis?: string; usulan?: UsulanLempar }
  | { status: "sudah"; berkasId?: string; pesan: string }
  | { status: "diunggah"; berkasId: string }
  | { status: "galat"; pesan: string; kode?: "jenis" };

export type TeksLemparPesan = Record<"besar" | "jenis" | "gagalDaftar" | "sama" | "sudahLempar" | "unggahPutus" | "gagalBaca" | "sudahBaca" | "sudahUsulan" | "sudahSelesai" | "sudahProses" | "tidakDikenal", string>;

/** Pesan bawaan = kamus id `lemparPesan` (diuji sama); ditulis di sini karena modul ini juga jalan di peramban. */
export const TEKS_LEMPAR_PESAN_ID: TeksLemparPesan = { besar: "Berkas lebih dari 10 MB. Kirim halaman yang perlu saja, atau foto ulang.", jenis: "Jenis berkas ini belum bisa dibaca. Kirim foto, PDF, Excel, atau CSV.", gagalDaftar: "Nadi gagal mendaftarkan berkas. Coba lagi sebentar.", sama: "Berkas yang sama sudah pernah dilempar di usahamu.", sudahLempar: "Berkas ini sudah pernah dilempar.", unggahPutus: "Unggah terputus. Periksa sinyal, lalu lempar lagi.", gagalBaca: "Nadi gagal membaca berkas ini. Coba lagi sebentar.", sudahBaca: "Berkas ini sudah pernah dibaca.", sudahUsulan: "Berkas ini sudah dibaca. Usulannya ada di Feed.", sudahSelesai: "Berkas ini sudah dibaca dan sudah diputuskan.", sudahProses: "Berkas ini sedang dibaca.", tidakDikenal: "Berkas tidak dikenal." };

function pesanSudah(status: string, t: TeksLemparPesan, lain: string): string {
  return status === "usulan" ? t.sudahUsulan : status === "selesai" ? t.sudahSelesai : status === "proses" ? t.sudahProses : lain;
}

/** Daftarkan lalu unggah satu berkas. `baca: false` hanya mendaftar dan mengunggah (dipakai share target agar cepat). */
export async function lemparBerkas(
  sb: SupabaseClient,
  berkas: { isi: ArrayBuffer; nama: string; mime: string },
  opsi: { baca?: boolean; teks?: TeksLemparPesan } = {},
): Promise<HasilLempar> {
  const t = opsi.teks ?? TEKS_LEMPAR_PESAN_ID;
  if (berkas.isi.byteLength > BATAS_BYTE) return { status: "galat", pesan: t.besar };
  const sha = await sha256Hex(berkas.isi);
  const { data: d, error } = await sb.rpc("lempar_berkas", { p_sha256: sha, p_nama: berkas.nama, p_mime: berkas.mime, p_ukuran: berkas.isi.byteLength });
  if (error) return error.message.includes("belum bisa dibaca") ? { status: "galat", pesan: t.jenis, kode: "jenis" } : { status: "galat", pesan: t.gagalDaftar };
  if (d.ada && !d.id) return { status: "sudah", pesan: t.sama };
  if (d.ada && d.status !== "unggah" && d.status !== "gagal") return { status: "sudah", berkasId: d.id, pesan: pesanSudah(d.status, t, t.sudahLempar) };
  if (d.status === "unggah") {
    const { error: eUnggah } = await sb.storage.from("berkas").upload(d.jalur, berkas.isi, { contentType: berkas.mime });
    if (eUnggah && !/exists|duplicate/i.test(eUnggah.message)) return { status: "galat", pesan: t.unggahPutus };
  }
  if (opsi.baca === false) return { status: "diunggah", berkasId: d.id };
  return bacaBerkas(sb, d.id, t);
}

/** Minta Nadi membaca berkas yang sudah terunggah (aman dipanggil ulang: berkas selesai tidak diproses dua kali). */
export async function bacaBerkas(sb: SupabaseClient, berkasId: string, t: TeksLemparPesan = TEKS_LEMPAR_PESAN_ID): Promise<HasilLempar> {
  const { data, error } = await sb.functions.invoke<{ status: string; jenis?: string; galat?: string; usulan_id?: string }>("baca-berkas", { body: { berkas_id: berkasId } });
  if (error || !data) {
    const isi = await (error as { context?: Response } | null)?.context?.json?.().catch(() => null);
    // Galat dari Edge Function ditulis dalam bahasa Indonesia; di mode lain pesan umum yang diterjemahkan dipakai.
    return { status: "galat", pesan: t === TEKS_LEMPAR_PESAN_ID && isi?.galat ? isi.galat : t.gagalBaca };
  }
  if (data.status === "usulan" && data.usulan_id) {
    const { data: u } = await sb.from("usulan").select("id, judul, penjelasan, keyakinan, dampak_rp, status, aksi").eq("id", data.usulan_id).maybeSingle();
    const usulan = u && u.status === "menunggu"
      ? { id: u.id as string, judul: u.judul as string, penjelasan: (u.penjelasan as string | null) ?? "", keyakinan: (u.keyakinan as number | null) ?? undefined, dampakRp: (u.dampak_rp as number | null) ?? undefined, aksi: u.aksi as string }
      : undefined;
    return { status: "usulan", berkasId, judul: u?.judul, jenis: data.jenis, usulan };
  }
  return { status: "sudah", berkasId, pesan: pesanSudah(data.status, t, t.sudahBaca) };
}
