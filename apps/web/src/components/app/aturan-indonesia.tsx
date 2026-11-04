import { createClient } from "@/lib/supabase/server";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";

/** Negara usaha yang sedang dibuka (W-03). Bila belum terbaca dianggap Indonesia (bawaan kolom). */
export async function negaraUsaha(perusahaanId: string, bahasa: Bahasa = "id"): Promise<{ kode: string; nama: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("perusahaan").select("negara").eq("id", perusahaanId).maybeSingle();
  const kode = String(data?.negara ?? "ID");
  if (kode === "ID") return { kode, nama: "Indonesia" };
  const { data: n } = await supabase.from("negara").select("nama_id, nama_en").eq("kode", kode).maybeSingle();
  return { kode, nama: (bahasa === "en" ? n?.nama_en : n?.nama_id) ?? kode };
}

/** Modul berisi aturan Indonesia (gaji, PPh, BPJS, Coretax) dikunci untuk usaha di negara lain sampai ada paket aturannya. */
export function KunciAturan({ negara, bahasa }: { negara: string; bahasa: Bahasa }) {
  const t = ambilKamus(bahasa).aturanIndonesia;
  return (
    <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis-kuat bg-kertas-2 p-4" data-testid="aturan-terkunci" aria-labelledby="judul-kunci">
      <h2 id="judul-kunci" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm">{isiTeks(t.ket, { negara })}</p>
      <p className="mt-2 text-sm text-tinta-2">{t.tetapJalan}</p>
    </section>
  );
}
