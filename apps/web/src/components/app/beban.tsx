import { ArrowsLeftRightIcon } from "@phosphor-icons/react/dist/ssr";
import { formatTanggal } from "@/lib/format";
import { kalimatTerberat, MIN_SELESAI, ringkasBeban, teksBebanSaya, type BebanMinggu, type BebanSaya } from "@/lib/kerja/adil";
import { formatPoin } from "@/lib/kerja/poin";

const angka = (x: number, digit = 2) => String(Math.round(x * 10 ** digit) / 10 ** digit).replace(".", ",");
const tanggal = (iso: string) => formatTanggal(new Date(`${iso}T00:00:00Z`), "UTC");

/**
 * Layar pemilik/admin "Beban minggu ini" (docs/design/bagi-adil.md): satu kalimat angka, satu baris per orang bergaris buku kas,
 * penanda "paling berat" berupa teks di atas stabilo kunyit, keadaan belum cukup data, dan keterangan jam jadwal sama rata.
 */
export function BebanMingguIni({ data }: { data: BebanMinggu }) {
  const orang = data.orang.map((o) => ({ ...o, poin: Number(o.poin), jam: Number(o.jam), topi: o.topi, terakhirDiberi: null }));
  const cukup = data.selesai_n >= MIN_SELESAI;
  const ringkas = ringkasBeban(orang);
  const terberat = cukup ? ringkas.terberat?.id ?? null : null;
  const terbesar = Math.max(0, ...orang.map((o) => o.poin / o.jam));
  const berbeban = orang.filter((o) => o.poin > 0 || Number(o.antre) > 0);
  const kosong = orang.filter((o) => !(o.poin > 0 || Number(o.antre) > 0));

  return (
    <section aria-labelledby="judul-beban" className="mt-6" data-testid="beban-minggu" data-gini={ringkas.gini.toFixed(4)} data-selesai={data.selesai_n}>
      <h2 id="judul-beban" className="text-lg font-semibold">Beban minggu ini</h2>
      <p className="mt-1 text-sm text-tinta-2">
        {tanggal(data.mulai)} sampai {tanggal(data.akhir)}. Dihitung dari poin perkiraan kerja yang selesai dan yang sedang berjalan, bukan dari lama orang mengerjakannya.
      </p>
      {cukup ? (
        ringkas.terberat && <p className="mt-3 text-base font-semibold" data-testid="kalimat-beban">{kalimatTerberat(ringkas)}</p>
      ) : (
        <p className="mt-3 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="beban-belum">
          Beban belum bisa dibandingkan. Butuh minimal {MIN_SELESAI} kerja selesai minggu ini; sekarang baru {data.selesai_n}.
        </p>
      )}
      {data.jam_sama_rata && (
        <p className="mt-2 text-sm text-tinta-2" data-testid="jam-sama-rata">
          Jam kerja belum diatur, jadi semua orang dianggap punya jam yang sama ({data.jam_bawaan} jam seminggu).
        </p>
      )}

      {orang.length === 0 ? (
        <p className="mt-4 text-tinta-2" data-testid="beban-kosong">Belum ada orang aktif. Tambah orang di menu Orang dulu.</p>
      ) : (
        <>
          <div className="mt-4 hidden border-b border-garis-kuat pb-1 text-xs font-semibold text-tinta-2 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_minmax(0,2fr)] lg:gap-3" aria-hidden>
            <span>Orang dan topi</span><span className="text-right">Poin</span><span className="text-right">Jam jadwal</span><span className="text-right">Poin per jam</span><span>Perbandingan</span>
          </div>
          <ul className="divide-y divide-garis border-y border-garis lg:border-t-0" data-testid="daftar-beban">
            {berbeban.map((o) => {
              const perJam = o.poin / o.jam;
              const lebar = terbesar > 0 ? Math.max(2, Math.round((perJam / terbesar) * 100)) : 0;
              const berat = o.id === terberat;
              return (
                <li key={o.id} className="grid gap-1 py-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_minmax(0,2fr)] lg:items-center lg:gap-3"
                  data-testid="baris-beban" data-nama={o.nama} data-berat={berat ? "ya" : undefined}>
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {o.nama}
                      {berat && <span className="stabilo ml-2 rounded px-1.5 py-0.5 text-xs font-semibold" data-testid="paling-berat">paling berat</span>}
                    </p>
                    <p className="text-sm text-tinta-2">{o.topi.length ? o.topi.join(", ") : "Tanpa topi"}</p>
                    {o.lintas_n > 0 && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs" data-testid="beban-lintas">
                        <ArrowsLeftRightIcon size={14} aria-hidden /> {formatPoin(Number(o.lintas_poin))} lintas topi
                      </p>
                    )}
                  </div>
                  <p className="angka text-sm lg:text-right" data-testid="beban-poin">
                    {formatPoin(o.poin)}<span className="lg:hidden"> · {o.jam} jam · {angka(perJam)} per jam</span>
                    {Number(o.antre) > 0 && <span className="block text-xs text-tinta-2">{formatPoin(Number(o.antre))} antre</span>}
                  </p>
                  <p className="angka hidden text-right text-sm lg:block">{o.jam} jam</p>
                  <p className="angka hidden text-right text-sm lg:block" data-testid="beban-per-jam">{angka(perJam)}</p>
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
                {kosong.length} orang belum memikul kerja minggu ini
              </summary>
              <p className="mt-2 text-tinta-2">{kosong.map((o) => o.nama).join(", ")}.</p>
            </details>
          )}
        </>
      )}
    </section>
  );
}

/** Layar staf: bebannya sendiri dibanding rata-rata tim, tanpa nama rekan. */
export function BebanSayaIni({ data }: { data: BebanSaya }) {
  return (
    <section aria-label="Beban kamu minggu ini" className="mt-4 rounded-[var(--radius-isian)] border border-garis p-3" data-testid="beban-saya">
      <p className="text-sm font-semibold" data-testid="beban-saya-teks">{teksBebanSaya({ ...data, poin: data.poin === null ? null : Number(data.poin), rata_rata: data.rata_rata === null ? null : Number(data.rata_rata) })}</p>
      {data.di_atas && <p className="mt-1 text-sm" data-testid="beban-saya-atas">Bebanmu di atas rata-rata. Pemilik sudah melihat angka yang sama.</p>}
    </section>
  );
}
