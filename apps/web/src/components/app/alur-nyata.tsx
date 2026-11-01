import { CheckCircleIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { formatAngka } from "@/lib/format";
import { formatHari, jalurTeks, kalimatPenyimpangan, labelLangkah, ringkasAlur, sisiBerurut, type Alur } from "@/lib/alur/alur";

const KOSONG: Record<Alur["jenis"], string> = {
  invoice: "Belum ada invoice dalam 90 hari terakhir. Begitu invoice terbit, alurnya tergambar di sini.",
  rekrut: "Belum ada lamaran dalam 90 hari terakhir. Begitu pelamar masuk, alurnya tergambar di sini.",
};

/** Satu alur (invoice atau rekrut): alur kertas, jalur yang benar-benar terjadi, langkah ke langkah, dan penyimpangan. */
export function KartuAlur({ alur, judul }: { alur: Alur; judul: string }) {
  const ringkas = ringkasAlur(alur);
  const masalah = alur.penyimpangan.map(kalimatPenyimpangan).filter((k): k is string => k !== null);
  return (
    <div className="mt-6" data-testid={`alur-${alur.jenis}`}>
      <h3 className="font-semibold">{judul}</h3>
      {!ringkas ? (
        <p className="mt-2 text-sm text-tinta-2" data-testid="alur-kosong">{KOSONG[alur.jenis]}</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-tinta-2" data-testid="alur-ringkas">
            {ringkas}
            {alur.siklus_hari !== null ? ` Dari awal sampai selesai biasanya ${formatHari(alur.siklus_hari)}.` : null}
          </p>
          <p className="mt-3 text-sm"><span className="text-tinta-2">Alur kertas:</span> {jalurTeks(alur.kertas)}</p>

          {masalah.length > 0 ? (
            <ul className="mt-3 grid gap-2" data-testid="alur-penyimpangan">
              {masalah.map((k) => (
                <li key={k} className="flex items-start gap-2 text-sm">
                  <WarningIcon size={18} aria-hidden className="mt-0.5 shrink-0" />
                  <span><span className="stabilo rounded px-1">{k}</span></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-sm text-daun">
              <CheckCircleIcon size={18} aria-hidden className="mt-0.5 shrink-0" />
              <span>Tidak ada penyimpangan dari alur kertas.</span>
            </p>
          )}

          <h4 className="mt-5 text-sm font-semibold">Jalur yang paling sering terjadi</h4>
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="alur-varian">
            {alur.varian.map((v) => (
              <li key={v.jalur.join(">")} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 break-words">
                  {jalurTeks(v.jalur)}
                  {!v.selesai ? <span className="text-tinta-2"> (masih berjalan)</span> : null}
                </span>
                <span className="angka shrink-0 font-semibold">{formatAngka(v.jumlah)}</span>
              </li>
            ))}
          </ul>

          <h4 className="mt-5 text-sm font-semibold">Langkah ke langkah</h4>
          <table className="mt-2 w-full text-sm" data-testid="alur-sisi">
            <caption className="sr-only">Perpindahan antarlangkah {judul.toLowerCase()}: jumlah dan waktu tengah</caption>
            <thead>
              <tr className="border-b border-garis text-left text-tinta-2">
                <th scope="col" className="py-2 font-normal">Dari, lalu</th>
                <th scope="col" className="py-2 text-right font-normal">Kali</th>
                <th scope="col" className="py-2 text-right font-normal">Biasanya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-garis">
              {sisiBerurut(alur).map((s) => (
                <tr key={`${s.dari}>${s.ke}`}>
                  <td className="py-2 pr-2">{labelLangkah(s.dari)} → {labelLangkah(s.ke)}</td>
                  <td className="angka py-2 text-right">{formatAngka(s.jumlah)}</td>
                  <td className="py-2 pl-2 text-right whitespace-nowrap">{formatHari(s.median_hari)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** Bagian "Alur nyata" berisi alur invoice dan rekrut. */
export function AlurNyata({ invoice, rekrut, testid = "alur-nyata" }: { invoice: Alur; rekrut: Alur; testid?: string }) {
  return (
    <section className="mt-10 border-t border-garis pt-6" aria-labelledby={`judul-${testid}`} data-testid={testid}>
      <h2 id={`judul-${testid}`} className="text-lg font-semibold">Alur nyata vs alur kertas</h2>
      <p className="mt-1 text-sm text-tinta-2">Disusun dari catatan kejadian 90 hari terakhir: apa yang benar-benar terjadi, bukan yang tertulis di prosedur.</p>
      <KartuAlur alur={invoice} judul="Tagihan (invoice)" />
      <KartuAlur alur={rekrut} judul="Rekrut" />
    </section>
  );
}
