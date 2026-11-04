import { KartuLangkah } from "@/components/app/langkah";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { createClient } from "@/lib/supabase/server";

type Langkah = { id: string; judul: string; penjelasan: string | null; pemohon: string; atas_nama: string | null };

/** M-11B: di Feed, pengajuan yang menunggu keputusan atasan langsung (atau delegasinya) sebelum sampai ke pemilik. */
export async function LangkahAtasan({ bahasa }: { bahasa: Bahasa }) {
  const t = ambilKamus(bahasa).survei;
  const supabase = await createClient();
  const { data } = await supabase.rpc("langkah_saya");
  const daftar = (data ?? []) as Langkah[];
  if (!daftar.length) return null;
  const isiLang = bahasa === "id" ? undefined : "id";
  return (
    <section className="mt-8" aria-labelledby="judul-langkah" data-testid="langkah-atasan">
      <h2 id="judul-langkah" className="text-lg font-semibold">{t.langkahJudul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.langkahKet}</p>
      <ul className="mt-3 divide-y divide-garis border-y border-garis">
        {daftar.map((l) => (
          <li key={l.id} className="py-3" data-pemohon={l.pemohon}>
            <p className="font-semibold" lang={isiLang} data-pengguna>{l.judul}</p>
            {l.atas_nama && <p className="text-sm text-tinta-2">{isiTeks(t.atasNama, { nama: l.atas_nama })}</p>}
            {l.penjelasan && <p className="text-sm text-tinta-2" lang={isiLang} data-pengguna>{l.penjelasan}</p>}
            <KartuLangkah langkah={l.id} judul={l.judul} teks={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
