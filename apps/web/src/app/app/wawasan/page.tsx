import type { Metadata } from "next";
import { Suspense } from "react";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { formatAngka, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { ambilBaris } from "@/lib/wawasan/ambil";
import { bacaPilihan, BATAS_BARIS, SUMBER, sumberMod, type Sumber } from "@/lib/wawasan/laporan";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Wawasan" };

type Wawasan = {
  hari: string; bulan: string;
  hr: { aktif: number; masuk_12: number; keluar_12: number; turnover_persen: number | null; hadir_hari_ini: number; hadir_bulan: number; lembur_jam_bulan: number;
    gaji: { bulan: string; bruto: number; neto: number; orang: number } | null; berisiko: { orang: string; nama: string; berat: boolean; lintas: boolean; sakit: boolean }[] | null };
  bisnis: { pendapatan_bulan: number; beban_bulan: number; laba_bulan: number; invoice_terbuka: { jumlah: number; nilai: number; lewat: number; nilai_lewat: number } };
};

function Kotak({ label, id, children, ket }: { label: string; id: string; children: React.ReactNode; ket?: string }) {
  return (
    <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-4">
      <dt className="text-sm text-tinta-2">{label}</dt>
      <dd className="angka mt-1 text-2xl font-semibold" data-testid={id}>{children}</dd>
      {ket && <dd className="mt-1 text-xs text-tinta-2">{ket}</dd>}
    </div>
  );
}

const PRATINJAU = 20;

async function Isi({ searchParams }: { searchParams: PageProps<"/app/wawasan">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).wawasan;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/wawasan" judul={t.judul} ket={t.hanyaPengelola} /></div>;
  }
  const sp = await searchParams;
  const supabase = await createClient();
  // X-18: koleksi fitur tambahan yang aktif menjadi sumber laporan (kolom dari manifest) dan diringkas di bawah.
  const { data: modAktif } = await supabase.from("mod").select("id, kode, nama, manifest").eq("status", "aktif").order("nama");
  const modSumber = sumberMod((modAktif ?? []) as Parameters<typeof sumberMod>[0]);
  const p = bacaPilihan(sp, modSumber);
  const [{ data, error }, lap, { data: catatanMod }] = await Promise.all([supabase.rpc("insight_dashboard"), ambilBaris(supabase, p, BATAS_BARIS),
    modSumber.length ? supabase.from("mod_record").select("mod_id, koleksi, status").eq("arsip", false).limit(10000) : Promise.resolve({ data: [] })]);
  const judulKolom = (k: string) => (p.mod ? p.mod.label[k] ?? k : t.kolomNama[k] ?? k);
  const kolomSumber: readonly string[] = p.mod ? p.mod.kolom : SUMBER[p.sumber as Sumber].kolom;
  const hitungMod = new Map<string, Map<string, number>>();
  for (const c of (catatanMod ?? []) as { mod_id: string; koleksi: string; status: string | null }[]) {
    const k = `${c.mod_id}:${c.koleksi}`;
    const m = hitungMod.get(k) ?? new Map<string, number>();
    m.set(c.status ?? "", (m.get(c.status ?? "") ?? 0) + 1);
    hitungMod.set(k, m);
  }
  const w = data as Wawasan | null;
  const a = (n: number) => formatAngka(n, bahasa);
  const nf = new Intl.NumberFormat(bahasa === "en" ? "en-US" : "id-ID", { maximumFractionDigits: 1 });
  const namaBulan = (kode: string) => {
    const [th, bl] = kode.split("-").map(Number);
    return new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(th, bl - 1, 1)));
  };
  const nilaiSel = (k: string, v: unknown) => {
    if (v === null || v === undefined) return "";
    const tipeMod = p.mod?.tipe[k];
    if (tipeMod === "rupiah") return <Rupiah nilai={Number(v)} bahasa={bahasa} />;
    if (tipeMod === "tanggal") return formatTanggalKalender(String(v), bahasa);
    if (tipeMod === "centang") return v ? t.ya : t.tidak;
    if (!p.mod && (k === "harga_jual" || k === "total")) return <Rupiah nilai={Number(v)} bahasa={bahasa} />;
    if (k === "tanggal" || k === "jatuh_tempo" || k === "lunas_tanggal") return formatTanggalKalender(String(v), bahasa);
    if (k === "dibuat_at") return formatTanggalKalender(String(v).slice(0, 10), bahasa);
    if (k === "aktif") return v ? t.ya : t.tidak;
    return Array.isArray(v) ? v.join(", ") : String(v);
  };
  const qs = new URLSearchParams([["sumber", p.sumber], ...p.kolom.map((k) => ["kolom", k] as [string, string]), ...(p.cari ? [["cari", p.cari] as [string, string]] : [])]).toString();
  const sel = "border-b border-garis py-2 pr-3";

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/wawasan" judul={t.judul} ket={t.ket} />
      {(error || !w) && <p role="alert" className="mt-4 text-cap">{t.gagalBaca}</p>}
      {w && (<>
        <section className="mt-8" aria-labelledby="ws-hr">
          <h2 id="ws-hr" className="text-lg font-semibold">{isiTeks(t.hrJudul, { bulan: namaBulan(w.bulan) })}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kotak label={t.aktif} id="ws-aktif">{a(w.hr.aktif)}</Kotak>
            <Kotak label={t.turnover} id="ws-turnover" ket={isiTeks(t.turnoverKet, { masuk: a(w.hr.masuk_12), keluar: a(w.hr.keluar_12) })}>{w.hr.turnover_persen === null ? t.belumAda : `${nf.format(w.hr.turnover_persen)}%`}</Kotak>
            <Kotak label={t.hadirHariIni} id="ws-hadir" ket={isiTeks(t.hadirBulan, { n: a(w.hr.hadir_bulan) })}>{a(w.hr.hadir_hari_ini)}</Kotak>
            <Kotak label={t.lembur} id="ws-lembur">{isiTeks(t.jam, { n: a(w.hr.lembur_jam_bulan) })}</Kotak>
            {w.hr.gaji && <Kotak label={isiTeks(t.gaji, { bulan: namaBulan(w.hr.gaji.bulan) })} id="ws-gaji" ket={isiTeks(t.gajiKet, { n: a(w.hr.gaji.orang) })}><Rupiah nilai={w.hr.gaji.bruto} bahasa={bahasa} /></Kotak>}
          </dl>
          {w.hr.berisiko && (
            <div className="mt-4" data-testid="ws-berisiko">
              <h3 className="text-sm font-semibold">{t.berisikoJudul}</h3>
              {w.hr.berisiko.length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.berisikoKosong}</p> : (
                <ul className="mt-1 grid gap-1 text-sm">{w.hr.berisiko.map((x) => (
                  <li key={x.orang}><span data-pengguna>{x.nama}</span>: <span className="text-tinta-2">{[x.berat && t.alasanBerat, x.lintas && t.alasanLintas, x.sakit && t.alasanSakit].filter(Boolean).join(", ")}</span></li>))}</ul>
              )}
              <p className="mt-1 text-xs text-tinta-2">{t.berisikoKet}</p>
            </div>
          )}
        </section>
        <section className="mt-8" aria-labelledby="ws-bisnis">
          <h2 id="ws-bisnis" className="text-lg font-semibold">{isiTeks(t.bisnisJudul, { bulan: namaBulan(w.bulan) })}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kotak label={t.pendapatan} id="ws-pendapatan"><Rupiah nilai={w.bisnis.pendapatan_bulan} bahasa={bahasa} /></Kotak>
            <Kotak label={t.beban} id="ws-beban"><Rupiah nilai={w.bisnis.beban_bulan} bahasa={bahasa} /></Kotak>
            <Kotak label={w.bisnis.laba_bulan >= 0 ? t.laba : t.rugi} id="ws-laba"><Rupiah nilai={w.bisnis.laba_bulan} bahasa={bahasa} /></Kotak>
            <Kotak label={t.terbuka} id="ws-terbuka" ket={isiTeks(t.terbukaKet, { n: a(w.bisnis.invoice_terbuka.jumlah), lewat: a(w.bisnis.invoice_terbuka.lewat) })}><Rupiah nilai={w.bisnis.invoice_terbuka.nilai} bahasa={bahasa} /></Kotak>
          </dl>
        </section>
      </>)}

      {modSumber.length > 0 && (
        <section className="mt-8" aria-labelledby="ws-mod" data-testid="ws-mod">
          <h2 id="ws-mod" className="text-lg font-semibold">{bahasa === "en" ? "Add-on features" : "Fitur tambahan"}</h2>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {modSumber.map((m) => {
              const per = hitungMod.get(`${m.modId}:${m.koleksi}`) ?? new Map<string, number>();
              const total = [...per.values()].reduce((a, b) => a + b, 0);
              const status = [...per.entries()].filter(([s]) => s).map(([s, n]) => `${s} ${a(n)}`).join(", ");
              return (
                <li key={m.kunci} className="rounded-[var(--radius-kartu)] border border-garis p-3" data-ws-mod={m.kunci}>
                  <p className="font-semibold" data-pengguna>{m.nama}</p>
                  <p className="text-tinta-2">{a(total)} {bahasa === "en" ? "records" : "catatan"}{status ? <>: <span data-pengguna>{status}</span></> : ""}</p>
                  <a href={`/app/wawasan?sumber=${encodeURIComponent(m.kunci)}`} className="underline underline-offset-4">{bahasa === "en" ? "Report" : "Buat laporan"}</a>
                </li>
              );
            })}
          </ul>
          {(catatanMod ?? []).length >= 10000 && <p className="mt-1 text-xs text-tinta-2">{bahasa === "en" ? "Counted from the first 10,000 records." : "Dihitung dari 10.000 catatan pertama."}</p>}
        </section>
      )}

      <section className="mt-10" aria-labelledby="ws-laporan">
        <h2 id="ws-laporan" className="text-lg font-semibold">{t.laporanJudul}</h2>
        <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.laporanKet}</p>
        <form key={qs} method="get" action="/app/wawasan" className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.laporanBuat}>
          <input type="hidden" name="asal" value={p.sumber} />
          <div className="flex flex-col gap-1"><label htmlFor="ws-sumber" className="text-tinta-2">{t.sumber}</label>
            <select id="ws-sumber" name="sumber" defaultValue={p.sumber} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base">
              {(Object.keys(SUMBER) as Sumber[]).map((s) => <option key={s} value={s}>{t.sumberNama[s]}</option>)}
              {modSumber.map((m) => <option key={m.kunci} value={m.kunci}>{`${bahasa === "en" ? "Add-on" : "Fitur tambahan"}: ${m.nama}`}</option>)}</select></div>
          <div className="flex flex-col gap-1"><label htmlFor="ws-cari" className="text-tinta-2">{isiTeks(t.cari, { kolom: p.mod ? judulKolom(p.mod.judul) : t.kolomNama[SUMBER[p.sumber as Sumber].cari] })}</label>
            <input id="ws-cari" name="cari" defaultValue={p.cari} maxLength={60} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" /></div>
          <fieldset className="sm:col-span-2"><legend className="text-tinta-2">{t.kolom}</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">{kolomSumber.map((k) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" name="kolom" value={k} defaultChecked={p.kolom.includes(k)} className="h-5 w-5" /><span data-pengguna={p.mod ? "" : undefined}>{judulKolom(k)}</span></label>))}</div>
            <p className="mt-1 text-xs text-tinta-2">{t.gantiSumber}</p>
          </fieldset>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Tombol type="submit" ragam="kedua">{t.tampilkan}</Tombol>
            <a href={`/app/wawasan/ekspor?${qs}`} download className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-4 font-semibold hover:bg-kertas-2" data-testid="ws-unduh">{t.unduh}</a>
          </div>
        </form>
        {lap.galat ? <p role="alert" className="mt-3 text-cap">{t.gagalBaca}</p> : (<>
          <p className="mt-3 text-sm text-tinta-2" data-testid="ws-jumlah">{isiTeks(lap.baris.length >= BATAS_BARIS ? t.jumlahBatas : t.jumlah, { n: a(lap.baris.length), tampil: a(Math.min(PRATINJAU, lap.baris.length)) })}</p>
          {lap.baris.length > 0 && (
            <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={t.pratinjau}>
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-tinta-2"><tr>{p.kolom.map((k) => <th key={k} scope="col" className={sel}>{judulKolom(k)}</th>)}</tr></thead>
                <tbody>{lap.baris.slice(0, PRATINJAU).map((b, i) => (
                  <tr key={i} data-testid="ws-baris">{p.kolom.map((k) => <td key={k} className={sel} data-pengguna>{nilaiSel(k, b[k])}</td>)}</tr>))}</tbody>
              </table>
            </div>
          )}
        </>)}
      </section>
    </div>
  );
}

export default function HalamanWawasan(props: PageProps<"/app/wawasan">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
