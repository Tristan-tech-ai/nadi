"use server";

import type { Pratinjau } from "@/lib/rincian-usulan";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

/** U-13: rincian satu usulan (baca saja) lewat RPC preview_proposal; hanya pemilik/admin usaha yang sama. */
export async function bacaRincian(usulanId: string): Promise<{ data?: Pratinjau; galat?: string }> {
  await wajibPerusahaan();
  if (!/^[0-9a-f-]{36}$/i.test(usulanId)) return { galat: "Usulan tidak dikenal." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_proposal", { p_usulan: usulanId });
  if (error) return { galat: error.code === "42501" ? "Rincian hanya untuk pemilik atau admin." : "Rincian belum bisa dibuka. Coba lagi." };
  return { data: data as Pratinjau };
}
