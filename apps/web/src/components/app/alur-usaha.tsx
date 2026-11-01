import { AlurNyata } from "@/components/app/alur-nyata";
import type { Alur } from "@/lib/alur/alur";
import { createClient } from "@/lib/supabase/server";

/** Alur nyata usaha yang sedang dibuka; RPC alur_proses menolak selain pemilik/admin, jadi bagian ini tidak tampil untuk mereka. */
export async function AlurUsaha() {
  const supabase = await createClient();
  const [inv, rek] = await Promise.all([
    supabase.rpc("alur_proses", { p_jenis: "invoice", p_hari: 90 }),
    supabase.rpc("alur_proses", { p_jenis: "rekrut", p_hari: 90 }),
  ]);
  if (inv.error || rek.error || !inv.data || !rek.data) return null;
  return <AlurNyata invoice={inv.data as Alur} rekrut={rek.data as Alur} />;
}
