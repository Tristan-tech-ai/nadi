import type { Metadata } from "next";
import { Suspense } from "react";
import { randomUUID } from "node:crypto";
import { FormIdentitas, FormPembeli, FormPotong } from "@/components/app/faktur-pajak";
import { Rupiah } from "@/components/ui/rupiah";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { formatTanggalKalender } from "@/lib/format";
import { hariIni } from "@/lib/izin";
import { hitungBaris, siapFaktur, type Identitas, type InvoicePajak, type Pembeli } from "@/lib/pajak/efaktur";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

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
  const [{ data }, { data: kal }, { data: rekap }, { data: bp }, { data: tagihan }, { data: kode }] = await Promise.all([
    supabase.rpc("data_faktur_keluaran", { p_bulan: `${bulan}-01` }),
    supabase.rpc("kalender_pajak", { p_bulan: `${bulan}-01` }),
    supabase.rpc("rekap_jurnal_penjualan", { p_bulan: `${bulan}-01` }),
    supabase.rpc("data_bupot", { p_bulan: `${bulan}-01` }),
    supabase.from("tagihan_beli").select("id, pemasok, nomor_pemasok, tanggal, total, terbayar, dikurangi").eq("status", "terbuka").order("tanggal", { ascending: false }).order("id", { ascending: false }).limit(10),
    supabase.from("kode_objek_pajak").select("kode, nama, tarif").order("kode"),
  ]);
  const kalender = kal as { pph_potong: number; jatuh_tempo: { jenis: string; tanggal: string; asli: string; dasar: string }[] } | null;
  const jurnal = rekap as { invoice: number; total_invoice: number; kredit_penjualan: number } | null;
  const potong = ((bp as { potong?: { pemasok: string; kode: string; dpp: number; pph: number; tanggal_potong: string }[] } | null)?.potong ?? []);
  const tagihanBuka = (tagihan ?? []) as { id: string; pemasok: string; nomor_pemasok: string | null; tanggal: string; total: number; terbayar: number; dikurangi: number }[];
  const d = (data ?? { identitas: null, faktur: [] }) as { identitas: Identitas | null; faktur: InvoicePajak[] };
  const { siap, kurang } = siapFaktur(d.faktur);
  // terbaru dulu, paling banyak 20 formulir sekali tampil
  const semuaKurang = [...new Set([...kurang].reverse().map((f) => f.pelanggan))];
  const pelangganKurang = semuaKurang.slice(0, 20);
  const pembeliAda = new Map<string, Pembeli>(siap.map((f) => [f.pelanggan, f.pembeli]));
  const ppn = d.identitas ? siap.reduce((s, f) => s + f.baris.reduce((a, b) => a + hitungBaris(b, d.identitas!).ppn, 0), 0) : 0;
  // Rekap PPN keluaran semua invoice bulan ini (tanpa memandang data pembeli) terhadap kredit 4-100 jurnal terbitnya.
  const rekapFaktur = d.identitas ? d.faktur.reduce((s, f) => {
    for (const b of f.baris) { const h = hitungBaris(b, d.identitas!); s.dpp += h.dpp; s.ppn += h.ppn; }
    return s;
  }, { dpp: 0, ppn: 0 }) : null;
  const selisih = rekapFaktur && jurnal ? Math.round(rekapFaktur.dpp + rekapFaktur.ppn - jurnal.kredit_penjualan) : 0;
  const tol = d.faktur.reduce((n, f) => n + f.baris.length, 0);
  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/pajak/faktur" judul={t.judul} ket={t.ket} />
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
      {kalender && (
        <section className="mt-8" aria-labelledby="judul-kalender" data-testid="kalender-pajak">
          <h2 id="judul-kalender" className="text-lg font-semibold">{t.kalenderJudul}</h2>
          <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">
            {kalender.jatuh_tempo.map((j) => (
              <li key={j.jenis} className="flex flex-wrap justify-between gap-2 py-2">
                <span><span className="font-semibold">{t.jatuhNama[j.jenis as keyof typeof t.jatuhNama]}</span>{" "}
                  {j.jenis === "setor_pph" ? <>(<Rupiah nilai={kalender.pph_potong} />)</> : j.jenis === "setor_ppn" && rekapFaktur ? <>(<Rupiah nilai={Math.round(rekapFaktur.ppn)} />)</> : null}</span>
                <span className="angka" data-tanggal={j.tanggal}>{formatTanggalKalender(j.tanggal, bahasa)}{j.tanggal !== j.asli ? ` ${t.digeser}` : ""}</span>
                <span className="w-full text-xs text-tinta-2">{j.dasar}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rekapFaktur && jurnal && (
        <section className="mt-8" aria-labelledby="judul-rekap" data-testid="rekap-ppn">
          <h2 id="judul-rekap" className="text-lg font-semibold">{t.rekapJudul}</h2>
          <p className="mt-1 text-sm">{t.rekapDpp} <Rupiah nilai={Math.round(rekapFaktur.dpp)} />. {t.rekapPpn} <Rupiah nilai={Math.round(rekapFaktur.ppn)} />. {t.rekapJurnal} <Rupiah nilai={jurnal.kredit_penjualan} />.</p>
          <p className="mt-1 text-sm font-semibold" data-cocok={Math.abs(selisih) <= tol ? "ya" : "tidak"}>
            {Math.abs(selisih) <= tol ? t.rekapCocok : isiTeks(t.rekapSelisih, { rp: new Intl.NumberFormat("id-ID").format(selisih) })}</p>
        </section>
      )}
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
      <section className="mt-8" aria-labelledby="judul-bupot" data-testid="bupot">
        <h2 id="judul-bupot" className="text-lg font-semibold">{t.bupotJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.bupotKet}</p>
        <datalist id="kode-objek-pajak">
          {((kode ?? []) as { kode: string; nama: string; tarif: number }[]).map((x) => <option key={x.kode} value={x.kode}>{`${x.nama.slice(0, 80)} (${x.tarif}%)`}</option>)}
        </datalist>
        {tagihanBuka.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.tanpaTagihan}</p> : tagihanBuka.map((x) => (
          <div key={x.id} className="mt-4"><p className="font-semibold"><span data-pengguna>{x.pemasok}</span> <span className="font-normal text-tinta-2"><Rupiah nilai={x.total - x.terbayar - x.dikurangi} /></span></p>
            <FormPotong tagihan={x.id} pemasok={x.pemasok} nomor={x.nomor_pemasok ?? ""} tanggal={x.tanggal} total={x.total} kunci={randomUUID()} teks={t} /></div>
        ))}
        {potong.length > 0 && (
          <>
            <ul className="mt-4 divide-y divide-garis border-y border-garis text-sm">
              {potong.map((x, i) => <li key={i} className="flex justify-between gap-3 py-2"><span><span className="font-mono">{x.kode}</span> <span data-pengguna>{x.pemasok}</span></span><Rupiah nilai={x.pph} /></li>)}
            </ul>
            {d.identitas && <a href={`/app/pajak/faktur/bupot?bulan=${bulan}`} download data-testid="unduh-bupot"
              className="mt-3 inline-flex h-12 items-center rounded-[var(--radius-isian)] border-2 border-tinta px-5 font-semibold">{t.unduhBupot}</a>}
          </>
        )}
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
