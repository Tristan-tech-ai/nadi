import type { Metadata } from "next";
import { Suspense } from "react";
import { FormBagikan, FormLembur, FormLepas, FormSetujui, FormSiapkan } from "@/components/app/aksi-gaji";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import type { JenisHariLembur } from "@/lib/gaji/bpjs-lembur";
import { JENIS_LEMBUR } from "@/lib/gaji/lembur";
import type { Komponen } from "@/lib/gaji/susun";
import { formatTanggalKalender } from "@/lib/format";
import { hariIni } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Gaji" };

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const namaBulan = (b: string) => `${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`;

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

function RincianSlip({ s }: { s: Slip }) {
  const baris = (jenis: Komponen["jenis"]) => s.komponen.filter((k) => k.jenis === jenis);
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-tinta-2">Rincian</summary>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        {[...baris("pendapatan"), ...baris("potongan")].map((k) => (
          <div key={k.kode} className="contents">
            <dt>{k.jenis === "potongan" ? `Potongan ${k.label}` : k.label}</dt>
            <dd className="text-right"><Rupiah nilai={k.jenis === "potongan" ? -k.nilai : k.nilai} /></dd>
          </div>
        ))}
        {baris("pemberi_kerja").map((k) => (
          <div key={k.kode} className="contents text-tinta-2">
            <dt>{k.label}</dt>
            <dd className="text-right"><Rupiah nilai={k.nilai} /></dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/gaji">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
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

  if (!pengelola) {
    return slip.length ? (
      <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="slip-saya">
        {slip.map((s) => (
          <li key={s.id} className="py-3">
            <p className="font-semibold">Gaji {namaBulan(bulan)}: <Rupiah nilai={s.neto} /></p>
            <RincianSlip s={s} />
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-6 text-tinta-2" data-testid="slip-kosong">Slip gaji {namaBulan(bulan)} belum disetujui. Nanti muncul di sini.</p>
    );
  }

  const akhir = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [{ data: lem }, { data: org }] = await Promise.all([
    supabase.from("lembur").select("id, tanggal, jenis, jam, orang:orang_id(nama)").gte("tanggal", `${bulan}-01`).lte("tanggal", akhir).gt("jam", 0).order("tanggal"),
    supabase.from("orang").select("id, nama").eq("status", "aktif").overlaps("jenis", ["karyawan", "magang"]).order("nama"),
  ]);
  const lembur = (lem ?? []) as unknown as { id: string; tanggal: string; jenis: JenisHariLembur; jam: number; orang: { nama: string } | null }[];

  return (
    <>
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{namaBulan(bulan)}</h2>
        {per && <Cap jenis={disetujui ? "diterima" : "menunggu"} label={disetujui ? "Disetujui" : "Draf"} />}
      </div>
      {slip.length > 0 && (
        <p className="mt-1 text-tinta-2">
          Dibayar ke {slip.filter((s) => !s.ditahan).length} orang, total <Rupiah nilai={total} className="font-semibold text-tinta" />
        </p>
      )}
      {!disetujui && <div className="mt-4"><FormSiapkan bulan={bulan} ada={slip.length > 0} /></div>}
      {slip.length === 0 ? (
        <p className="mt-6 text-tinta-2" data-testid="gaji-kosong">Belum ada draf gaji bulan ini. Nadi menghitung PPh 21, BPJS, dan menahan nama yang mencurigakan sebelum kamu setujui.</p>
      ) : (
        <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="daftar-slip">
          {slip.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{s.orang?.nama}</p>
                <p className="flex items-center gap-2">
                  {s.ditahan && <Cap jenis="ditahan" />}
                  <Rupiah nilai={s.neto} className="font-semibold" />
                </p>
              </div>
              {s.ditahan && <p className="mt-1 text-sm text-cap">{s.alasan_tahan}</p>}
              {s.peringatan.map((p) => <p key={p} className="mt-1 text-sm text-tinta-2">{p}</p>)}
              <RincianSlip s={s} />
              {s.ditahan && sesi.peran === "pemilik" && <FormLepas slip={s.id} nama={s.orang?.nama ?? ""} />}
              {disetujui && !s.ditahan && <FormBagikan slip={s.id} nama={s.orang?.nama ?? ""} />}
            </li>
          ))}
        </ul>
      )}
      {per && !disetujui && slip.length > 0 && <div className="mt-6"><FormSetujui periode={per.id} jumlah={slip.length} /></div>}
      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-lembur" data-testid="lembur">
        <h2 id="judul-lembur" className="text-lg font-semibold">Lembur {namaBulan(bulan)}</h2>
        <p className="mt-1 text-sm text-tinta-2">Upah lembur dihitung menurut PP 35/2021: upah sejam 1/173 dari gaji pokok dan tunjangan tetap. Hari kerja paling lama 4 jam sehari dan 18 jam seminggu.</p>
        {lembur.length === 0 ? (
          <p className="mt-3 text-sm text-tinta-2" data-testid="lembur-kosong">Belum ada lembur tercatat bulan ini.</p>
        ) : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-lembur">
            {lembur.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{l.orang?.nama}, {formatTanggalKalender(l.tanggal)}</span>
                <span className="text-tinta-2"><span className="angka font-semibold text-tinta">{l.jam} jam</span>, {JENIS_LEMBUR[l.jenis].toLowerCase()}</span>
              </li>
            ))}
          </ul>
        )}
        {!disetujui && <FormLembur orang={(org ?? []) as { id: string; nama: string }[]} awal={`${bulan}-01`} akhir={akhir} />}
      </section>
    </>
  );
}

export default function Gaji(props: PageProps<"/app/gaji">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Gaji</h1>
      <p className="mt-2 text-tinta-2">PPh 21 dan BPJS dihitung dari aturan resmi yang sudah diperiksa. Yang belum pasti ditandai, tidak ditebak.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
