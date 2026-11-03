import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormAmbil, FormBatalShift, FormBatalTawaran, FormHentiKebutuhan, FormKebutuhan, FormLembur, FormSalin, FormShift, FormTawarkan, PenyusunJadwal } from "@/components/app/jadwal";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { hariIni } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Jadwal" };

// F3-06 (docs/design/jadwal-shift.md): jadwal shift per minggu. Batas PP 35/2021 dijaga simpan_shift; lembur butuh persetujuan.

type Shift = { id?: string; tanggal: string; mulai: string; selesai: string; istirahat: number; lembur?: string | null; bisa_ditawarkan?: boolean; tawaran?: "terbuka" | "diambil" | null };
type Tawaran = { untuk: { id: string; tanggal: string; mulai: string; selesai: string; dari: string; topi: string | null }[]; milik: { id: string; shift_id: string; status: "terbuka" | "diambil"; tanggal: string; mulai: string; selesai: string; diambil: string | null }[] };
type Minggu = { mulai: string; pola_kerja: string; orang: { id: string; nama: string; menit: number; shift: Shift[] }[] };
type Saya = { mulai: string; shift: Shift[]; lembur: { id: string; tanggal: string; menit: number }[] };

type K = { t: Kamus["jadwal"]; f: Kamus["jadwalForm"]; bahasa: Bahasa };
const geser = (t: string, n: number) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const jam = (menit: number, t: Kamus["jadwal"]) => `${isiTeks(t.jamSaja, { j: Math.floor(menit / 60) })}${menit % 60 ? isiTeks(t.menitSaja, { m: menit % 60 }) : ""}`;
const rentang = (s: { mulai: string; selesai: string }) => `${s.mulai.replace(":", ".")}-${s.selesai.replace(":", ".")}`;

