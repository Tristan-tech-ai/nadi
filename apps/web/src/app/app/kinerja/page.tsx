import type { Metadata } from "next";
import { Suspense } from "react";
import { FormIdp, FormKalibrasi, FormProgres, FormReview, FormSiklus, FormSiklusLain, FormTujuan } from "@/components/app/kinerja";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Kinerja" };

type Ringkas = { orang: string; nama: string; diri: number | null; atasan: number | null; rekan: number | null; usulan: number | null; masuk: number; total: number; kotak: string | null };
const KOTAK = ["k3p1", "k3p2", "k3p3", "k2p1", "k2p2", "k2p3", "k1p1", "k1p2", "k1p3"] as const;

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).kinerja;
  const supabase = await createClient();
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const { data: ang } = await supabase.from("anggota").select("orang_id").eq("perusahaan_id", sesi.perusahaanId).eq("user_id", sesi.userId).maybeSingle();
  const saya = (ang?.orang_id as string | null) ?? null;
  const angka = new Intl.NumberFormat(bahasa === "en" ? "en-GB" : "id-ID", { maximumFractionDigits: 2 });
  const f = (x: number | null) => (x === null || x === undefined ? "" : angka.format(Number(x)));

  const [tugas, siklus, tujuan, idp, org] = await Promise.all([
    saya ? supabase.from("review_entry").select("id, peran, orang:orang_id(nama), cycle:cycle_id(nama, kompetensi, status)").eq("penilai_id", saya).is("dikirim_at", null) : Promise.resolve({ data: [] }),
    supabase.from("review_cycle").select("id, nama, mulai, selesai, status").order("dibuat_at", { ascending: false }).limit(5),
    saya ? supabase.from("perf_goal").select("id, judul, target, satuan, progres, selesai").eq("orang_id", saya).order("diubah_at", { ascending: false }) : Promise.resolve({ data: [] }),
    saya ? supabase.from("idp_item").select("id, tujuan, langkah, target, status").eq("orang_id", saya).order("diubah_at", { ascending: false }) : Promise.resolve({ data: [] }),
    pengelola ? supabase.from("orang").select("id, nama").eq("status", "aktif").overlaps("jenis", ["karyawan", "magang"]).order("nama").limit(300) : Promise.resolve({ data: [] }),
  ]);
  const tugasBuka = ((tugas.data ?? []) as unknown as { id: string; peran: "diri" | "atasan" | "rekan"; orang: { nama: string } | null; cycle: { nama: string; kompetensi: string[]; status: string } | null }[])
    .filter((x) => x.cycle?.status === "buka");
  const daftarSiklus = (siklus.data ?? []) as { id: string; nama: string; mulai: string; selesai: string; status: "buka" | "selesai" }[];
  const ringkas = new Map<string, Ringkas[]>(await Promise.all(daftarSiklus.slice(0, 3).map(async (c) =>
    [c.id, ((await supabase.rpc("review_summary", { p_cycle: c.id })).data ?? []) as Ringkas[]] as const)));
  const orang = (org.data ?? []) as { id: string; nama: string }[];
  const sel = "border-b border-garis py-2 pr-3";

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/kinerja" judul={t.judul} ket={t.ket} />
      {!saya && <p className="mt-3 text-sm text-tinta-2">{t.tanpaOrang}</p>}

      {saya && (
        <section className="mt-8" aria-labelledby="tugas"><h2 id="tugas" className="text-lg font-semibold">{t.tugasJudul}</h2>
          {tugasBuka.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.tugasKosong}</p> : (
            <div className="mt-3 grid gap-3" data-testid="tugas-review">{tugasBuka.map((x) => (
              <FormReview key={x.id} entry={x.id} kompetensi={x.cycle?.kompetensi ?? []} teks={t}
                judul={`${x.cycle?.nama}. ${isiTeks(t.menilai, { peran: t.peranNama[x.peran], nama: x.orang?.nama ?? "" })}`} />))}</div>
          )}
        </section>
      )}

      {saya && (
        <section className="mt-8" aria-labelledby="tujuan"><h2 id="tujuan" className="text-lg font-semibold">{t.tujuanJudul}</h2>
          {(tujuan.data ?? []).length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.tujuanKosong}</p> : (
            <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">{((tujuan.data ?? []) as { id: string; judul: string; target: number | null; satuan: string | null; progres: number; selesai: string }[]).map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span data-pengguna>{g.judul}</span> <span className="text-tinta-2">{g.target ? isiTeks(t.progresBaris, { progres: f(g.progres), target: f(g.target), satuan: g.satuan ?? "" }) : f(g.progres)}, {formatTanggalKalender(g.selesai, bahasa)}</span></span>
                <FormProgres id={g.id} judul={g.judul} progres={Number(g.progres)} teks={t} /></li>))}</ul>
          )}
          <FormTujuan orang={saya} hariIni={hari} teks={t} />
          <h3 className="mt-6 font-semibold">{t.idpJudul}</h3>
          {(idp.data ?? []).length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.idpKosong}</p> : (
            <ul className="mt-1 grid gap-1 text-sm">{((idp.data ?? []) as { id: string; tujuan: string; langkah: string | null; target: string | null }[]).map((i) => (
              <li key={i.id} data-pengguna>{i.tujuan}{i.langkah ? `: ${i.langkah}` : ""}{i.target ? ` (${formatTanggalKalender(i.target, bahasa)})` : ""}</li>))}</ul>
          )}
          <FormIdp orang={saya} teks={t} />
        </section>
      )}

      {pengelola && (
        <section className="mt-10" aria-labelledby="siklus"><h2 id="siklus" className="text-lg font-semibold">{t.siklusJudul}</h2>
          <FormSiklus orang={orang} hariIni={hari} teks={t} />
          {daftarSiklus.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.siklusKosong}</p> : daftarSiklus.slice(0, 3).map((c) => {
            const r = ringkas.get(c.id) ?? [];
            return (
              <div key={c.id} className="mt-6" data-testid="siklus" data-status={c.status}>
                <h3 className="font-semibold"><span data-pengguna>{c.nama}</span> <span className="text-sm font-normal text-tinta-2">{t.mulai} {formatTanggalKalender(c.mulai, bahasa)}, {t.selesai.toLowerCase()} {formatTanggalKalender(c.selesai, bahasa)}, {t.statusNama[c.status]}</span></h3>
                <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={c.nama}>
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead className="text-tinta-2"><tr><th className={sel}>{t.kolNama}</th><th className={`${sel} text-right`}>{t.kolDiri}</th><th className={`${sel} text-right`}>{t.kolAtasan}</th>
                      <th className={`${sel} text-right`}>{t.kolRekan}</th><th className={`${sel} text-right`}>{t.kolUsulan}</th><th className={`${sel} text-right`}>{t.kolMasuk}</th><th className={sel}>{t.kolKotak}</th></tr></thead>
                    <tbody>{r.map((x) => (
                      <tr key={x.orang} data-testid="ringkas-review"><td className={sel} data-pengguna>{x.nama}</td><td className={`${sel} angka text-right`}>{f(x.diri)}</td><td className={`${sel} angka text-right`}>{f(x.atasan)}</td>
                        <td className={`${sel} angka text-right`}>{f(x.rekan)}</td><td className={`${sel} angka text-right`}>{f(x.usulan)}</td><td className={`${sel} angka text-right`}>{x.masuk}/{x.total}</td>
                        <td className={sel}>{x.kotak ? t.kotakNama[x.kotak as keyof typeof t.kotakNama] : ""}</td></tr>))}</tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-tinta-2">{t.rekanCatatan}</p>
                {c.status === "buka" && (<>
                  <div className="mt-3 grid gap-2">{r.map((x) => <FormKalibrasi key={x.orang} cycle={c.id} orang={x.orang} nama={x.nama} teks={t} />)}</div>
                  <FormSiklusLain cycle={c.id} peserta={r.map((x) => ({ id: x.orang, nama: x.nama }))} orang={orang} teks={t} />
                </>)}
                {r.some((x) => x.kotak) && (
                  <div className="mt-4"><h4 className="text-sm font-semibold">{t.gridJudul}</h4><p className="text-xs text-tinta-2">{t.sumbuKinerja}</p>
                    <div className="mt-2 grid grid-cols-3 gap-1 text-xs" data-testid="grid-9box">{KOTAK.map((k) => (
                      <div key={k} className="min-h-16 rounded-[var(--radius-kartu)] border border-garis p-2"><p className="font-semibold">{t.kotakNama[k]}</p>
                        <p data-pengguna>{r.filter((x) => x.kotak === k).map((x) => x.nama).join(", ")}</p></div>))}</div></div>
                )}
              </div>
            );
          })}
          <h3 className="mt-8 font-semibold">{t.tujuanOrang}</h3>
          <FormTujuan orang="" pilihan={orang} hariIni={hari} teks={t} />
        </section>
      )}
    </div>
  );
}

export default function HalamanKinerja() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
