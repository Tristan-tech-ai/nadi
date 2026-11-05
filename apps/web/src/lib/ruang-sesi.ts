import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ruangUntuk, type Ruang } from "@/lib/ruang";

// Ruang yang tampil untuk sesi ini: peta ruang menurut peran, lalu staf hanya melihat Magang bila dia mentor atau peserta
// (RLS rencana_magang) dan Rekam ilmu bila sedang berhenti dan punya butir ilmu (F3-07C). Dipakai kerangka, Semua menu, dan cari.
export async function ruangSesi(peran: string): Promise<Ruang[]> {
  let magang = false;
  let ilmu = false;
  if (peran === "staf") {
    const supabase = await createClient();
    const [{ count }, { count: nIlmu }] = await Promise.all([
      supabase.from("rencana_magang").select("id", { count: "exact", head: true }),
      supabase.from("serah_butir").select("id", { count: "exact", head: true }).eq("jenis", "ilmu"),
    ]);
    magang = (count ?? 0) > 0;
    ilmu = (nIlmu ?? 0) > 0;
  }
  return ruangUntuk(peran)
    .map((r) => ({ ...r, halaman: r.halaman.filter((x) => peran !== "staf" || ((x.href !== "/app/magang" || magang) && (x.href !== "/app/ilmu" || ilmu))) }))
    .filter((r) => r.halaman.length > 0);
}
