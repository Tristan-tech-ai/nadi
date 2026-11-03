import { ArrowsLeftRightIcon } from "@phosphor-icons/react/dist/ssr";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { kalimatTerberat, kolomBeban, MIN_SELESAI, ringkasBeban, teksBebanSaya, teksJamBeban, type BebanMinggu, type BebanSaya } from "@/lib/kerja/adil";
import { formatPoin } from "@/lib/kerja/poin";

/**
 * Layar pemilik/admin "Beban minggu ini" (docs/design/bagi-adil.md): satu kalimat angka, satu baris per orang bergaris buku kas,
 * penanda "paling berat" berupa teks di atas stabilo kunyit, keadaan belum cukup data, dan keterangan jam jadwal sama rata.
 */
export function BebanMingguIni({ data, bahasa = "id" }: { data: BebanMinggu; bahasa?: Bahasa }) {
  const t = ambilKamus(bahasa).beban;
  const tanggal = (x: string) => formatTanggalKalender(x, bahasa);
  const poin = (n: number) => formatPoin(n, bahasa);
  const orang = data.orang.map((o) => ({ ...o, poin: Number(o.poin), jam: Number(o.jam), topi: o.topi, terakhirDiberi: null }));
  const cukup = data.selesai_n >= MIN_SELESAI;
  const ringkas = ringkasBeban(orang);
  const terberat = cukup ? ringkas.terberat?.id ?? null : null;
  const kolom = kolomBeban(data.jam_sama_rata, orang);
  const grid = kolom.pakaiJam ? "lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_minmax(0,2fr)]" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,3fr)]";
  const berbeban = orang.filter((o) => o.poin > 0 || Number(o.antre) > 0);
  const kosong = orang.filter((o) => !(o.poin > 0 || Number(o.antre) > 0));

  return (
    <section aria-labelledby="judul-beban" className="mt-6" data-testid="beban-minggu" data-gini={ringkas.gini.toFixed(4)} data-selesai={data.selesai_n}>
      <h2 id="judul-beban" className="text-lg font-semibold">{t.judul}</h2>
      <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.ket, { a: tanggal(data.mulai), b: tanggal(data.akhir) })}</p>
      {cukup ? (
        ringkas.terberat && <p className="mt-3 text-base font-semibold" data-testid="kalimat-beban">{kalimatTerberat(ringkas, data.jam_sama_rata, bahasa)}</p>
      ) : (
        <p className="mt-3 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="beban-belum">{isiTeks(t.belum, { min: MIN_SELESAI, n: data.selesai_n })}</p>
      )}
      {data.jam_sama_rata && (
        <p className="mt-2 text-sm text-tinta-2" data-testid="jam-sama-rata">{isiTeks(t.samaRata, { jam: data.jam_bawaan })}</p>
      )}

      {orang.length === 0 ? (
        <p className="mt-4 text-tinta-2" data-testid="beban-kosong">{t.kosong}</p>
      ) : (
        <>
          <div className={`mt-4 hidden border-b border-garis-kuat pb-1 text-xs font-semibold text-tinta-2 lg:grid ${grid} lg:gap-3`} aria-hidden>
            <span>{t.kolOrang}</span><span className="text-right">{t.kolPoin}</span>{kolom.pakaiJam && <><span className="text-right">{t.kolJam}</span><span className="text-right">{t.kolPerJam}</span></>}<span>{t.kolBanding}</span>
          </div>
          <ul className="divide-y divide-garis border-y border-garis lg:border-t-0" data-testid="daftar-beban">
            {berbeban.map((o) => {
              const { jam: jamTeks, perJam } = teksJamBeban(o, bahasa);
              const perJamTeks = perJam ?? "-";
              const lebar = kolom.lebar(o);
              const berat = o.id === terberat;
              return (
                <li key={o.id} className={`grid gap-1 py-3 ${grid} lg:items-center lg:gap-3`}
                  data-testid="baris-beban" data-nama={o.nama} data-berat={berat ? "ya" : undefined}>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      <span data-pengguna>{o.nama}</span>
                      {berat && <span className="stabilo ml-2 rounded px-1.5 py-0.5 text-xs font-semibold" data-testid="paling-berat">{t.palingBerat}</span>}
                    </p>
                    <p className="text-sm text-tinta-2">{o.topi.length ? <span data-pengguna>{o.topi.join(", ")}</span> : t.tanpaTopi}</p>
                    {o.lintas_n > 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs" data-testid="beban-lintas">
                        <ArrowsLeftRightIcon size={14} aria-hidden /> {isiTeks(t.lintas, { poin: poin(Number(o.lintas_poin)) })}
                      </p>
                    )}
                  </div>
                  <p className="angka text-sm lg:text-right" data-testid="beban-poin">
                    {poin(o.poin)}{kolom.pakaiJam && <span className="lg:hidden"> · {jamTeks}{perJam && isiTeks(t.perJam, { n: perJam })}</span>}
                    {Number(o.antre) > 0 && <span className="block text-xs text-tinta-2">{isiTeks(t.antre, { poin: poin(Number(o.antre)) })}</span>}
                  </p>
                  {kolom.pakaiJam && <p className="angka hidden text-right text-sm lg:block" data-testid="beban-jam">{jamTeks}</p>}
                  {kolom.pakaiJam && <p className="angka hidden text-right text-sm lg:block" data-testid="beban-per-jam">{perJamTeks}</p>}
                  <div className="h-1.5 w-full rounded-full bg-garis" aria-hidden>
                    <div className="h-1.5 rounded-full bg-tinta-2" style={{ width: `${lebar}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {kosong.length > 0 && (
            <details className="mt-3 text-sm" data-testid="beban-nol">
              <summary className="cursor-pointer text-tinta-2 underline-offset-4 hover:underline">
                {isiTeks(t.nol, { n: kosong.length })}
              </summary>
              <p className="mt-2 text-tinta-2" data-pengguna>{kosong.map((o) => o.nama).join(", ")}.</p>
            </details>
          )}
        </>
      )}
    </section>
  );
}

/** Layar staf: bebannya sendiri dibanding rata-rata tim, tanpa nama rekan. */
export function BebanSayaIni({ data, bahasa = "id" }: { data: BebanSaya; bahasa?: Bahasa }) {
  const t = ambilKamus(bahasa).beban;
  return (
    <section aria-label={t.sayaAria} className="mt-4 rounded-[var(--radius-isian)] border border-garis p-3" data-testid="beban-saya">
      <p className="text-sm font-semibold" data-testid="beban-saya-teks">{teksBebanSaya({ ...data, poin: data.poin === null ? null : Number(data.poin), rata_rata: data.rata_rata === null ? null : Number(data.rata_rata) }, bahasa)}</p>
      {data.di_atas && <p className="mt-1 text-sm" data-testid="beban-saya-atas">{t.sayaAtas}</p>}
    </section>
  );
}
