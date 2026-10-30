import { createClient } from "@/lib/supabase/server";
import { formatAngka } from "@/lib/format";

type Ringkasan = { hari: number; berkas_model: number; berkas_aturan: number; token_baca: number; token_tulis_aturan: number; token_cache: number; token_hemat: number; aturan_aktif: number };

/** Kartu pemakaian AI 30 hari untuk pemilik/admin (RPC ringkasan_ai mengembalikan null untuk peran lain). */
export async function HematAi() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("ringkasan_ai", { p_hari: 30 });
  const r = data as Ringkasan | null;
  if (!r) return null;
  const kosong = r.berkas_model + r.berkas_aturan === 0;
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-hemat-ai" data-testid="hemat-ai">
      <h2 id="judul-hemat-ai" className="text-lg font-semibold">AI dalam {r.hari} hari terakhir</h2>
      {kosong ? (
        <p className="mt-2 text-sm text-tinta-2" data-testid="hemat-ai-kosong">
          Belum ada berkas yang dibaca. Setelah kamu melempar berkas, di sini terlihat berapa yang dibaca AI dan berapa yang cukup dibaca aturan tersimpan tanpa biaya.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
              <dt className="text-sm text-tinta-2">Dibaca AI</dt>
              <dd className="angka mt-1 text-2xl font-semibold">{formatAngka(r.berkas_model)} <span className="text-sm font-normal text-tinta-2">berkas</span></dd>
            </div>
            <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
              <dt className="text-sm text-tinta-2">Dibaca tanpa AI</dt>
              <dd className="angka mt-1 text-2xl font-semibold" data-testid="berkas-aturan">{formatAngka(r.berkas_aturan)} <span className="text-sm font-normal text-tinta-2">berkas</span></dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-tinta-2" data-testid="ringkas-token">
            Token terpakai {formatAngka(r.token_baca + r.token_tulis_aturan)}.
            {r.aturan_aktif > 0 ? ` Nadi sudah hafal ${formatAngka(r.aturan_aktif)} tata letak berkasmu, jadi berkas serupa berikutnya dibaca tanpa AI.` : " Setelah Nadi hafal tata letak berkasmu (slip, invoice, mutasi), berkas serupa dibaca tanpa AI."}
            {r.token_hemat > 0 ? <> Perkiraan token yang dihemat <strong className="angka font-semibold text-tinta">{formatAngka(r.token_hemat)}</strong>.</> : null}
          </p>
        </>
      )}
    </section>
  );
}
