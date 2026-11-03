import { createClient } from "@/lib/supabase/server";
import { formatAngka } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";

type Ringkasan = { hari: number; berkas_model: number; berkas_aturan: number; token_baca: number; token_tulis_aturan: number; token_cache: number; token_hemat: number; aturan_aktif: number };

/** Kartu pemakaian AI 30 hari untuk pemilik/admin (RPC ringkasan_ai mengembalikan null untuk peran lain). */
export async function HematAi() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ringkasan_ai", { p_hari: 30 });
  const r = data as Ringkasan | null;
  if (!r) return null;
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).hematAi;
  const angka = (n: number) => formatAngka(n, bahasa);
  const kosong = r.berkas_model + r.berkas_aturan === 0;
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-hemat-ai" data-testid="hemat-ai" lang={bahasa}>
      <h2 id="judul-hemat-ai" className="text-lg font-semibold">{isiTeks(t.judul, { n: r.hari })}</h2>
      {kosong ? (
        <p className="mt-2 text-sm text-tinta-2" data-testid="hemat-ai-kosong">{t.kosong}</p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
              <dt className="text-sm text-tinta-2">{t.dibacaAi}</dt>
              <dd className="angka mt-1 text-2xl font-semibold">{angka(r.berkas_model)} <span className="text-sm font-normal text-tinta-2">{t.berkas}</span></dd>
            </div>
            <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
              <dt className="text-sm text-tinta-2">{t.dibacaTanpa}</dt>
              <dd className="angka mt-1 text-2xl font-semibold" data-testid="berkas-aturan">{angka(r.berkas_aturan)} <span className="text-sm font-normal text-tinta-2">{t.berkas}</span></dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-tinta-2" data-testid="ringkas-token">
            {isiTeks(t.token, { n: angka(r.token_baca + r.token_tulis_aturan) })}
            {r.aturan_aktif > 0 ? isiTeks(t.hafal, { n: angka(r.aturan_aktif) }) : t.belumHafal}
            {r.token_hemat > 0 ? sisip(t.hemat, { n: <strong className="angka font-semibold text-tinta">{angka(r.token_hemat)}</strong> }) : null}
          </p>
        </>
      )}
    </section>
  );
}
