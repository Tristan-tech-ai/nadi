import { laporanLingkaran, MIN_SAMPEL, type BarisLingkaran } from "@/lib/rekrut/lingkaran";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { LangkahPertama } from "@/components/app/langkah-pertama";

// F2-07 (docs/research/lingkaran-rekrut.md): pertanyaan seleksi mana yang searah dengan kinerja bulan ke-3 sampai ke-6.
// Hanya pemilik dan admin; hanya agregat per pertanyaan, tanpa nama.

type Mentah = {
  belum_genap: number;
  baris: { lamaran: string; minggu: number; poin_per_minggu: number; persen_tepat: number | null; wawancara: { pertanyaan: string; skor: number | null }[]; uji: { topi_kode: string; benih: number; jawaban: string[] } | null }[];
};

export async function LingkaranRekrut() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lingkaran_rekrut");
  const m = data as Mentah | null;
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).lingkaran;
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-lingkaran" data-testid="lingkaran-rekrut">
      <h2 id="judul-lingkaran" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      {error || !m ? (
        <p role="alert" className="mt-3 text-sm text-cap">{t.gagal}</p>
      ) : (() => {
        const baris: BarisLingkaran[] = m.baris.map((b) => ({
          lamaran: b.lamaran, minggu: b.minggu, poinPerMinggu: Number(b.poin_per_minggu), persenTepat: b.persen_tepat === null ? null : Number(b.persen_tepat),
          wawancara: b.wawancara.map((w) => ({ pertanyaan: w.pertanyaan, skor: w.skor === null ? null : Number(w.skor) })),
          uji: b.uji ? { topiKode: b.uji.topi_kode, benih: b.uji.benih, jawaban: b.uji.jawaban } : null,
        }));
        const lap = laporanLingkaran(baris);
        return (
          <>
            <p className="mt-3 text-sm" data-testid="lingkaran-ringkas">
              {isiTeks(t.ringkas, { n: lap.orang, lain: m.belum_genap ? isiTeks(t.lainBelum, { n: m.belum_genap }) : "", min: MIN_SAMPEL })}
            </p>
            {lap.sinyal.length === 0 ? (
              <p className="mt-2 text-sm text-tinta-2" data-testid="lingkaran-kosong">{t.kosong} <LangkahPertama href="/app/rekrutmen">{t.langkahKosong}</LangkahPertama></p>
            ) : (
              <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="lingkaran-daftar" lang={bahasa === "id" ? undefined : "id"}>
                {lap.sinyal.map((s) => (
                  <li key={`${s.sinyal}-${s.ukuran}`} className="py-2">{s.kalimat}</li>
                ))}
              </ul>
            )}
          </>
        );
      })()}
    </section>
  );
}
