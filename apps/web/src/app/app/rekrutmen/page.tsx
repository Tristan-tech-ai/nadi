import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { AksiWawancara, FormRencana, FormRincian, FormWawancara } from "@/components/app/rekrutmen";
import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { undanganWawancara } from "@/lib/rekrut/ics";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { nomorWa } from "@/lib/tanda";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Rekrutmen lanjutan" };

type Lamaran = { id: string; nama: string; telepon: string | null; tahap: string; lowongan: { judul: string } | null };
type Slot = { id: string; starts_at: string; ends_at: string; location: string; note: string | null; sequence: number; lamaran: Lamaran | null };
type Lap = { pelamar: number; diterima: number; rata_hari_isi: number | null;
  lowongan: { id: string; judul: string; pelamar: number; ditinjau: number; diterima: number; hari_isi: number | null; biaya_per_pelamar: number | null }[];
  sumber: { sumber: string; pelamar: number; diterima: number }[] };
type Rencana = { topi: string; nama: string; target: number; terisi: number; lowongan_buka: number; anggaran: number };
const ZONA_SINGKAT: Record<string, string> = { "Asia/Jakarta": "WIB", "Asia/Pontianak": "WIB", "Asia/Makassar": "WITA", "Asia/Jayapura": "WIT" };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).rekrutmen;
  const judul = <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>;
  if (!["pemilik", "admin"].includes(sesi.peran ?? "")) return <div lang={bahasa}>{judul}<p className="mt-2 text-tinta-2">{t.hanya}</p></div>;
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const hari = hariIni(new Date(), zona);
  const tahun = Number(hari.slice(0, 4));
  const dari = new Date(Date.parse(`${hari}T00:00:00Z`) - 89 * 86400000).toISOString().slice(0, 10);
  const supabase = await createClient();
  const [la, sl, lap, tp, mp, lw, us] = await Promise.all([
    supabase.from("lamaran").select("id, nama, telepon, tahap, lowongan(judul)").in("tahap", ["masuk", "ditinjau", "ditawari"]).order("dibuat_at", { ascending: false }).limit(200),
    supabase.from("interview_slot").select("id, starts_at, ends_at, location, note, sequence, lamaran(id, nama, telepon, tahap, lowongan(judul))").eq("status", "scheduled")
      .gte("ends_at", new Date().toISOString()).order("starts_at").limit(100),
    supabase.rpc("recruitment_report", { p_dari: dari, p_sampai: hari }),
    supabase.from("topi").select("id, nama").order("nama").limit(200),
    supabase.rpc("manpower_report", { p_tahun: tahun }),
    supabase.from("lowongan").select("id, judul, city, region, employment_type, salary_min, salary_max, salary_unit, valid_through, indexable").eq("buka", true).order("dibuat_at", { ascending: false }).limit(30),
    supabase.from("perusahaan").select("nama").eq("id", sesi.perusahaanId).single(),
  ]);
  const pelamar = ((la.data ?? []) as unknown as Lamaran[]).map((x) => ({ id: x.id, label: `${x.nama}, ${x.lowongan?.judul ?? ""}` }));
  const slots = (sl.data ?? []) as unknown as Slot[];
  const laporan = lap.data as Lap | null;
  const rencana = (mp.data ?? []) as Rencana[];
  const rp = (n: number) => formatRupiah(n, { bahasa });
  const fmtWaktu = (d: string) => new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: zona })
    .format(new Date(d)).replace(/(\d{2}):(\d{2})/, "$1.$2") + ` ${ZONA_SINGKAT[zona] ?? zona}`;
  const sel = "border-b border-garis py-2 pr-3";

  return (
    <div lang={bahasa}>
      {judul}
      <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.ket}</p>

      <section className="mt-8" aria-labelledby="ww">
        <h2 id="ww" className="text-lg font-semibold">{t.wwJudul}</h2>
        {pelamar.length ? <FormWawancara pelamar={pelamar} zona={ZONA_SINGKAT[zona] ?? zona} kunci={randomUUID()} teks={t} /> : <p className="mt-2 text-sm text-tinta-2">{t.tanpaPelamar}</p>}
        {slots.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.wwKosong}</p> : (
          <ul className="mt-4 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-wawancara">
            {slots.map((s) => {
              const wa = nomorWa(s.lamaran?.telepon ?? null);
              const teksWa = undanganWawancara({ nama: s.lamaran?.nama ?? "", lowongan: s.lamaran?.lowongan?.judul ?? "", usaha: us.data?.nama ?? "", waktu: fmtWaktu(s.starts_at), lokasi: s.location });
              return (
                <li key={s.id} className="flex flex-col gap-1 py-3" data-testid="wawancara">
                  <p><span className="font-semibold" data-pengguna>{s.lamaran?.nama}</span> <span className="text-tinta-2" data-pengguna>{s.lamaran?.lowongan?.judul}</span></p>
                  <p className="angka">{fmtWaktu(s.starts_at)}</p>
                  <p className="text-tinta-2" data-pengguna>{s.location}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(teksWa)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4" data-testid="undang-wa">{t.undangWa}</a>}
                    <AksiWawancara w={{ id: s.id, mulai: s.starts_at, selesai: s.ends_at, urutan: s.sequence, judul: `Wawancara ${s.lamaran?.nama ?? ""}, ${s.lamaran?.lowongan?.judul ?? ""}`,
                      lokasi: s.location, catatan: s.note }} teks={t} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="lap">
        <h2 id="lap" className="text-lg font-semibold">{t.lapJudul}</h2>
        {!laporan || laporan.pelamar === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.lapKosong}</p> : (<>
          <p className="mt-2" data-testid="lap-ringkas">{laporan.rata_hari_isi !== null
            ? isiTeks(t.lapRingkas, { pelamar: laporan.pelamar, diterima: laporan.diterima, hari: String(laporan.rata_hari_isi).replace(".", bahasa === "en" ? "." : ",") })
            : isiTeks(t.lapRingkasTanpa, { pelamar: laporan.pelamar, diterima: laporan.diterima })}</p>
          <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={t.lapJudul}>
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-tinta-2"><tr><th className={sel}>{t.kolLowongan}</th><th className={`${sel} text-right`}>{t.kolPelamar}</th><th className={`${sel} text-right`}>{t.kolDitinjau}</th>
                <th className={`${sel} text-right`}>{t.kolDiterima}</th><th className={`${sel} text-right`}>{t.kolHari}</th><th className={`${sel} text-right`}>{t.kolBiaya}</th></tr></thead>
              <tbody>{laporan.lowongan.map((l) => (
                <tr key={l.id}><td className={sel} data-pengguna>{l.judul}</td><td className={`${sel} angka text-right`}>{l.pelamar}</td><td className={`${sel} angka text-right`}>{l.ditinjau}</td>
                  <td className={`${sel} angka text-right`}>{l.diterima}</td><td className={`${sel} angka text-right`}>{l.hari_isi ?? ""}</td>
                  <td className={`${sel} angka text-right`}>{l.biaya_per_pelamar ? rp(l.biaya_per_pelamar) : ""}</td></tr>))}</tbody>
            </table>
          </div>
          <h3 className="mt-4 font-semibold">{t.sumberJudul}</h3>
          <ul className="mt-1 text-sm" data-testid="lap-sumber">{laporan.sumber.map((s) => <li key={s.sumber}><span data-pengguna>{s.sumber}</span>: {s.pelamar} {t.kolPelamar.toLowerCase()}, {s.diterima} {t.kolDiterima.toLowerCase()}</li>)}</ul>
        </>)}
        <p className="mt-2 max-w-2xl text-xs text-tinta-2">{t.sumberTips}</p>
      </section>

      <section className="mt-10" aria-labelledby="mp">
        <h2 id="mp" className="text-lg font-semibold">{isiTeks(t.mpJudul, { tahun })}</h2>
        {(tp.data ?? []).length ? <FormRencana topi={(tp.data ?? []) as { id: string; nama: string }[]} tahun={tahun} teks={t} /> : <p className="mt-2 text-sm text-tinta-2">{t.tanpaTopi}</p>}
        {rencana.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.mpKosong}</p> : (
          <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={isiTeks(t.mpJudul, { tahun })}>
            <table className="w-full min-w-[32rem] text-left text-sm" data-testid="tabel-rencana">
              <thead className="text-tinta-2"><tr><th className={sel}>{t.topi}</th><th className={`${sel} text-right`}>{t.kolTarget}</th><th className={`${sel} text-right`}>{t.kolTerisi}</th>
                <th className={`${sel} text-right`}>{t.kolKurang}</th><th className={`${sel} text-right`}>{t.kolBuka}</th><th className={`${sel} text-right`}>{t.kolAnggaran}</th></tr></thead>
              <tbody>{rencana.map((r) => (
                <tr key={r.topi}><td className={sel} data-pengguna>{r.nama}</td><td className={`${sel} angka text-right`}>{r.target}</td><td className={`${sel} angka text-right`}>{r.terisi}</td>
                  <td className={`${sel} angka text-right`}>{Math.max(0, r.target - r.terisi)}</td><td className={`${sel} angka text-right`}>{r.lowongan_buka}</td>
                  <td className={`${sel} angka text-right`}>{rp(r.anggaran)}</td></tr>))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="cari">
        <h2 id="cari" className="text-lg font-semibold">{t.cariJudul}</h2>
        <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.cariKet}</p>
        {(lw.data ?? []).length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.cariKosong}</p> : (
          <ul className="mt-3 grid gap-4">{((lw.data ?? []) as Parameters<typeof FormRincian>[0]["l"][]).map((l) => (
            <li key={l.id} className="rounded-[var(--radius-kartu)] border border-garis p-4"><h3 className="mb-2 font-semibold" data-pengguna>{l.judul}</h3><FormRincian l={l} teks={t} /></li>))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function HalamanRekrutmen() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
