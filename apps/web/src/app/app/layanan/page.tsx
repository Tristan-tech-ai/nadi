import type { Metadata } from "next";
import { Suspense } from "react";
import { FormArtikel, FormAtur, FormBalas, FormTemplat, FormTugaskan, TombolTutup } from "@/components/app/layanan";
import { Cap } from "@/components/ui/cap";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Layanan pelanggan" };

type T = Kamus["layanan"];
type Percakapan = { id: string; pengunjung: string; kontak: string | null; status: keyof T["status"]; agen_id: string | null; tenggat: string; dijawab_at: string | null; csat: number | null; diubah_at: string };
type Pesan = { conversation_id: string; dari: keyof T["dari"]; isi: string; dibuat_at: string };
type Laporan = { tiket: number; tepat_sla: number; menit_balas: number | null; csat: number | null; dinilai: number };
const judul = "text-lg font-semibold";

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).layanan;
  const kelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const hari = hariIni(new Date(), zona);
  const supabase = await createClient();
  const [cv, ms, st, ar, or, lap, tp] = await Promise.all([
    supabase.from("conversation").select("id, pengunjung, kontak, status, agen_id, tenggat, dijawab_at, csat, diubah_at").order("diubah_at", { ascending: false }).limit(50),
    supabase.from("conversation_message").select("conversation_id, dari, isi, dibuat_at").order("dibuat_at").limit(1000),
    kelola ? supabase.from("support_setting").select("kunci, aktif, jam_mulai, jam_selesai, sla_menit, pesan_sambutan, pesan_luar_jam").maybeSingle() : Promise.resolve({ data: null }),
    kelola ? supabase.from("support_article").select("id, judul, isi").eq("aktif", true).order("judul") : Promise.resolve({ data: [] }),
    kelola ? supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama") : Promise.resolve({ data: [] }),
    kelola ? supabase.rpc("service_report", { p_dari: `${hari.slice(0, 7)}-01`, p_sampai: hari }) : Promise.resolve({ data: null }),
    supabase.from("reply_template").select("judul, isi").order("judul"),
  ]);
  const templat = (tp.data ?? []) as { judul: string; isi: string }[];
  const percakapan = (cv.data ?? []) as Percakapan[];
  if (!kelola && percakapan.length === 0) {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/layanan" judul={t.judul} ket={t.hanya} /></div>;
  }
  const pesan = (ms.data ?? []) as Pesan[];
  const atur = st.data as { kunci: string; aktif: boolean; jam_mulai: string; jam_selesai: string; sla_menit: number; pesan_sambutan: string; pesan_luar_jam: string } | null;
  const artikel = (ar.data ?? []) as { id: string; judul: string; isi: string }[];
  const agen = (or.data ?? []) as { id: string; nama: string }[];
  const L = lap.data as Laporan | null;
  const jam = (iso: string) => new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { timeZone: zona, hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(iso)).replace(":", ".");
  const urut = [...percakapan].sort((a, b) => Number(a.status === "selesai") - Number(b.status === "selesai"));
  const sekarang = new Date().getTime();

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/layanan" judul={t.judul} ket={kelola ? t.ket : t.ketStaf} />

      {L && (
        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" data-testid="ringkas-layanan">
          {([[t.ringkasTiket, String(L.tiket)], [t.ringkasSla, `${L.tepat_sla}/${L.tiket}`], [t.ringkasMenit, L.menit_balas === null ? "-" : String(L.menit_balas)], [t.ringkasCsat, L.csat === null ? "-" : `${String(L.csat).replace(".", bahasa === "en" ? "." : ",")}/5`]] as [string, string][]).map(([k, v]) => (
            <div key={k} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-3"><dt className="text-tinta-2">{k}</dt><dd className="angka mt-1 font-semibold">{v}</dd></div>
          ))}
        </dl>
      )}

      <section className="mt-8" aria-labelledby="judul-kotak">
        <h2 id="judul-kotak" className={judul}>{t.kotakJudul}</h2>
        {urut.length === 0 ? <p data-langkah='#judul-atur-layanan' className="mt-2 text-sm text-tinta-2" data-testid="kotak-kosong">{t.kotakKosong}</p> : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis" data-testid="kotak-masuk">
            {urut.map((c) => {
              const lewat = !c.dijawab_at && c.status !== "selesai" && new Date(c.tenggat).getTime() < sekarang;
              return (
                <li key={c.id} className="py-4" data-pengunjung={c.pengunjung} data-status={c.status}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold"><span data-pengguna>{c.pengunjung}</span>{c.kontak && <span className="font-normal text-tinta-2"> <span data-pengguna>{c.kontak}</span></span>}</p>
                    <span className="flex items-center gap-2 text-sm">
                      {c.status !== "selesai" && !c.dijawab_at && <span className={lewat ? "text-cap" : "text-tinta-2"}>{lewat ? t.lewat : isiTeks(t.tenggat, { jam: jam(c.tenggat) })}</span>}
                      <Cap jenis={c.status === "selesai" ? "diterima" : "menunggu"} label={t.status[c.status]} />
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {pesan.filter((p) => p.conversation_id === c.id).slice(-8).map((p, i) => (
                      <li key={i} data-dari={p.dari}><span className="text-tinta-2">{t.dari[p.dari]}:</span> <span className="whitespace-pre-line" data-pengguna>{p.isi}</span></li>
                    ))}
                  </ul>
                  {c.csat && <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.nilaiPelanggan, { n: c.csat })}</p>}
                  {c.status !== "selesai" && (
                    <div className="mt-2 space-y-3">
                      <FormBalas id={c.id} nama={c.pengunjung} templat={templat} teks={t} />
                      <div className="flex flex-wrap items-end gap-4">
                        {kelola && <FormTugaskan id={c.id} nama={c.pengunjung} agen={agen} sekarang={c.agen_id} teks={t} />}
                        <TombolTutup id={c.id} nama={c.pengunjung} teks={t} />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {kelola && (
        <>
          <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-atur-layanan">
            <h2 id="judul-atur-layanan" className={judul}>{t.aturJudul}</h2>
            {atur ? <p className="mt-2 break-all text-sm"><span className="text-tinta-2">{t.tautanPublik}: </span><a href={`/bantuan/${atur.kunci}`} className="angka text-laut underline underline-offset-2" data-testid="tautan-bantuan">/bantuan/{atur.kunci}</a></p>
              : <p className="mt-2 text-sm text-tinta-2">{t.belumAktif}</p>}
            <FormAtur awal={atur} teks={t} />
          </section>
          <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-artikel">
            <h2 id="judul-artikel" className={judul}>{t.artikelJudul}</h2>
            <p className="mt-1 text-sm text-tinta-2">{t.artikelKet}</p>
            {artikel.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.belumArtikel}</p> : (
              <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-artikel">
                {artikel.map((a) => <li key={a.id} className="py-2"><p className="font-semibold" data-pengguna>{a.judul}</p><p className="text-tinta-2" data-pengguna>{a.isi}</p></li>)}
              </ul>
            )}
            <FormArtikel teks={t} />
            <h3 className="mt-6 font-semibold">{t.templatJudul}</h3>
            <FormTemplat teks={t} />
          </section>
        </>
      )}
    </div>
  );
}

export default function HalamanLayanan() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi />
      </Suspense>
    </main>
  );
}
