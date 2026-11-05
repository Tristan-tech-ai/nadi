import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormAktivitas, FormDeal, FormPelanggan, FormPenawaran, FormPindah, FormTarget, TombolSelesai } from "@/components/app/crm";
import { aktif, nilaiTerbuka, TAHAP_AKTIF } from "@/lib/crm";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Pelanggan dan deal" };

type T = Kamus["crm"];
type Tahap = keyof T["tahap"];
type Deal = {
  id: string; judul: string; nilai: number; tahap: Tahap; perkiraan_tutup: string | null; alasan_kalah: string | null; ditutup_at: string | null;
  customer: { nama: string } | null; orang: { nama: string } | null; dokumen_jual: { nomor: string; status: string } | null;
};
type Aktivitas = { id: string; deal_id: string; jenis: "catatan" | "tugas" | "kunjungan"; isi: string; jatuh_tempo: string | null; selesai: boolean; lokasi: unknown; dibuat_at: string };
type Laporan = {
  corong: Record<Tahap, { jumlah: number; nilai: number }>; menang: number; kalah: number; tingkat_menang: number | null;
  sales: { orang: string; nama: string; menang_nilai: number; terbuka_nilai: number; target: number; kunjungan: number }[];
};
type Segmen = { nama: string; invoice: number; nilai: number; segmen: ("besar" | "setia" | "baru" | "tidur")[]; segmen_isian: string | null };
const judul = "text-lg font-semibold";

