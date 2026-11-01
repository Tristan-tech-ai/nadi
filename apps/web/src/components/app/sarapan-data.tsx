import { Rupiah } from "@/components/ui/rupiah";
import { createClient } from "@/lib/supabase/server";

export type Sarapan = { tanggal: string | null; insight: { kode: string; dampak_rp: number; teks: string; dari_model: boolean }[] };

/** Paling banyak 3 hal berdampak rupiah yang disusun semalam. Tidak ada yang penting = bagian ini tidak tampil sama sekali. */
export function DaftarSarapan({ sarapan }: { sarapan: Sarapan }) {
  if (!sarapan.insight.length) return null;
  return (
    <section id="sarapan" className="mt-8" aria-labelledby="judul-sarapan" data-testid="sarapan-data">
      <h2 id="judul-sarapan" className="text-lg font-semibold">Sarapan data</h2>
      <p className="mt-1 text-sm text-tinta-2">Dihitung semalam dari catatan usahamu. Hanya yang berdampak rupiah.</p>
      <ol className="mt-3 divide-y divide-garis border-y border-garis">
        {sarapan.insight.map((i) => (
          <li key={i.kode} className="py-3" data-kode={i.kode}>
            <p className="text-sm text-tinta-2">Dampak <span className="font-semibold text-tinta"><Rupiah nilai={i.dampak_rp} /></span></p>
            <p className="mt-1">{i.teks}</p>
            {i.dari_model ? <p className="mt-1 text-xs text-tinta-2">Kalimat dirapikan AI; angkanya diperiksa sama dengan hitungan Nadi.</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Sarapan Data usaha yang sedang dibuka; RPC menolak selain pemilik/admin, jadi staf tidak melihat bagian ini. */
export async function SarapanData() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sarapan_data");
  if (error || !data) return null;
  return <DaftarSarapan sarapan={data as Sarapan} />;
}
