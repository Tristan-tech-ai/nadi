import { cabutTablet } from "@/app/app/kios-actions";
import { BuatTautanTablet } from "@/components/app/buat-tautan-tablet";
import { formatTanggal } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

type Tablet = { id: string; nama: string; dibuat_at: string; dipakai_at: string | null };

/** Tablet absen yang terpasang di usaha ini (pemilik/admin). RPC menolak peran lain, maka kartu tidak tampil. */
export async function TabletAbsen() {
  const supabase = await createClient();
  const [{ data, error }, zona] = await Promise.all([supabase.rpc("daftar_token_kios"), zonaSesi()]);
  if (error) return null;
  const daftar = (data ?? []) as Tablet[];
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).tablet;
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-tablet-absen" data-testid="tablet-absen" lang={bahasa}>
      <h2 id="judul-tablet-absen" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      {daftar.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-2" data-testid="tablet-kosong">{t.kosong}</p>
      ) : (
        <ul className="mt-4 divide-y divide-garis border-y border-garis">
          {daftar.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold" data-pengguna>{x.nama}</p>
                <p className="text-sm text-tinta-2">
                  {x.dipakai_at ? isiTeks(t.terakhir, { t: formatTanggal(new Date(x.dipakai_at), zona, bahasa) }) : isiTeks(t.dibuat, { t: formatTanggal(new Date(x.dibuat_at), zona, bahasa) })}
                </p>
              </div>
              <form action={cabutTablet}>
                <input type="hidden" name="id" value={x.id} />
                <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-cap px-3 text-sm font-semibold text-cap transition-[background-color,color] duration-150 hover:bg-cap hover:text-kertas" aria-label={isiTeks(t.cabutAria, { nama: x.nama })}>
                  {t.cabut}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <BuatTautanTablet teks={t} />
    </section>
  );
}
