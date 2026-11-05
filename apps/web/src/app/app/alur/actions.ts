"use server";

import { revalidatePath } from "next/cache";
import { uraiIsian } from "@/lib/alur/isian";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export type HasilAlur = { pesan: string; rahasia?: string } | { galat: string } | null;

async function pesan() {
  return ambilKamus(await bahasaAplikasi()).otomasiPesan;
}
type P = Awaited<ReturnType<typeof pesan>>;
const galat = (k: P, e: { code?: string; message: string }): HasilAlur =>
  ({ galat: ["22023", "P0002", "23505", "23514", "42501"].includes(e.code ?? "") ? isiTeks(k.galatDb, { pesan: e.message }) : k.gagal });
const segar = () => revalidatePath("/app/alur");

export async function simpanFormulir(_: HasilAlur, form: FormData): Promise<HasilAlur> {
  const p = await pesan();
  const u = uraiIsian(String(form.get("isian") ?? ""));
  if ("galat" in u) return { galat: isiTeks(p.urai[u.galat], { baris: u.baris ?? 0 }) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_form", { p: { nama: String(form.get("nama") ?? ""), bidang: u.bidang } });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.formulirDibuat };
}

export async function simpanAlur(_: HasilAlur, form: FormData): Promise<HasilAlur> {
  const p = await pesan();
  const pemicu = String(form.get("pemicu") ?? "");
  const [jenis, formulir] = pemicu.startsWith("formulir:") ? ["formulir.kirim", pemicu.slice(9)] : [pemicu, ""];
  const syarat = [0, 1].map((i) => ({ bidang: String(form.get(`syarat_bidang_${i}`) ?? "").trim(), op: String(form.get(`syarat_op_${i}`) ?? "="), nilai: String(form.get(`syarat_nilai_${i}`) ?? "").trim() }))
    .filter((s) => s.bidang);
  const aksi: Record<string, string>[] = [];
  const kartu = String(form.get("kartu") ?? "").trim();
  const kerja = String(form.get("kerja") ?? "").trim();
  const url = String(form.get("webhook") ?? "").trim();
  if (kartu) aksi.push({ jenis: "kartu", judul: kartu });
  if (kerja) aksi.push({ jenis: "kerja", judul: kerja });
  if (url) aksi.push({ jenis: "webhook", url });
  if (aksi.length === 0) return { galat: p.aksiKosong };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_flow", { p: { nama: String(form.get("nama") ?? ""), pemicu: jenis, formulir, syarat, aksi,
    batas_jam: String(form.get("batas_jam") ?? "") } });
  if (error) return galat(p, error);
  segar();
  const r = data as { rahasia: string | null };
  return { pesan: p.alurDibuat, rahasia: r.rahasia ?? undefined };
}

export async function aturAktif(_: HasilAlur, form: FormData): Promise<HasilAlur> {
  const p = await pesan();
  const supabase = await createClient();
  const aktif = form.get("aktif") === "1";
  const { error } = await supabase.rpc("set_flow_active", { p_flow: String(form.get("alur") ?? ""), p_aktif: aktif });
  if (error) return galat(p, error);
  segar();
  return { pesan: aktif ? p.dinyalakan : p.dimatikan };
}

export async function kirimFormulir(_: HasilAlur, form: FormData): Promise<HasilAlur> {
  const p = await pesan();
  const isi: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("f:")) isi[k.slice(2)] = String(v);
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_form", { p_form: String(form.get("formulir") ?? ""), p_isi: isi });
  if (error) return galat(p, error);
  segar();
  return { pesan: p.terkirim };
}
