"use server";

import { revalidatePath } from "next/cache";
import { paketResmi } from "@/lib/mod/katalog";
import { bacaBerkasMod } from "@/lib/mod/berkas";
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

/** Buat sendiri atau impor berkas (X-17): manifest diperiksa pengawas yang sama dengan buatan AI; tetap disimpan sebagai draf
 * beserta alasannya. Berkas impor boleh bungkus nadi-mod dari Unduh berkas fitur atau manifest polos. */
export async function simpanManifest(_: HasilTambah, form: FormData): Promise<HasilTambah> {
  const berkas = form.get("berkas");
  const dariBerkas = berkas instanceof File && berkas.size > 0;
  if (dariBerkas && berkas.size > 70_000) return { galat: "Berkas fitur maksimal 64 KB." };
  const teks = dariBerkas ? await berkas.text() : String(form.get("manifest") ?? "");
  if (!dariBerkas && teks.length > 65_536) return { galat: "Isi fitur maksimal 64 KB." };
  if (!teks.trim()) return { galat: "Tempel isi fitur atau pilih berkas fitur dulu." };
  const baca = bacaBerkasMod(teks);
  if ("galat" in baca) return { galat: baca.galat };
  const m = baca.manifest;
  const alasan = periksaManifest(m);
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_draf_simpan", { p_manifest: m, p_sumber: dariBerkas ? "impor" : "sendiri", p_alasan: alasan });
  if (error) return galatDb(error);
  segarkan();
  return alasan.length
    ? { galat: "Draf tersimpan, tetapi belum bisa diterapkan. Perbaiki dulu:", alasan }
    : { pesan: "Draf lolos pemeriksaan dan menunggu kamu terapkan di bawah." };
}

/** X-17: kembalikan fitur ke versi yang pernah diterapkan (catatan tidak berubah; isian yang tidak ada di versi itu disembunyikan). */
export async function kembalikanVersi(_: HasilTambah, form: FormData): Promise<HasilTambah> {
  const id = String(form.get("id") ?? "");
  const versi = Number(form.get("versi"));
  if (!UUID.test(id) || !Number.isInteger(versi) || versi < 1) return { galat: "Versi tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mod_atur", { p_mod: id, p_aksi: "rollback", p_versi: versi });
  if (error) return galatDb(error);
  segarkan();
  return { pesan: `Dikembalikan ke versi ${versi}.` };
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
