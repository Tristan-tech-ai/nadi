import { Rupiah } from "@/components/ui/rupiah";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { createClient } from "@/lib/supabase/server";

export type Sarapan = { tanggal: string | null; insight: { kode: string; dampak_rp: number; teks: string; dari_model: boolean }[] };

/** Paling banyak 3 hal berdampak rupiah yang disusun semalam. Tidak ada yang penting = bagian ini tidak tampil sama sekali. */
export function DaftarSarapan({ sarapan, bahasa = "id" }: { sarapan: Sarapan; bahasa?: Bahasa }) {
  if (!sarapan.insight.length) return null;
  const t = ambilKamus(bahasa).sarapan;
  // Kalimat insight disusun dalam bahasa Indonesia (aturan SQL); di mode Inggris ditandai lang="id" (WCAG 3.1.2).
  const isiLang = bahasa === "id" ? undefined : "id";
  return (
    <section id="sarapan" className="mt-8" aria-labelledby="judul-sarapan" data-testid="sarapan-data">
      <h2 id="judul-sarapan" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      <ol className="mt-3 divide-y divide-garis border-y border-garis">
        {sarapan.insight.map((i) => (
          <li key={i.kode} className="py-3" data-kode={i.kode}>
            <p className="text-sm text-tinta-2">{t.dampak} <span className="font-semibold text-tinta"><Rupiah nilai={i.dampak_rp} bahasa={bahasa} /></span></p>
            <p className="mt-1" lang={isiLang}>{i.teks}</p>
            {i.dari_model ? <p className="mt-1 text-xs text-tinta-2">{t.dariModel}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Sarapan Data usaha yang sedang dibuka; RPC menolak selain pemilik/admin, jadi staf tidak melihat bagian ini. */
export async function SarapanData({ bahasa = "id" }: { bahasa?: Bahasa }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sarapan_data");
  if (error || !data) return null;
  return <DaftarSarapan sarapan={data as Sarapan} bahasa={bahasa} />;
}
