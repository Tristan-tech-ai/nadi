import Link from "next/link";
import { Rupiah } from "@/components/ui/rupiah";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { sisip } from "@/lib/i18n/sisip";
import { createClient } from "@/lib/supabase/server";

type Uang = { kas_bank: number; piutang: number; utang: number; laba: number; laba_bulan_lalu: number; ada_jurnal: boolean };

/** Dasbor uang di Feed (M-01): kas dan bank, tagihan belum dibayar, utang, laba bulan ini. RPC menolak staf, jadi staf tidak
 *  melihatnya; usaha tanpa jurnal juga tidak melihat kartu kosong. */
export async function RingkasanUang({ bahasa = "id" }: { bahasa?: Bahasa }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ringkasan_uang");
  if (error || !data) return null;
  const u = data as Uang;
  if (!u.ada_jurnal) return null;
  const t = ambilKamus(bahasa).buku;
  const isi: [string, number, string][] = [[t.kasBank, u.kas_bank, "kas"], [t.piutang, u.piutang, "piutang"], [t.utang, u.utang, "utang"], [t.labaBulan, u.laba, "laba"]];
  return (
    <section className="mt-6" aria-labelledby="judul-uang" data-testid="ringkasan-uang">
      <h2 id="judul-uang" className="text-lg font-semibold">{t.ringkasJudul}</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        {isi.map(([label, nilai, kunci]) => (
          <div key={kunci} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-uang={kunci}>
            <dt className="text-sm text-tinta-2">{label}</dt>
            <dd className="mt-1 text-xl font-semibold"><Rupiah nilai={nilai} ringkas bahasa={bahasa} /></dd>
            {kunci === "laba" ? <dd className="mt-1 text-xs text-tinta-2">{sisip(t.bulanLalu, { rp: <Rupiah nilai={u.laba_bulan_lalu} ringkas bahasa={bahasa} /> })}</dd> : null}
          </div>
        ))}
      </dl>
      <Link href="/app/buku" className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">{t.lihat}</Link>
    </section>
  );
}
