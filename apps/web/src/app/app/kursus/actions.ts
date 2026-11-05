"use server";

import { revalidatePath } from "next/cache";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilKursus = { pesan: string } | { galat: string } | null;
export type HasilKuis = { skor: number; benar: number; total: number; lulus: boolean; ambang: number; sertifikat: string | null; nomor: string | null } | { galat: string } | null;

async function pesan() {
  return ambilKamus(await bahasaAplikasi()).kursusPesan;
}
type P = Awaited<ReturnType<typeof pesan>>;
const galat = (k: P, e: { code?: string; message: string }) =>
  ({ galat: ["22023", "P0002", "23505", "23514", "42501"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });
const segar = () => revalidatePath("/app/kursus");
const baris = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

export async function simpanKursus(_: HasilKursus, form: FormData): Promise<HasilKursus> {
  const p = await pesan();
  const butir = String(form.get("butir") ?? "");
  const materi = baris(form.get("materi"));
  if (!butir && materi.length === 0) return { galat: p.materiKosong };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_course", { p: { judul: String(form.get("judul") ?? ""), ringkasan: String(form.get("ringkasan") ?? ""),
    ambang: String(form.get("ambang") ?? ""), ...(butir ? { butir } : { materi }) } });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.kursusDibuat };
}

export async function simpanSoal(_: HasilKursus, form: FormData): Promise<HasilKursus> {
  const p = await pesan();
  const pilihan = baris(form.get("pilihan"));
  const kunci = Number(form.get("kunci"));
  if (pilihan.length < 2) return { galat: p.pilihanKurang };
  if (!Number.isInteger(kunci) || kunci < 1 || kunci > pilihan.length) return { galat: isiTeks(p.kunciSalah, { n: pilihan.length }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_course_question", { p_course: String(form.get("course") ?? ""), p_pertanyaan: String(form.get("pertanyaan") ?? ""),
    p_pilihan: pilihan, p_kunci: kunci - 1 });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.soalDisimpan };
}

export async function kirimKuis(_: HasilKuis, form: FormData): Promise<HasilKuis> {
  const p = await pesan();
  const jawaban: Record<string, number> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("q:")) jawaban[k.slice(2)] = Number(v);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz", { p_course: String(form.get("course") ?? ""), p_jawaban: jawaban });
  if (error) return galat(p, error);
  segar();
  return data as HasilKuis;
}
