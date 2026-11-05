import { formatDurasi } from "@/lib/mata/jejak";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { LangkahPertama } from "@/components/app/langkah-pertama";

// W-02: peta panas zona dari rekap kunjungan Mata (vision_heatmap). Komponen server, tanpa JS di peramban.
export type DataPanas = {
  kunjungan: number;
  lamaDetik: number;
  tungguN: number;
  tungguDetik: number;
  layanN: number;
  layanDetik: number;
  zona: { id: string; nama: string; jenis: string; poligon: [number, number][]; lintas: number; detik: number }[];
  jam: { jam: number; kunjungan: number }[];
  jalur: { jalur: string; kunjungan: number }[];
  papan: unknown;
};

const LEBAR = 1000;
const TINGGI = 750;

export function PetaPanas({ data: d, teks: t, bahasa }: { data: DataPanas; teks: Kamus["petaPanas"]; bahasa: string }) {
  const maks = Math.max(1, ...d.zona.map((z) => z.detik));
  const rata = (jumlah: number, n: number) => (n ? formatDurasi(jumlah / n, bahasa) : t.tidakAda);
  const ramai = [...d.jam].sort((a, b) => b.kunjungan - a.kunjungan || a.jam - b.jam)[0];
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-panas" data-testid="peta-panas" data-kunjungan={d.kunjungan}>
      <h2 id="judul-panas" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      {!d.papan ? <p className="mt-2 text-sm text-tinta-2">{t.papanBelum}</p> : null}
      {!d.kunjungan ? (
        <p className="mt-3 text-sm text-tinta-2" data-testid="panas-kosong">{t.kosong} <LangkahPertama href="/app/mata">{t.langkahKosong}</LangkahPertama></p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-tinta-2">{t.kunjungan}</dt><dd className="text-2xl font-semibold tabular-nums" data-testid="panas-jumlah">{d.kunjungan.toLocaleString(bahasa === "en" ? "en-GB" : "id-ID")}</dd></div>
            <div><dt className="text-tinta-2">{t.lamaRata}</dt><dd className="font-semibold">{rata(d.lamaDetik, d.kunjungan)}</dd></div>
            <div><dt className="text-tinta-2">{t.tunggu}</dt><dd className="font-semibold">{d.tungguN ? isiTeks(t.tungguIsi, { n: d.tungguN, lama: rata(d.tungguDetik, d.tungguN) }) : t.tidakAda}</dd></div>
            <div><dt className="text-tinta-2">{t.layan}</dt><dd className="font-semibold">{d.layanN ? isiTeks(t.layanIsi, { n: d.layanN, lama: rata(d.layanDetik, d.layanN) }) : t.tidakAda}</dd></div>
          </dl>
          <svg viewBox={`0 0 ${LEBAR} ${TINGGI}`} className="mt-4 w-full rounded-[var(--radius-kartu)] border border-garis bg-kertas-2" role="img" aria-label={t.denahAria}>
            {d.zona.map((z) => {
              const titik = z.poligon.map(([x, y]) => `${x * LEBAR},${y * TINGGI}`).join(" ");
              const cx = (z.poligon.reduce((s, [x]) => s + x, 0) / z.poligon.length) * LEBAR;
              const cy = (z.poligon.reduce((s, [, y]) => s + y, 0) / z.poligon.length) * TINGGI;
              const f = z.detik / maks;
              // Di atas kunyit pekat teks harus gelap di kedua tema (pola yang sama dengan denah langsung).
              const tinta = f > 0.45 ? "fill-tinta dark:fill-kertas" : "fill-tinta";
              return (
                <g key={z.id} data-testid="panas-zona" data-nama={z.nama} data-detik={z.detik}>
                  <polygon points={titik} className="fill-kunyit stroke-garis-kuat" fillOpacity={z.detik ? 0.15 + 0.85 * f : 0} strokeWidth={3} />
                  <text x={cx} y={cy - 6} textAnchor="middle" className={`${tinta} text-[28px] font-semibold`}>{z.nama}</text>
                  <text x={cx} y={cy + 28} textAnchor="middle" className={`${tinta} text-[24px]`}>{formatDurasi(z.detik, bahasa)}</text>
                </g>
              );
            })}
          </svg>
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm">
            {[...d.zona].sort((a, b) => b.detik - a.detik).map((z) => (
              <li key={z.id} className="flex justify-between gap-3 py-1.5">
                <span data-pengguna>{z.nama}</span>
                <span className="text-tinta-2 tabular-nums">{isiTeks(t.zonaIsi, { n: z.lintas, lama: formatDurasi(z.detik, bahasa) })}</span>
              </li>
            ))}
          </ul>
          {ramai ? <p className="mt-4 text-sm"><span className="font-semibold">{t.jamRamai}:</span> {isiTeks(t.jamIsi, { jam: String(ramai.jam).padStart(2, "0"), n: ramai.kunjungan })}</p> : null}
          <h3 className="mt-6 font-semibold">{t.jalurJudul}</h3>
          <p className="text-sm text-tinta-2">{t.jalurKet}</p>
          {d.jalur.length ? (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm" data-testid="panas-jalur">
              {d.jalur.map((j) => <li key={j.jalur}><span data-pengguna>{j.jalur}</span> <span className="text-tinta-2">({isiTeks(t.jalurIsi, { n: j.kunjungan })})</span></li>)}
            </ol>
          ) : <p className="mt-2 text-sm text-tinta-2">{t.tidakAda}</p>}
        </>
      )}
    </section>
  );
}
