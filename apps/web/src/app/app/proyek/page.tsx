import type { Metadata } from "next";
import { Suspense } from "react";
import { FormJam, FormProyekBaru, FormRab, TombolTandai } from "@/components/app/proyek";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { ProyekOperasional } from "@/app/app/proyek/ops";

export const metadata: Metadata = { title: "Proyek" };

type Laporan = { baris: { kode: string; nama: string; golongan: string; anggaran: number; realisasi: number; selisih: number }[];
  jam: { orang: string; nama: string; jam: number; biaya: number | null }[]; beban_anggaran: number; beban_realisasi: number; pendapatan_anggaran: number;
  pendapatan_realisasi: number; total_jam: number };

async function Isi({ searchParams }: { searchParams: PageProps<"/app/proyek">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).proyek;
  const sp = await searchParams;
  const supabase = await createClient();
  const pengelola = ["pemilik", "admin", "akuntan"].includes(sesi.peran);
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const hari = hariIni(new Date(), zona);
  const { data: pr } = await supabase.rpc("active_projects");
  const proyek = (pr ?? []) as { id: string; nama: string }[];
  const dipilih = proyek.find((p) => p.id === sp.p) ?? proyek[0];
  const rp = (n: number) => formatRupiah(n, { bahasa });
  const angka = new Intl.NumberFormat(bahasa === "en" ? "en-GB" : "id-ID", { maximumFractionDigits: 2 });
  const judul = <KepalaHalaman jalur="/app/proyek" judul={t.judul} ket={pengelola ? t.ket : t.hanyaJam} />;

  if (!pengelola) {
    const { data: jamSaya } = await supabase.from("project_time").select("id, tanggal, jam, catatan, dimension_id").order("tanggal", { ascending: false }).limit(30);
    return (
      <div lang={bahasa}>{judul}
        {proyek.length === 0 ? <p data-langkah='#baru' className="mt-6 text-sm text-tinta-2">{t.kosong}</p> : <FormJam proyek={proyek} orang={null} hariIni={hari} teks={t} />}
        <h2 className="mt-8 text-lg font-semibold">{t.jamSaya}</h2>
        {(jamSaya ?? []).length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.jamKosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">{(jamSaya ?? []).map((j) => (
            <li key={j.id} className="flex justify-between gap-2 py-2"><span data-pengguna>{proyek.find((p) => p.id === j.dimension_id)?.nama}{j.catatan ? `, ${j.catatan}` : ""}</span>
              <span className="angka text-tinta-2">{formatTanggalKalender(j.tanggal, bahasa)}, {angka.format(Number(j.jam))}</span></li>))}</ul>
        )}
      </div>
    );
  }

  const [lap, ak, org, jur, tag] = await Promise.all([
    dipilih ? supabase.rpc("project_report", { p_dimension: dipilih.id }) : Promise.resolve({ data: null }),
    supabase.from("akun").select("kode, nama, golongan").in("golongan", ["beban", "pendapatan"]).eq("aktif", true).order("kode"),
    sesi.peran !== "akuntan" ? supabase.from("orang").select("id, nama").eq("status", "aktif").overlaps("jenis", ["karyawan", "magang"]).order("nama").limit(300) : Promise.resolve({ data: null }),
    supabase.from("jurnal").select("id, tanggal, keterangan").gte("tanggal", new Date(Date.parse(`${hari}T00:00:00Z`) - 60 * 86400000).toISOString().slice(0, 10))
      .neq("sumber", "tutup_buku").order("tanggal", { ascending: false }).limit(60),
    supabase.from("journal_tag").select("jurnal_id").eq("jenis", "proyek").limit(5000),
  ]);
  const laporan = lap.data as Laporan | null;
  const bertanda = new Set((tag.data ?? []).map((x) => x.jurnal_id as string));
  const belum = (jur.data ?? []).filter((j) => !bertanda.has(j.id as string)).slice(0, 15);
  const sel = "border-b border-garis py-2 pr-3";

  return (
    <div lang={bahasa}>{judul}
      <section className="mt-6" aria-labelledby="baru"><h2 id="baru" className="sr-only">{t.proyekBaru}</h2><FormProyekBaru teks={t} /></section>
      {sesi.peran !== "akuntan" && <ProyekOperasional />}
      {proyek.length === 0 ? <p data-langkah='#baru' className="mt-6 text-sm text-tinta-2">{t.kosong}</p> : (<>
        <nav className="mt-6 flex flex-wrap gap-2 text-sm" aria-label={t.pilih}>
          {proyek.map((p) => <a key={p.id} href={`/app/proyek?p=${p.id}`} aria-current={p.id === dipilih?.id ? "page" : undefined}
            className={`rounded-full border px-3 py-1 ${p.id === dipilih?.id ? "border-tinta bg-tinta text-kertas" : "border-garis-kuat"}`} data-pengguna>{p.nama}</a>)}
        </nav>
        {dipilih && laporan && (
          <section className="mt-6" aria-labelledby="lap" data-testid="laporan-proyek">
            <h2 id="lap" className="text-lg font-semibold">{t.laporanJudul}: <span data-pengguna>{dipilih.nama}</span></h2>
            <p className="mt-1" data-testid="ringkas-biaya">{isiTeks(t.bebanTotal, { real: rp(laporan.beban_realisasi), ang: rp(laporan.beban_anggaran) })}</p>
            <p>{isiTeks(t.pendapatanTotal, { real: rp(laporan.pendapatan_realisasi), ang: rp(laporan.pendapatan_anggaran) })}</p>
            {laporan.baris.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.tanpaBaris}</p> : (
              <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={t.laporanJudul}>
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="text-tinta-2"><tr><th className={sel}>{t.kolAkun}</th><th className={`${sel} text-right`}>{t.kolAnggaran}</th><th className={`${sel} text-right`}>{t.kolRealisasi}</th><th className={`${sel} text-right`}>{t.kolSelisih}</th></tr></thead>
                  <tbody>{laporan.baris.map((b) => (
                    <tr key={b.kode}><td className={sel}>{b.kode} {b.nama}</td><td className={`${sel} angka text-right`}>{rp(b.anggaran)}</td><td className={`${sel} angka text-right`}>{rp(b.realisasi)}</td>
                      <td className={`${sel} angka text-right ${b.golongan === "beban" && b.selisih < 0 ? "font-semibold text-cap" : ""}`}>{rp(b.selisih)}</td></tr>))}</tbody>
                </table>
              </div>
            )}
            <h3 className="mt-6 font-semibold">{t.rabJudul}</h3>
            <FormRab proyek={dipilih.id} akun={(ak.data ?? []) as { kode: string; nama: string }[]} teks={t} />
            <h3 className="mt-6 font-semibold">{t.tandaiJudul}</h3>
            {belum.length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.tandaiKosong}</p> : (
              <ul className="mt-1 divide-y divide-garis border-y border-garis text-sm" data-testid="jurnal-belum">{belum.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                  <span><span className="angka text-tinta-2">{formatTanggalKalender(j.tanggal as string, bahasa)}</span> <span data-pengguna>{j.keterangan}</span></span>
                  <TombolTandai jurnal={j.id as string} proyek={dipilih.id} namaProyek={dipilih.nama} label={String(j.keterangan ?? j.id)} teks={t} />
                </li>))}</ul>
            )}
            <h3 className="mt-6 font-semibold">{t.jamJudul}</h3>
            {laporan.jam.length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.jamKosong}</p> : (<>
              <ul className="mt-1 grid gap-1 text-sm" data-testid="jam-proyek">{laporan.jam.map((j) => (
                <li key={j.orang} data-pengguna>{isiTeks(t.jamBaris, { nama: j.nama, jam: angka.format(j.jam) })}{j.biaya !== null ? isiTeks(t.biaya, { rp: rp(j.biaya) }) : ""}</li>))}</ul>
              <p className="mt-1 text-sm">{isiTeks(t.totalJam, { jam: angka.format(laporan.total_jam) })}</p>
            </>)}
            <p className="mt-1 text-xs text-tinta-2">{t.jamKet}</p>
          </section>
        )}
        <FormJam proyek={proyek} orang={(org.data ?? null) as { id: string; nama: string }[] | null} hariIni={hari} teks={t} />
      </>)}
    </div>
  );
}

export default function HalamanProyek(props: PageProps<"/app/proyek">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
