import "server-only";
import { createClient } from "@/lib/supabase/server";
import { halamanTersembunyi, modulNyala } from "@/lib/fitur-usaha";
import { ruangUntuk, type Ruang } from "@/lib/ruang";

/** Modul fitur yang menyala untuk usaha ini (U-06): bawaan paket usaha ditimpa pilihan pemilik di pengaturan.fitur. */
export async function fiturUsaha(perusahaanId: string | null | undefined): Promise<Set<string>> {
  if (!perusahaanId) return modulNyala(null, null);
  const supabase = await createClient();
  const { data } = await supabase.from("perusahaan").select("industri, pengaturan").eq("id", perusahaanId).maybeSingle();
  const p = data as { industri: string | null; pengaturan: { fitur?: Record<string, unknown> } | null } | null;
  return modulNyala(p?.industri ?? null, p?.pengaturan?.fitur ?? null);
}

// Ruang yang tampil untuk sesi ini: peta ruang menurut peran, lalu halaman modul yang mati disembunyikan (U-06), lalu staf hanya
// melihat Magang bila dia mentor atau peserta (RLS rencana_magang) dan Rekam ilmu bila sedang berhenti dan punya butir ilmu (F3-07C).
// `mati` = halaman yang boleh untuk peran ini tetapi modulnya dimatikan: tetap bisa dicari dan dinyalakan lagi.
export async function ruangSesi(peran: string, perusahaanId?: string | null): Promise<Ruang[]> {
  return (await ruangDanMati(peran, perusahaanId)).ruang;
}

export async function ruangDanMati(peran: string, perusahaanId?: string | null): Promise<{ ruang: Ruang[]; mati: Ruang[] }> {
  let magang = false;
  let ilmu = false;
  const supabase = await createClient();
  const [nyala] = await Promise.all([
    fiturUsaha(perusahaanId),
    peran === "staf"
      ? Promise.all([
          supabase.from("rencana_magang").select("id", { count: "exact", head: true }),
          supabase.from("serah_butir").select("id", { count: "exact", head: true }).eq("jenis", "ilmu"),
        ]).then(([{ count }, { count: nIlmu }]) => { magang = (count ?? 0) > 0; ilmu = (nIlmu ?? 0) > 0; })
      : Promise.resolve(),
  ]);
  const sembunyi = halamanTersembunyi(nyala);
  const dasar = ruangUntuk(peran).map((r) => ({ ...r, halaman: r.halaman.filter((x) =>
    peran !== "staf" || ((x.href !== "/app/magang" || magang) && (x.href !== "/app/ilmu" || ilmu))) }));
  return {
    ruang: dasar.map((r) => ({ ...r, halaman: r.halaman.filter((x) => !sembunyi.has(x.href)) })).filter((r) => r.halaman.length > 0),
    mati: dasar.map((r) => ({ ...r, halaman: r.halaman.filter((x) => sembunyi.has(x.href)) })).filter((r) => r.halaman.length > 0),
  };
}
