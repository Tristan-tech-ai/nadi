import "server-only";
import { cacheLife } from "next/cache";
import { readPublicEnv } from "@/lib/env";
import type { PetaAturan } from "@/lib/gaji/susun";

export type SumberAturan = { kunci: string; sumber: string | null; berlaku_dari: string; terverifikasi: boolean };

/**
 * L-05: aturan bertanggal yang sama dengan yang dipakai Gaji di aplikasi (tabel aturan_bertanggal, boleh dibaca publik),
 * diambil terbaru per kunci yang sudah berlaku hari ini dan belum berakhir (berlaku_sampai). Aturan yang belum terverifikasi ikut terkirim dengan tandanya,
 * dan susunSlip tidak memakainya (sama dengan aplikasi).
 */
export async function aturanPublik(hari: string): Promise<{ aturan: PetaAturan; sumber: SumberAturan[] }> {
  "use cache";
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/aturan_bertanggal?select=kunci,nilai,terverifikasi,berlaku_dari,sumber&berlaku_dari=lte.${hari}&or=(berlaku_sampai.is.null,berlaku_sampai.gte.${hari})&order=berlaku_dari.desc`, {
      headers: { apikey: supabasePublishableKey, Authorization: `Bearer ${supabasePublishableKey}` },
    });
    if (!r.ok) throw new Error(String(r.status));
    const baris = (await r.json()) as (SumberAturan & { nilai: unknown })[];
    const aturan: PetaAturan = {};
    const sumber: SumberAturan[] = [];
    for (const a of baris) {
      if (aturan[a.kunci]) continue;
      aturan[a.kunci] = { nilai: a.nilai, terverifikasi: a.terverifikasi };
      sumber.push({ kunci: a.kunci, sumber: a.sumber, berlaku_dari: a.berlaku_dari, terverifikasi: a.terverifikasi });
    }
    cacheLife("hours");
    return { aturan, sumber };
  } catch {
    cacheLife("seconds");
    return { aturan: {}, sumber: [] };
  }
}
