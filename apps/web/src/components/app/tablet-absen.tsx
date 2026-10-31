import { cabutTablet } from "@/app/app/kios-actions";
import { BuatTautanTablet } from "@/components/app/buat-tautan-tablet";
import { formatTanggal } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { zonaSesi } from "@/lib/zona-usaha";

type Tablet = { id: string; nama: string; dibuat_at: string; dipakai_at: string | null };

/** Tablet absen yang terpasang di usaha ini (pemilik/admin). RPC menolak peran lain, maka kartu tidak tampil. */
export async function TabletAbsen() {
  const supabase = await createClient();
  const [{ data, error }, zona] = await Promise.all([supabase.rpc("daftar_token_kios"), zonaSesi()]);
  if (error) return null;
  const daftar = (data ?? []) as Tablet[];
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-tablet-absen" data-testid="tablet-absen">
      <h2 id="judul-tablet-absen" className="text-lg font-semibold">Tablet absen</h2>
      <p className="mt-1 text-sm text-tinta-2">
        Pasang tablet di pintu masuk tanpa masuk dengan akunmu. Tablet hanya bisa menampilkan QR absen, dan tautannya bisa kamu cabut kapan saja.
      </p>
      {daftar.length === 0 ? (
        <p className="mt-4 text-sm text-tinta-2" data-testid="tablet-kosong">Belum ada tablet yang dipasang.</p>
      ) : (
        <ul className="mt-4 divide-y divide-garis border-y border-garis">
          {daftar.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{t.nama}</p>
                <p className="text-sm text-tinta-2">
                  {t.dipakai_at ? `Terakhir menyala ${formatTanggal(new Date(t.dipakai_at), zona)}.` : `Dibuat ${formatTanggal(new Date(t.dibuat_at), zona)}, belum dibuka.`}
                </p>
              </div>
              <form action={cabutTablet}>
                <input type="hidden" name="id" value={t.id} />
                <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-cap px-3 text-sm font-semibold text-cap transition-[background-color,color] duration-150 hover:bg-cap hover:text-kertas" aria-label={`Cabut ${t.nama}`}>
                  Cabut
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <BuatTautanTablet />
    </section>
  );
}
