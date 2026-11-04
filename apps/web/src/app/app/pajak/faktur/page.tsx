import type { Metadata } from "next";
import { Suspense } from "react";
import { FormIdentitas, FormPembeli } from "@/components/app/faktur-pajak";
import { Rupiah } from "@/components/ui/rupiah";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { hitungBaris, siapFaktur, type Identitas, type InvoicePajak, type Pembeli } from "@/lib/pajak/efaktur";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Faktur pajak Coretax" };

// M-09: berkas impor XML Faktur Pajak Keluaran Coretax dari invoice bulan ini. Pemilik, admin, akuntan.
async function Isi({ searchParams }: { searchParams: PageProps<"/app/pajak/faktur">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).faktur;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) return <p className="mt-6">{ambilKamus(bahasa).fakturPesan.hanya}</p>;
  const sp = await searchParams;
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const kini = hariIni(new Date(), zona).slice(0, 7);
  const bulan = typeof sp.bulan === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.bulan) ? sp.bulan : kini;
  const pilihan = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(Date.UTC(Number(kini.slice(0, 4)), Number(kini.slice(5, 7)) - 1 - i, 1));
    return { nilai: d.toISOString().slice(0, 7), label: new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(d) };
  });
  const supabase = await createClient();
  const { data } = await supabase.rpc("data_faktur_keluaran", { p_bulan: `${bulan}-01` });
  const d = (data ?? { identitas: null, faktur: [] }) as { identitas: Identitas | null; faktur: InvoicePajak[] };
  const { siap, kurang } = siapFaktur(d.faktur);
  // terbaru dulu, paling banyak 20 formulir sekali tampil
  const semuaKurang = [...new Set([...kurang].reverse().map((f) => f.pelanggan))];
  const pelangganKurang = semuaKurang.slice(0, 20);
  const pembeliAda = new Map<string, Pembeli>(siap.map((f) => [f.pelanggan, f.pembeli]));
  const ppn = d.identitas ? siap.reduce((s, f) => s + f.baris.reduce((a, b) => a + hitungBaris(b, d.identitas!).ppn, 0), 0) : 0;
  return (
    <div lang={bahasa}>
      <h1 className="text-2xl font-semibold">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      <nav className="mt-4 flex flex-wrap gap-2 text-sm" aria-label={t.bulanAria}>
        {pilihan.map((p) => (
          <a key={p.nilai} href={`/app/pajak/faktur?bulan=${p.nilai}`} aria-current={p.nilai === bulan ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${p.nilai === bulan ? "border-tinta bg-tinta text-kertas" : "border-garis"}`}>{p.label}</a>
        ))}
      </nav>
      <section className="mt-8" aria-labelledby="judul-identitas">
        <h2 id="judul-identitas" className="text-lg font-semibold">{t.identitasJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.identitasKet}</p>
        <FormIdentitas awal={d.identitas ? { npwp: d.identitas.npwp, nitku: d.identitas.nitku, termasuk: d.identitas.harga_termasuk_ppn, kode: d.identitas.kode_transaksi } : null} teks={t} />
      </section>
      <section className="mt-8" aria-labelledby="judul-unduh">
        <h2 id="judul-unduh" className="text-lg font-semibold">{t.unduhJudul}</h2>
        <p className="mt-1 text-sm" data-testid="ringkas-faktur">
          {isiTeks(t.ringkas, { siap: siap.length, kurang: kurang.length })} {d.identitas && siap.length ? <>{t.ppnTotal} <Rupiah nilai={Math.round(ppn)} /></> : null}
        </p>
        {d.identitas && siap.length ? (
          <a href={`/app/pajak/faktur/unduh?bulan=${bulan}`} download data-testid="unduh-faktur"
            className="mt-3 inline-flex h-12 items-center rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas">{t.unduh}</a>
        ) : <p className="mt-3 text-sm text-tinta-2">{d.identitas ? t.lengkapiDulu : t.identitasDulu}</p>}
        <p className="mt-3 text-sm text-tinta-2">{t.caraUnggah}</p>
      </section>
      {pelangganKurang.length > 0 && (
        <section className="mt-8" aria-labelledby="judul-pembeli">
          <h2 id="judul-pembeli" className="text-lg font-semibold">{t.pembeliJudul}</h2>
          <p className="mt-1 text-sm text-tinta-2">{t.pembeliKet}</p>
          {pelangganKurang.map((n) => (
            <div key={n} className="mt-4"><p className="font-semibold" data-pengguna>{n}</p><FormPembeli nama={n} awal={null} teks={t} /></div>
          ))}
          {semuaKurang.length > 20 && <p className="mt-4 text-sm text-tinta-2">{isiTeks(t.sisaPembeli, { n: semuaKurang.length - 20 })}</p>}
        </section>
      )}
      {pembeliAda.size > 0 && (
        <section className="mt-8" aria-labelledby="judul-siap">
          <h2 id="judul-siap" className="text-lg font-semibold">{t.siapJudul}</h2>
          <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">
            {siap.map((f) => (
              <li key={f.nomor} className="flex justify-between gap-3 py-2"><span><span className="font-mono">{f.nomor}</span> <span data-pengguna>{f.pelanggan}</span></span>
                <span className="text-tinta-2">{t.jenisNama[f.pembeli.jenis_id]}</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function HalamanFaktur(props: PageProps<"/app/pajak/faktur">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
