"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilMitra = { pesan: string } | { galat: string; isian?: Record<string, string> } | null;

async function teks() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).mitraPesan;
  return { t, db: (pesan: string) => (bahasa === "id" ? pesan : isiTeks(t.galatDb, { pesan })) };
}

/** F6-04: simpan permintaan ke mitra. Tidak ada pembayaran dan Nadi tidak mengirim pesan ke mitra. */
export async function kirimPermintaan(_: HasilMitra, form: FormData): Promise<HasilMitra> {
  const k = await teks();
  const isian = { mitra: String(form.get("mitra") ?? ""), layanan: String(form.get("layanan") ?? ""), pesan: String(form.get("pesan") ?? "").trim(), kunci: String(form.get("kunci") ?? "") || randomUUID() };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("kirim_permintaan_mitra", { p_mitra: isian.mitra, p_layanan: isian.layanan, p_pesan: isian.pesan, p_kunci: isian.kunci });
  if (error) {
    const galat = error.code === "42501" ? k.t.hanyaPeran : ["22023", "P0002", "54000"].includes(error.code ?? "") ? k.db(error.message) : k.t.gagal;
    return { galat, isian };
  }
  const r = data as { sudah: boolean; contoh: boolean };
  revalidatePath("/app/mitra");
  return { pesan: r.sudah ? k.t.sudah : r.contoh ? k.t.tersimpanContoh : k.t.tersimpan };
}

export async function batalkanPermintaan(_: HasilMitra, form: FormData): Promise<HasilMitra> {
  const k = await teks();
  const supabase = await createClient();
  const { error } = await supabase.rpc("batal_permintaan_mitra", { p_id: String(form.get("permintaan") ?? "") });
  if (error) return { galat: error.code === "42501" ? k.t.hanyaPeran : error.code === "P0002" ? k.db(error.message) : k.t.gagal };
  revalidatePath("/app/mitra");
  return { pesan: k.t.dibatalkan };
}
