import type { Metadata } from "next";
import { Suspense } from "react";
import { IlustrasiSlip } from "@/components/ilustrasi";
import { CadanganPesangon } from "@/components/app/cadangan-pesangon";
import { FormBagikan, FormLembur, FormLepas, FormSetujui, FormSiapkan } from "@/components/app/aksi-gaji";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import type { JenisHariLembur } from "@/lib/gaji/bpjs-lembur";
import { JENIS_LEMBUR } from "@/lib/gaji/lembur";
import type { Komponen } from "@/lib/gaji/susun";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { hariIni } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Gaji" };

type TeksGaji = Kamus["gaji"];
const namaBulan = (b: string, t: TeksGaji) => `${t.bulan[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`;

type Slip = {
  id: string;
  bruto: number;
  potongan: number;
  neto: number;
  komponen: Komponen[];
  peringatan: string[];
  ditahan: boolean;
  alasan_tahan: string | null;
  orang: { nama: string } | null;
};

/** Nama komponen slip ditulis susunSlip dalam bahasa Indonesia (istilah PPh 21 dan BPJS): di bahasa lain ditandai lang="id". */
function RincianSlip({ s, t, bahasa }: { s: Slip; t: TeksGaji; bahasa: Bahasa }) {
  const baris = (jenis: Komponen["jenis"]) => s.komponen.filter((k) => k.jenis === jenis);
  const isiLang = bahasa === "id" ? undefined : "id";
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-tinta-2">{t.rincian}</summary>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {[...baris("pendapatan"), ...baris("potongan")].map((k) => (
          <div key={k.kode} className="contents">
            <dt>{k.jenis === "potongan" ? sisip(t.potongan, { label: <span lang={isiLang}>{k.label}</span> }) : <span lang={isiLang}>{k.label}</span>}</dt>
            <dd className="text-right"><Rupiah nilai={k.jenis === "potongan" ? -k.nilai : k.nilai} bahasa={bahasa} /></dd>
          </div>
        ))}
        {baris("pemberi_kerja").map((k) => (
          <div key={k.kode} className="contents text-tinta-2">
            <dt lang={isiLang}>{k.label}</dt>
            <dd className="text-right"><Rupiah nilai={k.nilai} bahasa={bahasa} /></dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/gaji">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const t = kamus.gaji;
  const f = kamus.gajiForm;
  const isiLang = bahasa === "id" ? undefined : "id";
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const sp = await searchParams;
  const bulan = typeof sp.bulan === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.bulan) ? sp.bulan : hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId)).slice(0, 7);
  const supabase = await createClient();
  const { data: per } = await supabase.from("periode_gaji").select("id, status").eq("bulan", `${bulan}-01`).maybeSingle();
  const { data } = per
    ? await supabase.from("slip_gaji").select("id, bruto, potongan, neto, komponen, peringatan, ditahan, alasan_tahan, orang:orang_id(nama)").eq("periode_id", per.id)
    : { data: [] };
  const slip = ((data ?? []) as unknown as Slip[]).sort((a, b) => (a.orang?.nama ?? "").localeCompare(b.orang?.nama ?? ""));
  const disetujui = per?.status === "disetujui";
  const total = slip.filter((s) => !s.ditahan).reduce((n, s) => n + s.neto, 0);

  const kepala = (
    <>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      {bahasa !== "id" ? (
        <p className="mt-3 rounded-[var(--radius-kartu)] border border-garis-kuat px-3 py-2 text-sm" data-testid="khusus-indonesia">
          <span className="font-semibold">{t.hanyaIndonesia}.</span> {t.hanyaIndonesiaKet}
        </p>
      ) : null}
    </>
  );

  if (!pengelola) {
    return <div lang={bahasa}>{kepala}{slip.length ? (
      <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="slip-saya">
        {slip.map((s) => (
          <li key={s.id} className="py-3">
            <p className="font-semibold">{isiTeks(t.gajiBulan, { bulan: namaBulan(bulan, t) })} <Rupiah nilai={s.neto} bahasa={bahasa} /></p>
            <RincianSlip s={s} t={t} bahasa={bahasa} />
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-6 text-tinta-2" data-testid="slip-kosong">{isiTeks(t.slipBelum, { bulan: namaBulan(bulan, t) })}</p>
    )}</div>;
  }

  const akhir = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [{ data: lem }, { data: org }] = await Promise.all([
    supabase.from("lembur").select("id, tanggal, jenis, jam, orang:orang_id(nama)").gte("tanggal", `${bulan}-01`).lte("tanggal", akhir).gt("jam", 0).order("tanggal"),
    supabase.from("orang").select("id, nama").eq("status", "aktif").overlaps("jenis", ["karyawan", "magang"]).order("nama"),
  ]);
  const lembur = (lem ?? []) as unknown as { id: string; tanggal: string; jenis: JenisHariLembur; jam: number; orang: { nama: string } | null }[];

  return (
    <div lang={bahasa}>
      {kepala}
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{namaBulan(bulan, t)}</h2>
        {per && <Cap jenis={disetujui ? "diterima" : "menunggu"} label={disetujui ? t.disetujui : t.draf} />}
      </div>
      {slip.length > 0 && (
        <p className="mt-1 text-tinta-2">
          {isiTeks(t.dibayar, { n: slip.filter((s) => !s.ditahan).length })} <Rupiah nilai={total} className="font-semibold text-tinta" bahasa={bahasa} />
        </p>
      )}
      {!disetujui && <div className="mt-4"><FormSiapkan bulan={bulan} ada={slip.length > 0} teks={f} /></div>}
      {slip.length === 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3"><IlustrasiSlip className="w-28" /><p className="text-tinta-2" data-testid="gaji-kosong">{t.kosong}</p></div>
      ) : (
        <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="daftar-slip">
          {slip.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold" data-pengguna>{s.orang?.nama}</p>
                <p className="flex items-center gap-2">
                  {s.ditahan && <Cap jenis="ditahan" label={kamus.cap.ditahan} />}
                  <Rupiah nilai={s.neto} className="font-semibold" bahasa={bahasa} />
                </p>
              </div>
              {s.ditahan && <p className="mt-1 text-sm text-cap" lang={isiLang}>{s.alasan_tahan}</p>}
              {s.peringatan.map((p) => <p key={p} className="mt-1 text-sm text-tinta-2" lang={isiLang}>{p}</p>)}
              <RincianSlip s={s} t={t} bahasa={bahasa} />
              {s.ditahan && sesi.peran === "pemilik" && <FormLepas slip={s.id} nama={s.orang?.nama ?? ""} teks={f} />}
              {disetujui && !s.ditahan && <FormBagikan slip={s.id} nama={s.orang?.nama ?? ""} teks={f} />}
            </li>
          ))}
        </ul>
      )}
      {per && !disetujui && slip.length > 0 && <div className="mt-6"><FormSetujui periode={per.id} jumlah={slip.length} teks={f} /></div>}
      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-lembur" data-testid="lembur">
        <h2 id="judul-lembur" className="text-lg font-semibold">{isiTeks(t.lemburJudul, { bulan: namaBulan(bulan, t) })}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.lemburKet}</p>
        {lembur.length === 0 ? (
          <p className="mt-3 text-sm text-tinta-2" data-testid="lembur-kosong">{t.lemburKosong}</p>
        ) : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-lembur">
            {lembur.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><span data-pengguna>{l.orang?.nama}</span>, {formatTanggalKalender(l.tanggal, bahasa)}</span>
                <span className="text-tinta-2"><span className="angka font-semibold text-tinta">{isiTeks(t.jam, { n: l.jam })}</span>, {(t.jenisLembur[l.jenis] ?? JENIS_LEMBUR[l.jenis]).toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
        {!disetujui && <FormLembur orang={(org ?? []) as { id: string; nama: string }[]} awal={`${bulan}-01`} akhir={akhir} teks={f} jenisLembur={t.jenisLembur} />}
      </section>
      {sesi.peran === "pemilik" && (
        <Suspense fallback={<div className="mt-10 h-40 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
          {/* Cadangan pesangon berisi penjelasan pasal PP 35/2021; di bahasa lain tampil dalam bahasa Indonesia dengan catatan. */}
          {bahasa !== "id" ? <p className="mt-10 text-sm text-tinta-2" data-testid="catatan-pesangon">{t.pesangonCatatan}</p> : null}
          <div lang={isiLang}>
            <CadanganPesangon />
          </div>
        </Suspense>
      )}
    </div>
  );
}

export default function Gaji(props: PageProps<"/app/gaji">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Suspense
        fallback={
          <div aria-hidden>
            <div className="h-9 w-32 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" />
            <div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />
          </div>
        }
      >
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
