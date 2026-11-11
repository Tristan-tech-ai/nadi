"use server";

import { revalidatePath } from "next/cache";
import { uraiTemplate } from "@/lib/proyek/template";
import { createClient } from "@/lib/supabase/server";

// X-12 proyek operasional: template, buat proyek dari template (satu transaksi di database), status, invoice dari proyek.
export type HasilOps = { pesan: string } | { galat: string } | null;
const ID = /^[0-9a-f-]{36}$/i;
const t = (f: FormData, n: string) => String(f.get(n) ?? "").trim();
const galat = (e: { code?: string; message: string }): HasilOps =>
  ({ galat: ["22023", "42501", "P0002", "23514"].includes(e.code ?? "") ? e.message : "Nadi gagal menyimpan. Coba lagi sebentar." });

export async function simpanTemplate(_: HasilOps, f: FormData): Promise<HasilOps> {
  const { isi, galat: g } = uraiTemplate(t(f, "isi"));
  if (g.length) return { galat: g.join(" ") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("simpan_template_proyek", { p_id: null, p_nama: t(f, "nama"), p_isi: isi });
  if (error) return galat(error);
  revalidatePath("/app/proyek");
  return { pesan: `Template tersimpan dengan ${isi.length} kerja.` };
}

export async function buatProyekOps(_: HasilOps, f: FormData): Promise<HasilOps> {
  const tim = f.getAll("tim").map(String).filter((x) => ID.test(x));
  const p = { nama: t(f, "nama"), tipe: t(f, "tipe") || "sekali", pola: t(f, "pola"), klien: t(f, "klien"), pic: t(f, "pic"), tim,
    mulai: t(f, "mulai"), target: t(f, "target"), template_id: t(f, "template") };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_proyek", { p });
  if (error) return galat(error);
  revalidatePath("/app/proyek");
  revalidatePath("/app/kerja");
  const n = (data as { kerja: number }).kerja;
  return { pesan: n ? `Proyek dibuat dengan ${n} kerja dari template.` : "Proyek dibuat." };
}

export async function aturStatusProyek(_: HasilOps, f: FormData): Promise<HasilOps> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("atur_status_proyek", { p_proyek: t(f, "proyek"), p_status: t(f, "status") });
  if (error) return galat(error);
  revalidatePath("/app/proyek");
  return { pesan: "Status tersimpan." };
}

export async function tagihProyek(_: HasilOps, f: FormData): Promise<HasilOps> {
  const nilai = Number(t(f, "nilai").replace(/[.\s]/g, ""));
  if (!Number.isInteger(nilai) || nilai <= 0) return { galat: "Isi nilai tagihan dalam rupiah bulat." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buat_invoice_proyek", { p_proyek: t(f, "proyek"), p_uraian: t(f, "uraian"), p_nilai: nilai, p_jatuh_tempo: t(f, "jatuh_tempo") || null });
  if (error) return galat(error);
  revalidatePath("/app/proyek");
  revalidatePath("/app/invoice");
  return { pesan: `Invoice ${(data as { nomor?: string }).nomor ?? ""} dibuat.`.replace("  ", " ") };
}
