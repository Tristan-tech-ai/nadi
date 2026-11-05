import type { Metadata } from "next";
import { Suspense } from "react";
import { WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { FormDana, FormRencana, FormSesi, FormStatus } from "@/components/app/magang";
import { Cap, type JenisCap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { hariIni } from "@/lib/izin";
import { formatLamaMenit, totalUangSaku, type BarisMinggu, type Peringatan, type StatusRencana, type UangSaku } from "@/lib/rekrut/magang";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Magang" };

type K = { t: Kamus["magang"]; f: Kamus["magangForm"]; bahasa: Bahasa };
const namaBulan = (b: string, t: Kamus["magang"]) => `${t.bulan[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`;

type Rencana = {
  id: string;
  status: StatusRencana;
  mulai: string;
  selesai: string;
  uang_saku: UangSaku;
  tujuan: string;
  minggu: BarisMinggu[];
  uji_akhir: string | null;
  nilai_akhir: number | null;
  peserta: { id: string; nama: string };
  mentor: { id: string | null; nama: string | null };
  topi: { id: string; nama: string } | null;
  saya_mentor: boolean;
  menit_mentor: number;
  sesi: { tanggal: string; menit: number; catatan: string | null }[];
  peringatan: Peringatan[];
};

type BarisLaporan = {
  jenis: "magang" | "diterima";
  id: string;
  nama: string;
  status: string;
  menit_mentor: number;
  menit_penilai: number;
  biaya_iklan_bagian: number;
  biaya_total: number;
  menit_tanpa_tarif: number;
};
type Laporan = {
  tarif_jam: number | null;
  anggaran: number | null;
  terpakai: number;
  sisa: number | null;
  menit_mentor: number;
  menit_penilai: number;
  menit_tanpa_tarif: number;
  baris: BarisLaporan[];
  total_biaya: number;
};

const CAP_STATUS: Record<StatusRencana, JenisCap> = { rencana: "menunggu", jalan: "menunggu", selesai: "diterima", batal: "ditolak" };

/** Peringatan dari aturan magang ditulis database dalam bahasa Indonesia (pasal dan sumbernya): di bahasa lain ditandai lang="id". */
function DaftarPeringatan({ p, k: { t, bahasa } }: { p: Peringatan[]; k: K }) {
  if (!p.length) return null;
  return (
    <ul className="mt-2 grid gap-2 rounded-[var(--radius-isian)] border border-cap/40 p-3 text-sm" data-testid="peringatan-magang" aria-label={t.peringatanAria} lang={bahasa === "id" ? undefined : "id"}>
      {p.map((x) => (
        <li key={x.kode} data-kode={x.kode} className="flex gap-2">
          <WarningIcon size={18} className="mt-0.5 shrink-0 text-cap" aria-hidden />
          <span>
            {x.pesan}{" "}
            <span className="text-tinta-2">
              Sumber: <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-laut underline underline-offset-2">{x.sumber}</a>, {x.status}.
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function KartuRencana({ r, pengelola, hari, k }: { r: Rencana; pengelola: boolean; hari: string; k: K }) {
  const { t, f, bahasa } = k;
  const tgl = (x: string) => formatTanggalKalender(x, bahasa);
  const lama = (n: number) => formatLamaMenit(n, bahasa);
  const saku = totalUangSaku(r.uang_saku);
  return (
    <li className="py-4" data-testid="rencana-magang" data-peserta={r.peserta.nama}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold"><span data-pengguna>{r.peserta.nama}</span>{r.topi && <span className="font-normal text-tinta-2">{sisip(t.menuju, { topi: <span data-pengguna>{r.topi.nama}</span> })}</span>}</p>
        <Cap jenis={CAP_STATUS[r.status]} label={t.status[r.status]} />
      </div>
      <p className="mt-1 text-sm text-tinta-2">
        {sisip(t.mentor, { nama: r.mentor.nama ? <span data-pengguna>{r.mentor.nama}</span> : t.belumAda })} · {isiTeks(t.rentang, { a: tgl(r.mulai), b: tgl(r.selesai) })}
      </p>
      <p className="mt-1 text-sm" data-pengguna>{r.tujuan}</p>
      <p className="mt-1 text-sm">
        {t.uangSaku} {saku ? <><Rupiah nilai={saku} className="font-semibold" bahasa={bahasa} /> {t.perBulan}</> : <span className="text-cap">{t.belumDiisi}</span>}
        <span className="text-tinta-2">{t.bimbingan}<span className="angka font-semibold text-tinta" data-testid="menit-mentor">{lama(r.menit_mentor)}</span></span>
        {r.nilai_akhir != null && <span className="text-tinta-2">{t.nilaiAkhir}<span className="angka font-semibold text-tinta">{r.nilai_akhir}</span></span>}
      </p>
      {(r.status === "rencana" || r.status === "jalan") && <DaftarPeringatan p={r.peringatan} k={k} />}
      {(r.minggu.length > 0 || r.uji_akhir) && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-tinta-2">{isiTeks(t.rencanaMinggu, { n: r.minggu.length })}</summary>
          <ol className="mt-2 grid gap-1">
            {r.minggu.map((m, i) => (
              <li key={i}><span className="angka font-semibold">{isiTeks(t.minggu, { n: m.minggu })}</span>: <span data-pengguna>{m.keahlian}</span>{m.target && <span className="text-tinta-2">{t.target}<span data-pengguna>{m.target}</span></span>}</li>
            ))}
          </ol>
          {r.uji_akhir && <p className="mt-2">{t.ujiAkhir}<span data-pengguna>{r.uji_akhir}</span></p>}
        </details>
      )}
      {r.sesi.length > 0 && (
        <ul className="mt-2 text-sm text-tinta-2" aria-label={isiTeks(t.sesiAria, { nama: r.peserta.nama })}>
          {r.sesi.map((s, i) => <li key={i}>{tgl(s.tanggal)}: {lama(s.menit)}{s.catatan && <>, <span data-pengguna>{s.catatan}</span></>}</li>)}
        </ul>
      )}
      {(pengelola || r.saya_mentor) && r.status !== "batal" && <FormSesi rencana={r.id} peserta={r.peserta.nama} hariIni={hari} teks={f} />}
      {pengelola && <FormStatus rencana={r.id} peserta={r.peserta.nama} status={r.status} nilai={r.nilai_akhir} teks={f} labelStatus={t.status} />}
    </li>
  );
}

function TabelBiaya({ l, bulan, k: { t, bahasa } }: { l: Laporan; bulan: string; k: K }) {
  const nb = namaBulan(bulan, t);
  const lama = (n: number) => formatLamaMenit(n, bahasa);
  if (!l.baris.length) {
    return <p className="mt-3 text-sm text-tinta-2" data-testid="biaya-kosong">{isiTeks(t.biayaKosong, { bulan: nb })}</p>;
  }
  const kanan = "px-2 py-2 text-right";
  return (
    <div className="mt-3 overflow-x-auto focus-visible:outline-2 focus-visible:outline-tinta" tabIndex={0} role="region" aria-label={isiTeks(t.tabelAria, { bulan: nb })}>
      <table className="w-full min-w-[34rem] border-collapse text-sm" data-testid="tabel-biaya">
        <caption className="sr-only">{isiTeks(t.tabelCaption, { bulan: nb })}</caption>
        <thead>
          <tr className="border-b border-garis-kuat text-left text-tinta-2">
            <th scope="col" className="px-2 py-2 font-semibold">{t.kolNama}</th>
            <th scope="col" className="px-2 py-2 font-semibold">{t.kolJalur}</th>
            <th scope="col" className={`${kanan} font-semibold`}>{t.kolMentor}</th>
            <th scope="col" className={`${kanan} font-semibold`}>{t.kolPenilai}</th>
            <th scope="col" className={`${kanan} font-semibold`}>{t.kolIklan}</th>
            <th scope="col" className={`${kanan} font-semibold`}>{t.kolBiaya}</th>
          </tr>
        </thead>
        <tbody>
          {l.baris.map((b) => (
            <tr key={`${b.jenis}-${b.id}`} className="border-b border-garis" data-testid="baris-biaya" data-nama={b.nama}>
              <th scope="row" className="px-2 py-2 text-left font-normal" data-pengguna>{b.nama}</th>
              <td className="px-2 py-2">{b.jenis === "magang" ? isiTeks(t.jalurMagang, { status: t.status[b.status as StatusRencana]?.toLowerCase() ?? b.status }) : t.diterimaKerja}</td>
              <td className={`${kanan} angka`}>{b.menit_mentor ? lama(b.menit_mentor) : "-"}</td>
              <td className={`${kanan} angka`}>{b.menit_penilai ? lama(b.menit_penilai) : "-"}</td>
              <td className={kanan}>{b.biaya_iklan_bagian ? <Rupiah nilai={b.biaya_iklan_bagian} bahasa={bahasa} /> : "-"}</td>
              <td className={`${kanan} font-semibold`}><Rupiah nilai={b.biaya_total} bahasa={bahasa} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={5} className="px-2 py-2 text-left">{isiTeks(t.total, { n: l.baris.length })}</th>
            <td className={`${kanan} font-semibold`} data-testid="total-biaya"><Rupiah nilai={l.total_biaya} bahasa={bahasa} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/magang">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const k: K = { t: kamus.magang, f: kamus.magangForm, bahasa };
  const { t, f } = k;
  const lama = (n: number) => formatLamaMenit(n, bahasa);
  const kepala = (
    <>
      <KepalaHalaman jalur="/app/magang" judul={t.judul} ket={t.ket} />
    </>
  );
  const sp = await searchParams;
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const bulan = typeof sp.bulan === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.bulan) ? sp.bulan : hari.slice(0, 7);
  const supabase = await createClient();
  const { data: d, error } = await supabase.rpc("daftar_rencana_magang");
  if (error) {
    return <div lang={bahasa}>{kepala}<p role="alert" className="mt-6 text-cap" data-testid="magang-galat">{t.gagal}</p></div>;
  }
  const daftar = (d ?? []) as Rencana[];

  if (!pengelola) {
    return <div lang={bahasa}>{kepala}{daftar.length ? (
      <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="daftar-rencana">
        {daftar.map((r) => <KartuRencana key={r.id} r={r} pengelola={false} hari={hari} k={k} />)}
      </ul>
    ) : (
      <p className="mt-6 text-tinta-2" data-testid="magang-kosong">{t.kosongStaf}</p>
    )}</div>;
  }

  const [{ data: lap, error: eLap }, { data: orang }, { data: topi }] = await Promise.all([
    supabase.rpc("laporan_rekrut", { p_bulan: `${bulan}-01` }),
    supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama"),
    supabase.from("topi").select("id, nama").eq("aktif", true).neq("kode", "mentor").order("nama"),
  ]);
  const l = lap as Laporan | null;
  const persen = l?.anggaran ? Math.min(100, Math.round((l.terpakai / l.anggaran) * 100)) : null;

  return (
    <div lang={bahasa}>
      {kepala}
      <section className="mt-6 rounded-[var(--radius-kartu)] border border-garis bg-kertas-2 p-4" aria-labelledby="judul-dana" data-testid="dana-rekrutmen">
        <h2 id="judul-dana" className="text-lg font-semibold">{isiTeks(t.dana, { bulan: namaBulan(bulan, t) })}</h2>
        {eLap || !l ? (
          <p role="alert" className="mt-2 text-sm text-cap">{t.danaGagal}</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div><dt className="text-tinta-2">{t.tarif}</dt><dd className="font-semibold" data-testid="tarif-jam">{l.tarif_jam != null ? <Rupiah nilai={l.tarif_jam} bahasa={bahasa} /> : t.belumDiisiBesar}</dd></div>
              <div><dt className="text-tinta-2">{t.anggaran}</dt><dd className="font-semibold">{l.anggaran != null ? <Rupiah nilai={l.anggaran} bahasa={bahasa} /> : t.belumDiisiBesar}</dd></div>
              <div><dt className="text-tinta-2">{t.terpakai}</dt><dd className="font-semibold" data-testid="dana-terpakai"><Rupiah nilai={l.terpakai} bahasa={bahasa} /></dd></div>
              <div><dt className="text-tinta-2">{t.sisa}</dt><dd className={`font-semibold ${l.sisa != null && l.sisa < 0 ? "text-cap" : ""}`}>{l.sisa != null ? <Rupiah nilai={l.sisa} bahasa={bahasa} /> : "-"}</dd></div>
            </dl>
            {persen != null && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-kertas" role="img" aria-label={isiTeks(t.persenAria, { n: persen })}>
                <div className={`h-full ${persen >= 100 ? "bg-cap" : "bg-tinta"}`} style={{ width: `${persen}%` }} />
              </div>
            )}
            <p className="mt-2 text-xs text-tinta-2">
              {isiTeks(t.dihitung, { mentor: lama(l.menit_mentor), penilai: lama(l.menit_penilai) })}
              {l.menit_tanpa_tarif > 0 && isiTeks(t.tanpaTarif, { n: lama(l.menit_tanpa_tarif) })}{t.tanpaGaji}
            </p>
            {sesi.peran === "pemilik" ? <FormDana tarif={l.tarif_jam} anggaran={l.anggaran} teks={f} /> : <p className="mt-3 text-sm text-tinta-2">{t.diaturPemilik}</p>}
          </>
        )}
      </section>

      <section className="mt-10" aria-labelledby="judul-rencana">
        <h2 id="judul-rencana" className="text-lg font-semibold">{t.rencanaJudul}</h2>
        {bahasa !== "id" && daftar.length > 0 ? <p className="mt-1 text-sm text-tinta-2">{t.catatanIsi}</p> : null}
        {daftar.length === 0 ? (
          <p data-langkah='#judul-buat' className="mt-2 text-sm text-tinta-2" data-testid="magang-kosong">{t.rencanaKosong}</p>
        ) : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="daftar-rencana">
            {daftar.map((r) => <KartuRencana key={r.id} r={r} pengelola hari={hari} k={k} />)}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-buat">
        <h2 id="judul-buat" className="text-lg font-semibold">{t.buatJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.buatKet}</p>
        <FormRencana orang={(orang ?? []) as { id: string; nama: string }[]} topi={(topi ?? []) as { id: string; nama: string }[]} hariIni={hari} teks={f} />
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-biaya" data-testid="biaya-rekrutmen">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="judul-biaya" className="text-lg font-semibold">{t.biayaJudul}</h2>
          <form className="flex items-end gap-2" aria-label={t.pilihBulanAria}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-tinta-2">{t.bulanLabel}</span>
              <input type="month" name="bulan" defaultValue={bulan} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" />
            </label>
            <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-3 text-sm font-semibold hover:bg-kertas-2">{t.tampilkan}</button>
          </form>
        </div>
        <p className="mt-1 text-sm text-tinta-2">{t.biayaKet}</p>
        {l && <TabelBiaya l={l} bulan={bulan} k={k} />}
      </section>
    </div>
  );
}

function Kerangka() {
  return (
    <div aria-hidden className="mt-6 grid gap-4" data-testid="magang-memuat">
      <div className="h-36 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />
      <div className="h-5 w-40 animate-pulse rounded bg-kertas-2" />
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-2 border-b border-garis pb-4">
          <div className="h-4 w-1/2 animate-pulse rounded bg-kertas-2" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-kertas-2" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-kertas-2" />
        </div>
      ))}
    </div>
  );
}

export default function Magang(props: PageProps<"/app/magang">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<Kerangka />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