function KartuDeal({ d, akt, t, b, hari, kelola }: { d: Deal; akt: Aktivitas[]; t: T; b: Bahasa; hari: string; kelola: boolean }) {
  return (
    <li className="py-4" data-judul={d.judul} data-tahap={d.tahap}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold" data-pengguna>{d.judul}</p>
          <p className="text-sm text-tinta-2"><span data-pengguna>{d.customer?.nama}</span>, {d.orang ? <span data-pengguna>{d.orang.nama}</span> : t.tanpaSales}
            {d.perkiraan_tutup ? `, ${isiTeks(t.tutupPada, { tanggal: formatTanggalKalender(d.perkiraan_tutup, b) })}` : ""}</p>
          {d.dokumen_jual && <p className="text-sm" data-testid="penawaran-deal"><span className="angka">{isiTeks(t.penawaran, { nomor: d.dokumen_jual.nomor })}</span> <Link href="/app/jual" className="text-laut underline underline-offset-2">{t.lihatJual}</Link></p>}
        </div>
        <span className="flex items-center gap-2"><Cap jenis={d.tahap === "menang" ? "diterima" : d.tahap === "kalah" ? "ditolak" : "menunggu"} label={t.tahap[d.tahap]} /><Rupiah nilai={d.nilai} className="font-semibold" bahasa={b} /></span>
      </div>
      {akt.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm" data-testid="aktivitas-deal">
          {akt.slice(0, 4).map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-tinta-2">{t.jenisNama[a.jenis]}{a.lokasi ? ` (${t.berlokasi})` : ""}:</span><span data-pengguna>{a.isi}</span>
              {a.jenis === "tugas" && (a.selesai ? <span className="text-daun">{t.selesai}</span> : <>
                {a.jatuh_tempo && <span className="text-tinta-2">{formatTanggalKalender(a.jatuh_tempo, b)}</span>}
                <TombolSelesai id={a.id} label={`${t.tandaiSelesai}: ${a.isi}`} teks={t.tandaiSelesai} />
              </>)}
            </li>
          ))}
        </ul>
      )}
      {aktif(d.tahap) && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer font-semibold text-laut">{t.aktivitas}</summary>
          <FormAktivitas deal={d.id} judul={d.judul} hari={hari} teks={t} />
          {kelola && !d.dokumen_jual && <FormPenawaran deal={d.id} judul={d.judul} hari={hari} kunci={randomUUID()} teks={t} />}
          {kelola && <FormPindah deal={d.id} tahap={d.tahap} judul={d.judul} teks={t} />}
        </details>
      )}
      {d.tahap === "kalah" && d.alasan_kalah && <p className="mt-1 text-sm text-tinta-2" data-pengguna>{d.alasan_kalah}</p>}
    </li>
  );
}

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).crm;
  const kelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const awal = `${hari.slice(0, 7)}-01`;
  const supabase = await createClient();
  const [dl, ak, cs, or, lap, seg] = await Promise.all([
    supabase.from("deal").select("id, judul, nilai, tahap, perkiraan_tutup, alasan_kalah, ditutup_at, customer(nama), orang(nama), dokumen_jual(nomor, status)").order("diubah_at", { ascending: false }).limit(200),
    supabase.from("deal_activity").select("id, deal_id, jenis, isi, jatuh_tempo, selesai, lokasi, dibuat_at").order("dibuat_at", { ascending: false }).limit(400),
    supabase.from("customer").select("id, nama, jenis").eq("aktif", true).order("nama"),
    kelola ? supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama") : Promise.resolve({ data: [] }),
    kelola ? supabase.rpc("sales_report", { p_dari: awal, p_sampai: hari }) : Promise.resolve({ data: null }),
    kelola ? supabase.rpc("customer_segments") : Promise.resolve({ data: [] }),
  ]);
  const deal = (dl.data ?? []) as unknown as Deal[];
  if (!kelola && sesi.peran !== "akuntan" && deal.length === 0) {
    return <div lang={bahasa}><h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1><p className="mt-2 text-tinta-2">{t.hanya}</p></div>;
  }
  const akt = (ak.data ?? []) as Aktivitas[];
  const pelanggan = (cs.data ?? []) as { id: string; nama: string; jenis: string }[];
  const orang = (or.data ?? []) as { id: string; nama: string }[];
  const L = lap.data as Laporan | null;
  const S = (seg.data ?? []) as Segmen[];
  const terbuka = deal.filter((d) => aktif(d.tahap));
  const tutup = deal.filter((d) => !aktif(d.tahap)).slice(0, 10);
  const aktDeal = (id: string) => akt.filter((a) => a.deal_id === id);

  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 text-sm text-tinta-2">{kelola ? t.ket : t.ketStaf}</p>

      {L && (
        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" data-testid="ringkas-crm" aria-label={t.corongJudul}>
          {([[t.terbuka, nilaiTerbuka(L.corong), true], [t.menangBulan, L.corong.menang?.nilai ?? 0, true], [t.kalahBulan, L.kalah, false], [t.tingkatMenang, L.tingkat_menang, false]] as [string, number | null, boolean][]).map(([k, v, rp]) => (
            <div key={k} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-3"><dt className="text-tinta-2">{k}</dt><dd className="mt-1 font-semibold">{rp ? <Rupiah nilai={v ?? 0} bahasa={bahasa} /> : k === t.tingkatMenang ? (v === null ? "-" : `${v}%`) : <span className="angka">{v}</span>}</dd></div>
          ))}
        </dl>
      )}

      <section className="mt-8" aria-labelledby="judul-pipeline">
        <h2 id="judul-pipeline" className={judul}>{t.pipelineJudul}</h2>
        {terbuka.length === 0 ? <p className="mt-2 text-sm text-tinta-2" data-testid="pipeline-kosong">{t.pipelineKosong}</p> : (
          TAHAP_AKTIF.filter((x) => terbuka.some((d) => d.tahap === x)).map((x) => (
            <div key={x} className="mt-4" data-testid={`tahap-${x}`}>
              <h3 className="text-sm font-semibold text-tinta-2">{t.tahap[x]} <span className="angka">({terbuka.filter((d) => d.tahap === x).length})</span></h3>
              <ul className="divide-y divide-garis border-y border-garis">
                {terbuka.filter((d) => d.tahap === x).map((d) => <KartuDeal key={d.id} d={d} akt={aktDeal(d.id)} t={t} b={bahasa} hari={hari} kelola={kelola} />)}
              </ul>
            </div>
          ))
        )}
      </section>

      {tutup.length > 0 && (
        <section className="mt-8" aria-labelledby="judul-tutup-deal">
          <h2 id="judul-tutup-deal" className={judul}>{t.tutupJudul}</h2>
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="deal-tutup">
            {tutup.map((d) => <KartuDeal key={d.id} d={d} akt={aktDeal(d.id)} t={t} b={bahasa} hari={hari} kelola={kelola} />)}
          </ul>
        </section>
      )}

      {kelola && (
        <>
          <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-deal-baru">
            <h2 id="judul-deal-baru" className={judul}>{t.dealJudul}</h2>
            <FormDeal pelanggan={pelanggan} orang={orang} teks={t} />
          </section>
          <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-pelanggan-baru">
            <h2 id="judul-pelanggan-baru" className={judul}>{t.pelangganJudul}</h2>
            <FormPelanggan perusahaan={pelanggan.filter((p) => p.jenis === "perusahaan")} teks={t} />
          </section>
          <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-laporan-sales">
            <h2 id="judul-laporan-sales" className={judul}>{t.laporanJudul}</h2>
            {!L || L.sales.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.laporanKosong}</p> : (
              <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={t.laporanJudul}>
                <table className="w-full border-y border-garis text-sm" data-testid="laporan-sales">
                  <thead><tr className="border-b border-garis text-left text-tinta-2"><th scope="col" className="py-2 pr-3 font-medium">{t.sales}</th><th scope="col" className="py-2 pl-2 text-right font-medium">{t.menangNilai}</th><th scope="col" className="py-2 pl-2 text-right font-medium">{t.target}</th><th scope="col" className="py-2 pl-2 text-right font-medium">{t.terbukaNilai}</th><th scope="col" className="py-2 pl-2 text-right font-medium">{t.kunjungan}</th></tr></thead>
                  <tbody className="divide-y divide-garis">
                    {L.sales.map((s) => (
                      <tr key={s.orang} data-nama={s.nama}><td className="py-2 pr-3" data-pengguna>{s.nama}</td><td className="py-2 pl-2 text-right"><Rupiah nilai={s.menang_nilai} bahasa={bahasa} /></td>
                        <td className="py-2 pl-2 text-right"><Rupiah nilai={s.target} bahasa={bahasa} /></td><td className="py-2 pl-2 text-right"><Rupiah nilai={s.terbuka_nilai} bahasa={bahasa} /></td><td className="angka py-2 pl-2 text-right">{s.kunjungan}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {orang.length > 0 && <><h3 className="mt-6 font-semibold">{t.targetJudul}</h3><FormTarget orang={orang} bulan={awal} teks={t} /></>}
          </section>
          <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-segmen">
            <h2 id="judul-segmen" className={judul}>{t.segmenJudul}</h2>
            <p className="mt-1 text-sm text-tinta-2">{t.segmenKet}</p>
            {S.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.segmenKosong}</p> : (
              <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="segmen">
                {S.slice(0, 30).map((s) => (
                  <li key={s.nama} className="flex flex-wrap items-center justify-between gap-2 py-2" data-nama={s.nama}>
                    <span><span className="font-semibold" data-pengguna>{s.nama}</span> <span className="text-tinta-2">{isiTeks(t.invoice, { n: s.invoice })}{s.segmen_isian ? `, ${s.segmen_isian}` : ""}</span></span>
                    <span className="flex flex-wrap items-center gap-2">{s.segmen.map((x) => <span key={x} className="rounded-full border border-garis-kuat px-2 py-0.5 text-xs">{t.segmenNama[x]}</span>)}<Rupiah nilai={s.nilai} bahasa={bahasa} /></span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function HalamanPelanggan() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi />
      </Suspense>
    </main>
  );
}
