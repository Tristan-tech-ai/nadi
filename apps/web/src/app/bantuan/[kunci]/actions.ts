"use server";

import { createClient } from "@/lib/supabase/server";

// M-16: sisi pengunjung obrolan web tanpa akun. Semua lewat RPC berkunci (kunci obrolan untuk memulai, token percakapan
// untuk membaca dan mengirim); token hanya disimpan di perangkat pengunjung, database menyimpan hash-nya.
export type Pesan = { dari: "pengunjung" | "agen" | "bot" | "sistem"; isi: string; agen: string | null; waktu: string };
export type Obrolan = { status: "terbuka" | "ditangani" | "selesai"; csat: number | null; usaha: string; pesan: Pesan[] };

const galat = (e: { message: string }) => ({ galat: e.message });

export async function mulaiObrolan(kunci: string, nama: string, kontak: string, pesan: string): Promise<{ token: string } | { galat: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_web_chat", { p_kunci: kunci, p_nama: nama, p_kontak: kontak || null, p_pesan: pesan });
  if (error) return galat(error);
  return { token: (data as { token: string }).token };
}

export async function bacaObrolan(token: string): Promise<Obrolan | { galat: string }> {
  if (!/^[0-9a-f]{48}$/.test(token)) return { galat: "Obrolan tidak ditemukan" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("visitor_conversation", { p_token: token });
  if (error) return galat(error);
  return data as Obrolan;
}

export async function kirimPesan(token: string, isi: string): Promise<{ ok: true } | { galat: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_visitor_message", { p_token: token, p_isi: isi });
  return error ? galat(error) : { ok: true };
}

export async function nilaiObrolan(token: string, nilai: number): Promise<{ ok: true } | { galat: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rate_conversation", { p_token: token, p_nilai: nilai, p_catatan: null });
  return error ? galat(error) : { ok: true };
}
