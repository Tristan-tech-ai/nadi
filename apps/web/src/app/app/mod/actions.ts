"use server";

import { revalidatePath } from "next/cache";
import { bacaSesi } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { bacaIsian, bidangDari, koleksiDari } from "@/lib/mod/tafsir";
import type { Bidang, Manifest } from "@/lib/mod/skema";

// X-05: aksi penafsir mod. Hanya memanggil RPC mod_catatan_* yang menegakkan akses, validasi isi, transisi, dan isolasi
// usaha di database; isian dibaca menurut manifest yang tersimpan (bukan dari daftar bidang yang dikirim peramban).
export type HasilMod = { pesan: string; id?: string } | { galat: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KODE_DB = ["22023", "42501", "P0002", "P0429"];
const galatDb = (e: { code?: string; message: string }): HasilMod => ({ galat: KODE_DB.includes(e.code ?? "") ? e.message : "Nadi gagal menyimpan. Coba lagi sebentar; isianmu tidak hilang." });

async function konteks(form: FormData) {
  const sesi = await bacaSesi();
  const modId = String(form.get("mod") ?? "");
  const kodeKoleksi = String(form.get("koleksi") ?? "");
  if (!sesi?.perusahaanId || !UUID.test(modId)) return null;
  const supabase = await createClient();
  const { data: m } = await supabase.from("mod").select("id, kode, manifest").eq("id", modId).eq("status", "aktif").maybeSingle();
  const manifest = m?.manifest as Manifest | null;
  const k = manifest ? koleksiDari(manifest, kodeKoleksi) : null;
  if (!m || !k) return null;
  return { supabase, sesi, modId, kode: m.kode as string, k, zona: await zonaUsahaIni(sesi.perusahaanId) };
}

/** Bidang yang boleh dibaca dari isian ini: daftar dari peramban hanya dipakai sebagai pilihan di antara bidang manifest. */
function bidangDiminta(k: NonNullable<Awaited<ReturnType<typeof konteks>>>["k"], form: FormData): Bidang[] {
  const minta = String(form.get("bidang") ?? "").split(",").filter(Boolean);
  return [...new Set(minta)].map((c) => bidangDari(k, c)).filter((b): b is Bidang => !!b && b.tipe !== "rumus");
}

async function dataLama(c: NonNullable<Awaited<ReturnType<typeof konteks>>>, id: string): Promise<Record<string, unknown> | null> {
  const { data } = await c.supabase.from("mod_record").select("data").eq("id", id).eq("mod_id", c.modId).eq("koleksi", c.k.kode).eq("arsip", false).maybeSingle();
  return (data?.data as Record<string, unknown> | undefined) ?? null;
}

export async function simpanCatatan(_: HasilMod, form: FormData): Promise<HasilMod> {
  const c = await konteks(form);
  if (!c) return { galat: "Fitur ini tidak ditemukan atau sudah dimatikan." };
  const id = String(form.get("id") ?? "");
  if (id && !UUID.test(id)) return { galat: "Catatan tidak ditemukan." };
  const dasar = id ? await dataLama(c, id) : {};
  if (dasar === null) return { galat: "Catatan tidak ditemukan." };
  const { data, galat } = bacaIsian(bidangDiminta(c.k, form), (n) => form.getAll(n).map(String), c.zona, dasar);
  if (galat.length) return { galat: galat.join(". ") + "." };
  const { data: r, error } = await c.supabase.rpc("mod_catatan_simpan", { p_mod: c.modId, p_koleksi: c.k.kode, p_data: data, p_id: id || null });
  if (error) return galatDb(error);
  revalidatePath(`/app/mod/${c.kode}`);
  return { pesan: id ? "Tersimpan." : `${c.k.nama}: catatan baru tersimpan.`, id: (r as { id: string }).id };
}

export async function pindahStatus(_: HasilMod, form: FormData): Promise<HasilMod> {
  const c = await konteks(form);
  if (!c) return { galat: "Fitur ini tidak ditemukan atau sudah dimatikan." };
  const id = String(form.get("id") ?? "");
  const ke = String(form.get("ke") ?? "");
  if (!UUID.test(id) || !c.k.status?.daftar.some((s) => s.kode === ke)) return { galat: "Status tidak dikenal." };
  // Transisi dengan wajib_isi mengirim isian itu bersama tombolnya: simpan dulu, lalu pindah status (dua langkah di database).
  const isi = bidangDiminta(c.k, form);
  if (isi.length) {
    const dasar = await dataLama(c, id);
    if (dasar === null) return { galat: "Catatan tidak ditemukan." };
    const { data, galat } = bacaIsian(isi, (n) => form.getAll(n).map(String), c.zona, dasar);
    if (galat.length) return { galat: galat.join(". ") + "." };
    const { error } = await c.supabase.rpc("mod_catatan_simpan", { p_mod: c.modId, p_koleksi: c.k.kode, p_data: data, p_id: id });
    if (error) return galatDb(error);
  }
  const { error } = await c.supabase.rpc("mod_catatan_status", { p_id: id, p_ke: ke });
  if (error) return galatDb(error);
  revalidatePath(`/app/mod/${c.kode}`);
  return { pesan: `Status menjadi ${c.k.status?.daftar.find((s) => s.kode === ke)?.label ?? ke}.`, id };
}

export async function arsipkanCatatan(_: HasilMod, form: FormData): Promise<HasilMod> {
  const c = await konteks(form);
  if (!c) return { galat: "Fitur ini tidak ditemukan atau sudah dimatikan." };
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return { galat: "Catatan tidak ditemukan." };
  const { error } = await c.supabase.rpc("mod_catatan_arsip", { p_id: id });
  if (error) return galatDb(error);
  revalidatePath(`/app/mod/${c.kode}`);
  return { pesan: "Diarsipkan. Catatan tidak tampil lagi, datanya tetap tersimpan." };
}
