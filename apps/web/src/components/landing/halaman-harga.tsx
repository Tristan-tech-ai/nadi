import Link from "next/link";
import { Bagian, HalamanInfo } from "@/components/landing/halaman-info";
import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { DISKON_TAHUNAN_BULAN, PAKET, hargaBulanan } from "@/lib/paket";

const CONTOH_ORANG = [5, 10, 20, 40];
const tautan = "font-semibold text-tinta underline underline-offset-4";

/** Halaman harga dua bahasa (D-15, I-03): /harga dan /en/harga. */
export function HalamanHarga({ bahasa }: { bahasa: Bahasa }) {
  const kamus = ambilKamus(bahasa);
  const k = kamus.harga;
  const b = kamus.beranda;
  return (
    <HalamanInfo bahasa={bahasa} judul={k.judul} pengantar={k.pengantar}>
      <p className="max-w-2xl text-tinta-2">
        <span className="stabilo">{b.hargaSorot}</span> {b.hargaRencana} {isiTeks(b.hargaTahunan, { n: DISKON_TAHUNAN_BULAN })}
      </p>

      <ul className="mt-10 border-y border-garis">
        {PAKET.map((p) => {
          const t = kamus.paket[p.kode];
          const [awal, akhir] = b.laluPerOrang.split("{harga}");
          return (
            <li key={p.kode} className="grid gap-x-8 gap-y-2 border-b border-garis py-6 last:border-b-0 md:grid-cols-[9rem_13rem_1fr]">
              <h2 className="text-lg font-bold">{t.nama}</h2>
              <div>
                <p className="text-2xl font-semibold">
                  {p.mulaiDari && <span className="mr-1 text-sm font-normal text-tinta-2">{b.mulaiHarga}</span>}
                  <Rupiah nilai={p.harga} bahasa={bahasa} />
                </p>
                <p className="mt-1 text-sm text-tinta-2">
                  {isiTeks(b.sampaiOrang, { n: p.orang })}
                  {p.perOrangTambahan !== null && <>{awal}<Rupiah nilai={p.perOrangTambahan} bahasa={bahasa} />{akhir}</>}
                </p>
              </div>
              <ul className="space-y-1 text-tinta-2">
                {t.isi.map((i) => <li key={i}>{i}</li>)}
                {p.berkasPerBulan !== null && <li>{isiTeks(k.berkasDibaca, { n: formatAngka(p.berkasPerBulan, bahasa) })}</li>}
              </ul>
            </li>
          );
        })}
      </ul>

      <Bagian judul={k.contohJudul}>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={k.contohLabel}>
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">{k.contohKeterangan}</caption>
            <thead>
              <tr className="border-b border-garis text-tinta">
                <th scope="col" className="py-2 pr-4 font-semibold">{k.jumlahOrang}</th>
                {PAKET.map((p) => <th key={p.kode} scope="col" className="py-2 pr-4 text-right font-semibold">{kamus.paket[p.kode].nama}</th>)}
              </tr>
            </thead>
            <tbody>
              {CONTOH_ORANG.map((n) => (
                <tr key={n} className="border-b border-garis">
                  <th scope="row" className="angka py-2 pr-4 font-normal">{isiTeks(k.nOrang, { n })}</th>
                  {PAKET.map((p) => {
                    const h = hargaBulanan(p, n);
                    return (
                      <td key={p.kode} className="py-2 pr-4 text-right">
                        {h === null ? <span className="text-tinta-2">{k.lewatBatas}</span> : <Rupiah nilai={h} bahasa={bahasa} />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bagian>

      <Bagian judul={k.orangJudul}><p>{k.orangIsi}</p></Bagian>
      <Bagian judul={k.kuotaJudul}><p>{k.kuotaIsi}</p></Bagian>
      <Bagian judul={k.mulaiJudul}>
        <p>
          {k.mulaiAwal} <Link href="/demo" className={tautan}>{k.mulaiContoh}</Link> {k.mulaiTengah}{" "}
          <Link href="/daftar" className={tautan}>{k.mulaiAkun}</Link> {k.mulaiAkhir}
        </p>
      </Bagian>
    </HalamanInfo>
  );
}