async function Pengelola({ minggu, kelola, hari, k: { t, f, bahasa } }: { minggu: string | null; kelola: boolean; hari: string; k: K }) {
  const tgl = (x: string) => formatTanggalKalender(x, bahasa);
  const supabase = await createClient();
  const [{ data, error }, topi, keb] = await Promise.all([
    supabase.rpc("jadwal_minggu", { p_mulai: minggu }),
    kelola ? supabase.from("topi").select("id, nama").eq("aktif", true).order("nama") : Promise.resolve({ data: [] }),
    kelola ? supabase.from("kebutuhan_shift").select("id, hari, mulai, selesai, butuh, istirahat_menit, topi:topi_id(nama)").eq("aktif", true).order("hari").order("mulai")
      : Promise.resolve({ data: [] }),
  ]);
  if (error || !data) return <p role="alert" className="mt-6 text-cap">{t.gagalMuat}</p>;
  const kebutuhan = (keb.data ?? []) as unknown as { id: string; hari: number; mulai: string; selesai: string; butuh: number; istirahat_menit: number; topi: { nama: string } | null }[];
  const m = data as Minggu;
  const ada = m.orang.some((o) => o.shift.length);
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={`/app/jadwal?minggu=${geser(m.mulai, -7)}`} className="underline underline-offset-4">{t.mingguSebelum}</Link>
        <p className="font-semibold">{isiTeks(t.rentangMinggu, { a: tgl(m.mulai), b: tgl(geser(m.mulai, 6)) })}</p>
        <Link href={`/app/jadwal?minggu=${geser(m.mulai, 7)}`} className="underline underline-offset-4">{t.mingguBerikut}</Link>
      </div>
      <p className="mt-1 text-sm text-tinta-2">{m.pola_kerja === "5_hari" ? t.pola5 : t.pola6}{t.polaLanjut}</p>
      {kelola && <div className="mt-4"><FormSalin minggu={m.mulai} teks={f} /></div>}
      {kelola && <PenyusunJadwal minggu={m.mulai} teks={f} hari={t.hari} bahasa={bahasa} />}
      {kelola && <FormShift orang={m.orang.map((o) => ({ id: o.id, nama: o.nama }))} awal={m.mulai >= hari ? m.mulai : hari} kunci={randomUUID()} teks={f} />}
      {!ada ? (
        <p className="mt-6 text-tinta-2" data-testid="jadwal-kosong">{t.kosong}</p>
      ) : (
        <div className="mt-6" data-testid="jadwal-minggu">
          {t.hari.map((nama, i) => {
            const tanggal = geser(m.mulai, i);
            const baris = m.orang.flatMap((o) => o.shift.filter((s) => s.tanggal === tanggal).map((s) => ({ o, s })));
            return (
              <section key={tanggal} className="border-t border-garis py-3" aria-label={`${nama} ${tgl(tanggal)}`}>
                <h2 className={`font-semibold ${tanggal === hari ? "inline-block bg-kunyit px-1 text-[var(--stabilo-teks)]" : ""}`}>{nama}, {tgl(tanggal)}</h2>
                {baris.length === 0 ? <p className="text-sm text-tinta-2">{t.tidakAda}</p> : (
                  <ul className="mt-1 text-sm">
                    {baris.map(({ o, s }) => (
                      <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                        <span><span className="font-semibold" data-pengguna>{o.nama}</span> <span className="angka">{rentang(s)}</span>{s.istirahat ? isiTeks(t.istirahat, { n: s.istirahat }) : ""}
                          {s.lembur && s.lembur !== "batal" && <span className="text-tinta-2">{isiTeks(t.lembur, { status: s.lembur === "menunggu" ? t.lemburStatus.menunggu : s.lembur === "setuju" ? t.lemburStatus.setuju : t.lemburStatus.tidak })}</span>}</span>
                        {kelola && s.id && s.tanggal >= hari && <FormBatalShift shift={s.id} label={`${o.nama} ${nama} ${rentang(s)}`} teks={f} />}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
          <table className="mt-4 w-full border-t border-garis text-sm" data-testid="total-jam">
            <caption className="sr-only">{t.totalJam}</caption>
            <thead><tr><th scope="col" className="py-2 text-left font-semibold">{t.orang}</th><th scope="col" className="py-2 text-right font-semibold">{t.jamMinggu}</th></tr></thead>
            <tbody>{m.orang.filter((o) => o.menit > 0).map((o) => (
              <tr key={o.id} className="border-t border-garis"><td className="py-1" data-pengguna>{o.nama}</td><td className="angka py-1 text-right">{jam(o.menit, t)}{o.menit > 2400 ? t.lewat40 : ""}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {kelola && (
        <section className="mt-8" aria-labelledby="judul-kebutuhan" data-testid="kebutuhan">
          <h2 id="judul-kebutuhan" className="text-lg font-semibold">{t.kebutuhanJudul}</h2>
          <p className="mt-1 text-sm text-tinta-2">{t.kebutuhanKet}</p>
          {kebutuhan.length === 0 ? <p className="mt-2 text-sm text-tinta-2" data-testid="kebutuhan-kosong">{t.kebutuhanKosong}</p> : (
            <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-kebutuhan">
              {kebutuhan.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span>{t.hari[k.hari]} <span className="angka">{rentang({ mulai: k.mulai.slice(0, 5), selesai: k.selesai.slice(0, 5) })}</span>: {k.butuh} <span data-pengguna>{k.topi?.nama.toLowerCase()}</span></span>
                  <FormHentiKebutuhan kebutuhan={k.id} label={`${t.hari[k.hari]} ${k.topi?.nama ?? ""}`} teks={f} />
                </li>
              ))}
            </ul>
          )}
          <FormKebutuhan topi={(topi.data ?? []) as { id: string; nama: string }[]} teks={f} hari={t.hari} />
        </section>
      )}
    </>
  );
}

async function Staf({ hari, k: { t, f, bahasa } }: { hari: string; k: K }) {
  const tgl = (x: string) => formatTanggalKalender(x, bahasa);
  const supabase = await createClient();
  const [{ data, error }, tw] = await Promise.all([supabase.rpc("jadwal_saya", { p_mulai: null }), supabase.rpc("tawaran_saya")]);
  if (error || !data) return <p className="mt-6 text-tinta-2">{t.stafTanpaTaut}</p>;
  const d = data as Saya;
  const tawar = (tw.data ?? { untuk: [], milik: [] }) as Tawaran;
  const punyaku = new Set(d.shift.map((s) => s.id));
  const kuambil = tawar.milik.filter((m) => !punyaku.has(m.shift_id));
  return (
    <>
      {d.lembur.map((l) => (
        <div key={l.id} className="mt-4 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="minta-lembur">
          <p className="font-semibold">{isiTeks(t.lemburJudul, { tanggal: tgl(l.tanggal), jam: jam(l.menit, t) })}</p>
          <p className="text-sm text-tinta-2">{t.lemburKet}</p>
          <FormLembur lembur={l.id} label={isiTeks(t.jawabLembur, { tanggal: tgl(l.tanggal) })} teks={f} />
        </div>
      ))}
      {tawar.untuk.length > 0 && (
        <section className="mt-6" aria-labelledby="judul-tawaran" data-testid="tawaran-untuk">
          <h2 id="judul-tawaran" className="font-semibold">{t.tawaranJudul}</h2>
          {tawar.untuk.map((u) => (
            <div key={u.id} className="mt-2 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="kartu-tawaran">
              <p>{tgl(u.tanggal)}, <span className="angka">{rentang(u)}</span>{u.topi ? <> (<span data-pengguna>{u.topi.toLowerCase()}</span>)</> : ""}.{sisip(t.ditawarkanOleh, { dari: <span data-pengguna>{u.dari}</span> })}</p>
              <FormAmbil tawaran={u.id} label={isiTeks(t.ambilAria, { tanggal: tgl(u.tanggal), dari: u.dari })} teks={f} />
            </div>
          ))}
        </section>
      )}
      {kuambil.map((m) => (
        <p key={m.id} className="mt-4 text-sm" data-testid="tukar-menunggu">
          {sisip(t.kamuAmbil, { tanggal: tgl(m.tanggal), rentang: <span className="angka">{rentang(m)}</span> })}
        </p>
      ))}
      {d.shift.length === 0 ? <p className="mt-6 text-tinta-2" data-testid="jadwal-kosong">{t.stafKosong}</p> : (
        <ul className="mt-6 divide-y divide-garis border-y border-garis" data-testid="jadwal-saya">
          {d.shift.map((s, i) => (
            <li key={s.id ?? i} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="baris-jadwal-saya">
              <span><span className={s.tanggal === hari ? "bg-kunyit px-1 text-[var(--stabilo-teks)]" : ""}>{tgl(s.tanggal)}</span> <span className="angka">{rentang(s)}</span></span>
              <TawaranShift s={s} milik={tawar.milik} k={{ t, f, bahasa }} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TawaranShift({ s, milik, k: { t, f, bahasa } }: { s: Shift; milik: Tawaran["milik"]; k: K }) {
  const m = milik.find((x) => x.shift_id === s.id);
  const label = `${formatTanggalKalender(s.tanggal, bahasa)} ${rentang(s)}`;
  if (s.tawaran === "diambil") return <span className="text-sm text-tinta-2">{sisip(t.diambil, { nama: m?.diambil ? <span data-pengguna>{m.diambil}</span> : t.rekan })}</span>;
  if (s.tawaran === "terbuka" && m) return <span className="flex items-center gap-2 text-sm text-tinta-2">{t.ditawarkan} <FormBatalTawaran tawaran={m.id} label={label} teks={f} /></span>;
  if (s.bisa_ditawarkan && s.id) return <FormTawarkan shift={s.id} kunci={randomUUID()} label={label} teks={f} />;
  return null;
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/jadwal">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const sp = await searchParams;
  const minggu = typeof sp.minggu === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.minggu) ? sp.minggu : null;
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const k: K = { t: kamus.jadwal, f: kamus.jadwalForm, bahasa };
  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{k.t.judul}</h1>
      {sesi.peran === "staf" ? <Staf hari={hari} k={k} /> : <Pengelola minggu={minggu} kelola={sesi.peran === "pemilik" || sesi.peran === "admin"} hari={hari} k={k} />}
    </div>
  );
}

export default function Jadwal(props: PageProps<"/app/jadwal">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense
        fallback={
          <div aria-hidden>
            <div className="h-9 w-36 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" />
            <div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />
          </div>
        }
      >
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
