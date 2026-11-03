import Link from "next/link";
import { DemoNota } from "@/components/landing/demo-nota";
import { KakiSitus, KepalaSitus } from "@/components/landing/kepala-kaki";
import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { DISKON_TAHUNAN_BULAN, PAKET } from "@/lib/paket";

// Landing D-11 (docs/design/iterasi/landing), dua bahasa (I-02): pahlawan = kartu nota hidup, tur fitur = buku kas satu hari,
// harga = tabel buku kas. Statis, satu gerak bermakna (nota tercetak), satu tombol utama per layar.
const judul2 = "font-judul text-3xl font-extrabold tracking-tight sm:text-4xl";
const tombolUtama = "inline-flex h-12 items-center rounded-[var(--radius-isian)] bg-tinta px-6 font-semibold text-kertas transition-[background-color,transform] duration-150 hover:bg-tinta/90 active:translate-y-px";

export function Beranda({ bahasa }: { bahasa: Bahasa }) {
  const kamus = ambilKamus(bahasa);
  const k = kamus.beranda;
  const isi = kamus.isi;
  return (
    <div lang={bahasa} className="contents">
      <KepalaSitus bahasa={bahasa} />

      <main className="mx-auto w-full max-w-6xl px-5">
        <section className="grid items-start gap-x-16 gap-y-8 pt-10 pb-20 lg:grid-cols-[3fr_2fr] lg:pt-20" aria-labelledby="judul-utama">
          <h1 id="judul-utama" className="font-judul text-[1.9rem] font-extrabold leading-[1.08] tracking-tight sm:text-6xl lg:col-start-1 lg:row-start-1">
            {k.judulAwal} <span className="stabilo">{k.judulSorot}</span>
          </h1>
          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <DemoNota teks={kamus.demo} bahasa={bahasa} />
          </div>
          <div className="max-w-xl lg:col-start-1 lg:row-start-2">
            <p className="text-lg text-tinta-2">{k.pengantar}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/daftar" className={tombolUtama}>{k.mulai}</Link>
              <Link href="/demo" className="text-sm font-semibold underline underline-offset-4">{k.bukaContoh}</Link>
            </div>
          </div>
        </section>

        <section id="hari" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-hari">
          <h2 id="judul-hari" className={judul2}>{k.hariJudul}</h2>
          <p className="mt-3 max-w-2xl text-tinta-2">{k.hariPengantar}</p>
          <ol className="mt-10 border-y border-garis">
            {isi.hari.map((h) => (
              <li key={h.jam} className="grid gap-x-6 gap-y-1 border-b border-garis py-5 last:border-b-0 md:grid-cols-[6.5rem_6rem_1fr_1.5fr]">
                <p className="angka font-mono text-sm font-medium text-tinta md:border-r md:border-cap/40 md:pr-4">{h.jam}</p>
                <p className="text-xs font-bold uppercase tracking-wide text-tinta-2 md:pt-0.5">{h.peran}</p>
                <p className="font-semibold">{h.kejadian}</p>
                <p className="text-tinta-2">{h.nadi}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="peran" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-peran">
          <h2 id="judul-peran" className={judul2}>{k.peranJudul}</h2>
          <p className="mt-3 max-w-2xl text-tinta-2">
            {k.peranPengantarAwal} <Link href="/panduan" className="font-semibold text-tinta underline underline-offset-4">{k.peranPengantarTautan}</Link>.
          </p>
          <div className="mt-10 grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {isi.peran.map((p) => (
              <div key={p.peran} className="border-t-2 border-tinta pt-4">
                <h3 className="text-lg font-bold">{p.peran}</h3>
                <p className="mt-1 text-sm text-tinta-2">{p.ringkas}</p>
                <ul className="mt-4 divide-y divide-garis text-sm">
                  {p.fitur.map((f) => <li key={f} className="py-2">{f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-garis py-16" aria-labelledby="judul-bukti">
          <h2 id="judul-bukti" className={judul2}>{k.buktiJudul}</h2>
          <p className="mt-3 max-w-2xl text-tinta-2">{k.buktiPengantar}</p>
          <dl className="mt-10 grid gap-x-8 gap-y-6 border-y border-garis py-6 sm:grid-cols-2 lg:grid-cols-4">
            {isi.bukti.map((b) => (
              <div key={b.angka}>
                <dt className="angka font-mono text-3xl font-medium">{b.angka}</dt>
                <dd className="mt-1 text-sm text-tinta-2">{b.isi}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="harga" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-harga">
          <h2 id="judul-harga" className={judul2}>{k.hargaJudul}</h2>
          <p className="mt-3 max-w-2xl text-tinta-2">
            <span className="stabilo">{k.hargaSorot}</span> {k.hargaRencana} {isiTeks(k.hargaTahunan, { n: DISKON_TAHUNAN_BULAN })}
          </p>
          <ul className="mt-10 border-y border-garis">
            {PAKET.map((p) => {
              const t = kamus.paket[p.kode];
              return (
                <li key={p.kode} className="grid gap-x-8 gap-y-2 border-b border-garis py-6 last:border-b-0 md:grid-cols-[9rem_13rem_1fr]">
                  <h3 className="text-lg font-bold">{t.nama}</h3>
                  <div>
                    <p className="text-2xl font-semibold">
                      {p.mulaiDari && <span className="mr-1 text-sm font-normal text-tinta-2">{k.mulaiHarga}</span>}
                      <Rupiah nilai={p.harga} bahasa={bahasa} />
                    </p>
                    <p className="mt-1 text-sm text-tinta-2">
                      {isiTeks(k.sampaiOrang, { n: p.orang })}
                      {p.perOrangTambahan !== null && (() => {
                        const [awal, akhir] = k.laluPerOrang.split("{harga}");
                        return <>{awal}<Rupiah nilai={p.perOrangTambahan} bahasa={bahasa} />{akhir}</>;
                      })()}
                    </p>
                  </div>
                  <p className="text-tinta-2">
                    {t.isi.join(" · ")}
                    {p.berkasPerBulan !== null && ` · ${isiTeks(k.berkasPerBulan, { n: formatAngka(p.berkasPerBulan, bahasa) })}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="keamanan" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-keamanan">
          <h2 id="judul-keamanan" className={judul2}>{k.keamananJudul}</h2>
          <ul className="mt-8 grid gap-x-8 gap-y-5 text-tinta-2 md:grid-cols-2">
            {k.keamanan.map((x) => (
              <li key={x.judul}><span className="font-semibold text-tinta">{x.judul}</span> {x.isi}</li>
            ))}
          </ul>
        </section>

        <section id="faq" className="scroll-mt-6 border-t border-garis py-16" aria-labelledby="judul-faq">
          <h2 id="judul-faq" className={judul2}>{k.faqJudul}</h2>
          <div className="mt-8 max-w-3xl divide-y divide-garis border-y border-garis">
            {isi.faq.map((f) => (
              <details key={f.tanya} className="group py-4">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 inline-block font-mono text-tinta-2 transition-transform duration-150 group-open:rotate-90" aria-hidden>›</span>
                  {f.tanya}
                </summary>
                <p className="mt-3 pl-5 text-tinta-2">{f.jawab}</p>
              </details>
            ))}
          </div>
          <div className="mt-12">
            <h3 className="text-sm font-bold uppercase tracking-wide text-tinta-2">{k.sedangDibuat}</h3>
            <ul className="mt-2 space-y-1 text-tinta-2">
              {isi.sedangDibuat.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </div>
        </section>

        <section className="border-t border-garis py-20" aria-labelledby="judul-mulai">
          <h2 id="judul-mulai" className="font-judul text-4xl font-extrabold tracking-tight">{k.akhirJudul}</h2>
          <p className="mt-3 max-w-xl text-tinta-2">{k.akhirIsi}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/daftar" className={tombolUtama}>{k.akhirBuat}</Link>
            <Link href="/demo" className="text-sm font-semibold underline underline-offset-4">{k.akhirContoh}</Link>
          </div>
        </section>
      </main>

      <KakiSitus bahasa={bahasa} />
    </div>
  );
}
