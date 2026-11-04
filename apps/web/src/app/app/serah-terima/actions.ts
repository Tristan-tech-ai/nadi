"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { asalTautan } from "@/lib/mcp/http";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilSerah = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

const ALASAN = ["mundur", "kontrak_selesai", "lainnya"];
const tanggal = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x);

/** Pesan serah terima dalam bahasa pengguna; pesan database (bahasa Indonesia) dibungkus di bahasa lain. */
async function teksSerah() {
  const t = ambilKamus(await bahasaAplikasi()).serahPesan;
  return { ...t, db: (pesan: string) => isiTeks(t.galatDb, { pesan }) };
}

/** Catat orang berhenti; database menyusun paket serah terima dalam satu transaksi (F3-07). */
export async function catatBerhenti(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const k = await teksSerah();
  const isian = {
    orang: String(form.get("orang") ?? ""), surat: String(form.get("surat") ?? ""), efektif: String(form.get("efektif") ?? ""),
    alasan: String(form.get("alasan") ?? ""), kunci: String(form.get("kunci") ?? "") || randomUUID(),
  };
  if (!isian.orang) return { galat: k.pilihOrang, isian };
  if (!tanggal(isian.surat) || !tanggal(isian.efektif)) return { galat: k.isiTanggal, isian };
  if (isian.efektif < isian.surat) return { galat: k.efektifSebelum, isian };
  if (!ALASAN.includes(isian.alasan)) return { galat: k.pilihAlasan, isian };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catat_berhenti", { p_orang: isian.orang, p_surat: isian.surat, p_efektif: isian.efektif, p_alasan: isian.alasan, p_kunci: isian.kunci });
  if (error) return { galat: error.code === "42501" ? k.hanyaCatat : error.code === "22023" || error.code === "P0002" ? k.db(error.message) : k.gagalPaket, isian };
  revalidatePath("/app/serah-terima");
  const kurang = ((data as { peringatan: string[] }).peringatan ?? []).includes("kurang_30_hari");
  return { pesan: kurang ? k.disiapkanKurang : k.disiapkan };
}

export async function pindahkanSemua(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const k = await teksSerah();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pindahkan_ke_pengganti", { p_berhenti: String(form.get("berhenti") ?? "") });
  if (error) return { galat: error.code === "42501" ? k.hanyaPindah : k.gagalPindah };
  revalidatePath("/app/serah-terima");
  return { pesan: data ? isiTeks(k.dipindah, { n: Number(data) }) : k.tanpaPindah };
}

export async function tandaiButir(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const k = await teksSerah();
  const status = String(form.get("status") ?? "");
  const pengganti = String(form.get("pengganti") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("tandai_butir", { p_butir: String(form.get("butir") ?? ""), p_status: status, p_pengganti: pengganti || null });
  if (error) return { galat: error.code === "22023" ? k.db(error.message) : k.gagalButir };
  revalidatePath("/app/serah-terima");
  return { pesan: k.tersimpan };
}

export async function batalkanBerhenti(_: HasilSerah, form: FormData): Promise<HasilSerah> {
  const k = await teksSerah();
  const alasan = String(form.get("alasan") ?? "").trim();
  if (alasan.length < 3) return { galat: k.tulisAlasan };
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_berhenti", { p_berhenti: String(form.get("berhenti") ?? ""), p_alasan: alasan });
  if (error) return { galat: k.gagalBatal };
  revalidatePath("/app/serah-terima");
  return { pesan: k.dibatalkan };
}

// F3-07C: transkrip dan langkah kerja butir ilmu (pemilik/admin; hak diperiksa simpan_ilmu, konteks_ilmu, simpan_langkah_model).
export type HasilIlmu = { ok?: boolean; langkah?: string[]; galat?: string };

async function teksIlmu() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).ilmuPemilik;
  return { ...t, db: (pesan: string) => (bahasa === "id" ? pesan : isiTeks(t.galatDb, { pesan })) };
}

export async function simpanTranskripIlmu(butir: string, transkrip: string): Promise<HasilIlmu> {
  const k = await teksIlmu();
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_ilmu", { p_butir: butir, p_transkrip: transkrip.slice(0, 20000), p_langkah: null, p_sumber: "pemilik" });
  if (error) return { galat: error.code === "42501" || error.code === "22023" ? k.db(error.message) : k.gagal };
  revalidatePath("/app/serah-terima");
  return { ok: true };
}

export async function susunLangkahIlmu(butir: string): Promise<HasilIlmu> {
  const k = await teksIlmu();
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke<{ langkah?: string[]; galat?: string }>("langkah-ilmu", { body: { butir_id: butir }, timeout: 45_000 });
  if (error || !data?.langkah) {
    // Pesan database (batas 3 kali sehari, transkrip belum ada) dibaca dari badan galat Edge Function.
    const badan = error && "context" in error ? await (error.context as Response).json().catch(() => null) : null;
    const pesan = (badan as { galat?: string; kode?: string } | null);
    return { galat: pesan?.kode === "54000" || pesan?.kode === "55000" ? k.db(String(pesan.galat)) : k.modelGagal };
  }
  revalidatePath("/app/serah-terima");
  return { ok: true, langkah: data.langkah };
}

export async function simpanLangkahIlmu(_: HasilIlmu, form: FormData): Promise<HasilIlmu> {
  const k = await teksIlmu();
  const butir = String(form.get("butir") ?? "");
  const langkah = String(form.get("langkah") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_ilmu", { p_butir: butir, p_transkrip: null, p_langkah: langkah.length ? langkah : null, p_sumber: "pemilik" });
  if (error) return { galat: error.code === "42501" || error.code === "22023" ? k.db(error.message) : k.gagal };
  revalidatePath("/app/serah-terima");
  return { ok: true, langkah };
}

// F3-07D: pemilik membuat tautan wawancara keluar sekali pakai (token di fragmen URL, hanya sha256 di database).
export type HasilKeluar = { tautan?: string; galat?: string };
export async function buatTautanKeluar(_: HasilKeluar, form: FormData): Promise<HasilKeluar> {
  const t = ambilKamus(await bahasaAplikasi()).wkPemilik;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_tautan_keluar", { p_berhenti: String(form.get("berhenti") ?? "") });
  if (error) return { galat: error.code === "42501" ? t.hanyaPemilik : error.code === "23505" ? t.sudahDijawab : t.gagal };
  revalidatePath("/app/serah-terima");
  return { tautan: `${asalTautan(await headers())}/keluar#${data as string}` };
}
