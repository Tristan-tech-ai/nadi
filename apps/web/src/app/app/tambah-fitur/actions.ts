"use server";

import { revalidatePath } from "next/cache";
import { paketResmi } from "@/lib/mod/katalog";
import { periksaManifest } from "@/lib/mod/pengawas";
import { createClient } from "@/lib/supabase/server";

// X-06 halaman Tambah fitur: pasang paket resmi, matikan/nyalakan mod (data tetap), simpan draf buatan sendiri, terapkan draf.
// Semua lewat RPC mod_* yang hanya menerima pemilik/admin aktif dan memeriksa ulang isi di database (app.mod_cek_inti).
export type HasilTambah = { pesan: string } | { galat: string; alasan?: string[] } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const galatDb = (e: { code?: string; message: string }): HasilTambah =>
  ({ galat: ["22023", "42501", "P0002", "23514", "P0429"].includes(e.code ?? "") ? e.message : "Nadi gagal menyimpan. Coba lagi sebentar." });
const segarkan = () => revalidatePath("/app", "layout");

export async function pasangPaket(_: HasilTambah, form: FormData): Promise<HasilTambah> {
  const paket = paketResmi(String(form.get("kode") ?? ""));
  if (!paket) return { galat: "Paket tidak ada di katalog resmi." };
  const supabase = await createClient();
  const { data: ada } = await supabase.from("mod").select("id, status").eq("kode", paket.manifest.kode).maybeSingle();
  if (ada?.status === "aktif") return { pesan: `${paket.manifest.nama} sudah terpasang.` };
  if (ada?.status === "mati") {
    const { error } = await supabase.rpc("mod_atur", { p_mod: ada.id, p_aksi: "nyalakan" });
    if (error) return galatDb(error);
    segarkan();
    return { pesan: `${paket.manifest.nama} dipasang lagi. Catatan lamanya tampil kembali.` };
  }
  const { data: draf, error } = await supabase.rpc("mod_draf_simpan", { p_manifest: paket.manifest, p_sumber: "resmi" });
  if (error) return galatDb(error);
  const { error: e2 } = await supabase.rpc("mod_terapkan", { p_mod: (draf as { id: string }).id });
  if (e2) return galatDb(e2);
  segarkan();
  return { pesan: `${paket.manifest.nama} terpasang dan tampil di Fitur tambahan.` };
}

export async function aturMod(_: HasilTambah, form: FormData): Promise<HasilTambah> {
  const id = String(form.get("id") ?? "");
  const aksi = String(form.get("aksi") ?? "");
  if (!UUID.test(id) || (aksi !== "matikan" && aksi !== "nyalakan")) return { galat: "Aksi tidak dikenal." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_atur", { p_mod: id, p_aksi: aksi });
  if (error) return galatDb(error);
  segarkan();
  return { pesan: aksi === "matikan" ? "Dilepas dari menu. Datanya tetap tersimpan dan kembali saat dipasang lagi." : "Dipasang lagi." };
}

/** Buat sendiri: manifest JSON diperiksa pengawas yang sama dengan buatan AI; tetap disimpan sebagai draf beserta alasannya. */
export async function simpanManifest(_: HasilTambah, form: FormData): Promise<HasilTambah> {
  const teks = String(form.get("manifest") ?? "");
  if (teks.length > 65_536) return { galat: "Isi fitur maksimal 64 KB." };
  let m: unknown;
  try {
    m = JSON.parse(teks);
  } catch {
    return { galat: "Isi bukan JSON yang sah. Periksa tanda kutip dan koma." };
  }
  const alasan = periksaManifest(m);
  if (typeof m !== "object" || m === null || Array.isArray(m)) return { galat: "Isi fitur harus berupa objek JSON.", alasan };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_draf_simpan", { p_manifest: m, p_sumber: "sendiri", p_alasan: alasan });
  if (error) return galatDb(error);
  segarkan();
  return alasan.length
    ? { galat: "Draf tersimpan, tetapi belum bisa diterapkan. Perbaiki dulu:", alasan }
    : { pesan: "Draf lolos pemeriksaan dan menunggu kamu terapkan di bawah." };
}

export async function terapkanDraf(_: HasilTambah, form: FormData): Promise<HasilTambah> {
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { galat: "Draf tidak ditemukan." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mod_terapkan", { p_mod: id });
  if (error) return galatDb(error);
  segarkan();
  return { pesan: `Diterapkan sebagai versi ${(data as { versi: number }).versi}.` };
}
