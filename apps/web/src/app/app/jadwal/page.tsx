import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormBatalShift, FormLembur, FormSalin, FormShift } from "@/components/app/jadwal";
import { formatTanggalKalender } from "@/lib/format";
import { hariIni } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Jadwal" };

// F3-06 (docs/design/jadwal-shift.md): jadwal shift per minggu. Batas PP 35/2021 dijaga simpan_shift; lembur butuh persetujuan.

type Shift = { id?: string; tanggal: string; mulai: string; selesai: string; istirahat: number; lembur?: string | null };
type Minggu = { mulai: string; pola_kerja: string; orang: { id: string; nama: string; menit: number; shift: Shift[] }[] };
type Saya = { mulai: string; shift: Shift[]; lembur: { id: string; tanggal: string; menit: number }[] };

const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const geser = (t: string, n: number) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const jam = (menit: number) => `${Math.floor(menit / 60)} jam${menit % 60 ? ` ${menit % 60} menit` : ""}`;
const rentang = (s: Shift) => `${s.mulai.replace(":", ".")}-${s.selesai.replace(":", ".")}`;

async function Pengelola({ minggu, kelola, hari }: { minggu: string | null; kelola: boolean; hari: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("jadwal_minggu", { p_mulai: minggu });
  if (error || !data) return <p role="alert" className="mt-6 text-cap">Jadwal belum bisa dimuat. Coba muat ulang.</p>;
  const m = data as Minggu;
  const ada = m.orang.some((o) => o.shift.length);
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`/app/jadwal?minggu=${geser(m.mulai, -7)}`} className="underline underline-offset-4">Minggu sebelumnya</Link>
        <p className="font-semibold">{formatTanggalKalender(m.mulai)} sampai {formatTanggalKalender(geser(m.mulai, 6))}</p>
        <Link href={`/app/jadwal?minggu=${geser(m.mulai, 7)}`} className="underline underline-offset-4">Minggu berikutnya</Link>
      </div>
      <p className="mt-1 text-sm text-tinta-2">{m.pola_kerja === "5_hari" ? "5 hari kerja: 8 jam sehari" : "6 hari kerja: 7 jam sehari"}, 40 jam seminggu. Selebihnya lembur, paling lama 4 jam sehari dan 18 jam seminggu.</p>
      {kelola && <div className="mt-4"><FormSalin minggu={m.mulai} /></div>}
      {kelola && <FormShift orang={m.orang.map((o) => ({ id: o.id, nama: o.nama }))} awal={m.mulai >= hari ? m.mulai : hari} kunci={randomUUID()} />}
      {!ada ? (
        <p className="mt-6 text-tinta-2" data-testid="jadwal-kosong">Belum ada jadwal minggu ini. Salin dari minggu lalu, atau tambah shift pertama di atas.</p>
      ) : (
        <div className="mt-6" data-testid="jadwal-minggu">
          {HARI.map((nama, i) => {
            const tgl = geser(m.mulai, i);
            const baris = m.orang.flatMap((o) => o.shift.filter((s) => s.tanggal === tgl).map((s) => ({ o, s })));
            return (
              <section key={tgl} className="border-t border-garis py-3" aria-label={`${nama} ${formatTanggalKalender(tgl)}`}>
                <h2 className={`font-semibold ${tgl === hari ? "inline-block bg-kunyit px-1 text-[var(--stabilo-teks)]" : ""}`}>{nama}, {formatTanggalKalender(tgl)}</h2>
                {baris.length === 0 ? <p className="text-sm text-tinta-2">Tidak ada yang dijadwalkan.</p> : (
                  <ul className="mt-1 text-sm">
                    {baris.map(({ o, s }) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                        <span><span className="font-semibold">{o.nama}</span> <span className="angka">{rentang(s)}</span>{s.istirahat ? `, istirahat ${s.istirahat} menit` : ""}
                          {s.lembur && <span className="text-tinta-2"> (lembur {s.lembur === "menunggu" ? "menunggu persetujuan" : s.lembur === "setuju" ? "disetujui" : "tidak bisa"})</span>}</span>
                        {kelola && s.id && s.tanggal >= hari && <FormBatalShift shift={s.id} label={`${o.nama} ${nama} ${rentang(s)}`} />}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          <table className="mt-4 w-full border-t border-garis text-sm" data-testid="total-jam">
            <caption className="sr-only">Total jam seminggu</caption>
            <thead><tr><th scope="col" className="py-2 text-left font-semibold">Orang</th><th scope="col" className="py-2 text-right font-semibold">Jam minggu ini</th></tr></thead>
            <tbody>{m.orang.filter((o) => o.menit > 0).map((o) => (
              <tr key={o.id} className="border-t border-garis"><td className="py-1">{o.nama}</td><td className="angka py-1 text-right">{jam(o.menit)}{o.menit > 2400 ? " (lewat 40 jam)" : ""}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

async function Staf({ hari }: { hari: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("jadwal_saya", { p_mulai: null });
  if (error || !data) return <p className="mt-6 text-tinta-2">Akunmu belum tertaut ke data orang di usaha ini. Minta pemilik menautkannya.</p>;
  const d = data as Saya;
  return (
    <>
      {d.lembur.map((l) => (
        <div key={l.id} className="mt-4 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="minta-lembur">
          <p className="font-semibold">Lembur {formatTanggalKalender(l.tanggal)}, {jam(l.menit)}</p>
          <p className="text-sm text-tinta-2">Lembur hanya bila kamu setuju. Tidak bisa juga boleh, tanpa alasan.</p>
          <FormLembur lembur={l.id} label={`Jawab lembur ${formatTanggalKalender(l.tanggal)}`} />
        </div>
      ))}
      {d.shift.length === 0 ? <p className="mt-6 text-tinta-2" data-testid="jadwal-kosong">Belum ada jadwal untukmu dua minggu ini.</p> : (
        <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="jadwal-saya">
          {d.shift.map((s, i) => (
            <li key={i} className="flex justify-between gap-2 py-2">
              <span className={s.tanggal === hari ? "bg-kunyit px-1 text-[var(--stabilo-teks)]" : ""}>{formatTanggalKalender(s.tanggal)}</span>
              <span className="angka">{rentang(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/jadwal">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const sp = await searchParams;
  const minggu = typeof sp.minggu === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.minggu) ? sp.minggu : null;
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  if (sesi.peran === "staf") return <Staf hari={hari} />;
  return <Pengelola minggu={minggu} kelola={sesi.peran === "pemilik" || sesi.peran === "admin"} hari={hari} />;
}

export default function Jadwal(props: PageProps<"/app/jadwal">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Jadwal</h1>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
