import type { Metadata } from "next";
import { Suspense } from "react";
import { FormAturJanji, FormKatalog, FormLayananJanji, FormPoin, FormTukar, TombolStatusJanji } from "@/components/app/janji";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Janji temu, katalog, dan poin" };

type T = Kamus["janji"];
type Janji = { id: string; kode: string; mulai: string; nama: string; hp: string | null; catatan: string | null; status: keyof T["status"]; appointment_service: { nama: string } | null };
type Poin = { pelanggan: string; belanja: number; dapat: number; ditukar: number; sisa: number };
const judul = "text-lg font-semibold";

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).janji;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/janji-temu" judul={t.judul} ket={t.hanya} /></div>;
  }
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const supabase = await createClient();
  const sejak = new Date(new Date().getTime() - 86_400_000).toISOString();
  const [bs, sv, ap, cs, ls, lp] = await Promise.all([
    supabase.from("booking_setting").select("kunci, aktif, jam_mulai, jam_selesai, hari_buka, jeda_menit").maybeSingle(),
    supabase.from("appointment_service").select("id, nama, durasi_menit, harga").eq("aktif", true).order("nama"),
    supabase.from("appointment").select("id, kode, mulai, nama, hp, catatan, status, appointment_service(nama)").gte("mulai", sejak).order("mulai").limit(100),
    supabase.from("catalog_setting").select("kunci, aktif, wa").maybeSingle(),
    supabase.from("loyalty_setting").select("rp_per_poin").maybeSingle(),
    supabase.rpc("loyalty_points"),
  ]);
  const atur = bs.data as { kunci: string; aktif: boolean; jam_mulai: string; jam_selesai: string; hari_buka: number[]; jeda_menit: number } | null;
  const layanan = (sv.data ?? []) as { id: string; nama: string; durasi_menit: number; harga: number }[];
  const janji = (ap.data ?? []) as unknown as Janji[];
  const kat = cs.data as { kunci: string; aktif: boolean; wa: string } | null;
  const poin = (lp.data ?? []) as Poin[];
  const waktu = (iso: string) => new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { timeZone: zona, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)).replace(/(\d{2}):(\d{2})/, "$1.$2");

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/janji-temu" judul={t.judul} ket={t.ket} />

      <section className="mt-8" aria-labelledby="judul-jadwal">
        <h2 id="judul-jadwal" className={judul}>{t.jadwalJudul}</h2>
        {janji.length === 0 ? <p className="mt-2 text-sm text-tinta-2" data-testid="janji-kosong">{t.jadwalKosong}</p> : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-janji">
            {janji.map((j) => (
              <li key={j.id} className="flex flex-wrap items-start justify-between gap-2 py-3" data-nama={j.nama} data-status={j.status}>
                <div>
                  <p className="font-semibold"><span data-pengguna>{j.nama}</span>, <span data-pengguna>{j.appointment_service?.nama}</span></p>
                  <p className="text-tinta-2">{waktu(j.mulai)} <span className="angka">{j.kode}</span>{j.hp ? <>, <span data-pengguna>+{j.hp}</span></> : null}</p>
                  {j.catatan && <p className="text-tinta-2" data-pengguna>{j.catatan}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Cap jenis={j.status === "datang" ? "diterima" : j.status === "batal" ? "ditolak" : "menunggu"} label={t.status[j.status]} />
                  {j.status === "dipesan" && <><TombolStatusJanji id={j.id} status="datang" label={`${t.tandaiDatang}: ${j.nama}`} teks={t.tandaiDatang} /><TombolStatusJanji id={j.id} status="batal" label={`${t.batalkan}: ${j.nama}`} teks={t.batalkan} /></>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-atur-janji">
        <h2 id="judul-atur-janji" className={judul}>{t.aturJudul}</h2>
        {atur ? <p className="mt-2 break-all text-sm"><span className="text-tinta-2">{t.tautan}: </span><a href={`/janji/${atur.kunci}`} className="angka text-laut underline underline-offset-2" data-testid="tautan-janji">/janji/{atur.kunci}</a></p>
          : <p className="mt-2 text-sm text-tinta-2">{t.belumAktif}</p>}
        <FormAturJanji awal={atur} teks={t} />
        <h3 className="mt-6 font-semibold">{t.layananJudul}</h3>
        {layanan.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.belumLayanan}</p> : (
          <ul className="mt-2 text-sm" data-testid="daftar-layanan-janji">{layanan.map((l) => <li key={l.id}><span data-pengguna>{l.nama}</span>, <span className="angka">{l.durasi_menit}</span> {bahasa === "en" ? "min" : "menit"}, <Rupiah nilai={l.harga} bahasa={bahasa} /></li>)}</ul>
        )}
        <FormLayananJanji teks={t} />
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-katalog">
        <h2 id="judul-katalog" className={judul}>{t.katalogJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.katalogKet}</p>
        {kat && <p className="mt-2 break-all text-sm"><span className="text-tinta-2">{t.tautanKatalog}: </span><a href={`/katalog/${kat.kunci}`} className="angka text-laut underline underline-offset-2" data-testid="tautan-katalog">/katalog/{kat.kunci}</a></p>}
        <FormKatalog awal={kat} teks={t} />
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-poin">
        <h2 id="judul-poin" className={judul}>{t.poinJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.poinKet}</p>
        <FormPoin rp={(ls.data as { rp_per_poin: number } | null)?.rp_per_poin ?? null} teks={t} />
        {poin.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.poinKosong}</p> : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-poin">
            {poin.slice(0, 50).map((p) => (
              <li key={p.pelanggan} className="py-3" data-pelanggan={p.pelanggan}>
                <p className="flex flex-wrap justify-between gap-2"><span className="font-semibold" data-pengguna>{p.pelanggan}</span><span><span className="text-tinta-2">{t.belanja}</span> <Rupiah nilai={p.belanja} bahasa={bahasa} /></span></p>
                <p className="text-tinta-2">{t.dapat} <span className="angka">{p.dapat}</span>, {t.ditukar} <span className="angka">{p.ditukar}</span>, {t.sisa} <span className="angka font-semibold text-tinta" data-testid="sisa-poin">{p.sisa}</span></p>
                {p.sisa > 0 && <FormTukar pelanggan={p.pelanggan} teks={t} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function HalamanJanji() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi />
      </Suspense>
    </main>
  );
}
