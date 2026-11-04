import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { CentangPeriksa, FormMulaiPeriksa, FormProfil, FormSp } from "@/components/app/hr";
import { Cap } from "@/components/ui/cap";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Administrasi orang" };

type Profil = { orang_id: string; jabatan: string | null; level: string | null; departemen: string | null; atasan_id: string | null; status_kerja: string | null; kontrak_sampai: string | null };
type Sp = { id: string; orang_id: string; tingkat: number; terakhir: boolean; tanggal: string; berlaku_sampai: string; pelanggaran: string };
type Periksa = { id: string; orang_id: string; jenis: string; urutan: number; butir: string; selesai_at: string | null };
type Riwayat = { id: string; orang_id: string; berlaku_dari: string; jenis: string; jabatan: string | null; level: string | null };

/** Bagan organisasi dari atasan langsung; orang tanpa atasan (atau atasannya tidak aktif) di puncak. */
function Bagan({ induk, anak, nama, profil, t }: { induk: string; anak: Map<string, string[]>; nama: Map<string, string>; profil: Map<string, Profil>; t: Kamus["hr"] }) {
  const p = profil.get(induk);
  const bawah = anak.get(induk) ?? [];
  return (
    <li className="mt-2">
      <p><span className="font-semibold" data-pengguna>{nama.get(induk)}</span>{p?.jabatan ? <span className="text-tinta-2">, {p.jabatan}{p.level ? ` (${p.level})` : ""}</span> : <span className="text-tinta-2">, {t.belumDiisi}</span>}</p>
      {bawah.length > 0 && <ul className="ml-4 border-l border-garis pl-3">{bawah.map((b) => <Bagan key={b} induk={b} anak={anak} nama={nama} profil={profil} t={t} />)}</ul>}
    </li>
  );
}

const tingkatSp = (s: Sp, t: Kamus["hr"]) => (s.terakhir ? t.spTerakhir : isiTeks(t.spKe, { n: s.tingkat }));

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).hr;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") return <p className="mt-6">{t.hanyaPengelola}</p>;
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const supabase = await createClient();
  const [{ data: org }, { data: pf }, { data: sp }, { data: dp }, { data: rw }] = await Promise.all([
    supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama"),
    supabase.from("profil_kerja").select("orang_id, jabatan, level, departemen, atasan_id, status_kerja, kontrak_sampai"),
    supabase.from("surat_peringatan").select("id, orang_id, tingkat, terakhir, tanggal, berlaku_sampai, pelanggaran").order("tanggal", { ascending: false }).order("dibuat_at", { ascending: false }).limit(50),
    supabase.from("daftar_periksa").select("id, orang_id, jenis, urutan, butir, selesai_at").order("urutan"),
    supabase.from("riwayat_kerja").select("id, orang_id, berlaku_dari, jenis, jabatan, level").order("berlaku_dari", { ascending: false }).limit(30),
  ]);
  const orang = (org ?? []) as { id: string; nama: string }[];
  const nama = new Map(orang.map((o) => [o.id, o.nama]));
  const profil = new Map(((pf ?? []) as Profil[]).map((p) => [p.orang_id, p]));
  const anak = new Map<string, string[]>();
  const puncak: string[] = [];
  for (const o of orang) {
    const a = profil.get(o.id)?.atasan_id;
    if (a && nama.has(a)) anak.set(a, [...(anak.get(a) ?? []), o.id]);
    else puncak.push(o.id);
  }
  const periksa = new Map<string, Periksa[]>();
  for (const x of (dp ?? []) as Periksa[]) periksa.set(`${x.orang_id}|${x.jenis}`, [...(periksa.get(`${x.orang_id}|${x.jenis}`) ?? []), x]);
  const judul = "text-lg font-semibold";
  return (
    <div lang={bahasa}>
      <h1 className="text-2xl font-semibold">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>

      <section className="mt-8" aria-labelledby="judul-bagan" data-testid="bagan">
        <h2 id="judul-bagan" className={judul}>{t.baganJudul}</h2>
        {orang.length === 0 ? <p className="mt-2 text-tinta-2">{t.kosong}</p> : <ul className="mt-1 text-sm">{puncak.map((p) => <Bagan key={p} induk={p} anak={anak} nama={nama} profil={profil} t={t} />)}</ul>}
      </section>

      <section className="mt-8 border-t border-garis pt-6" aria-labelledby="judul-profil">
        <h2 id="judul-profil" className={judul}>{t.profilJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.profilKet}</p>
        <FormProfil orang={orang} teks={t} />
        {(rw ?? []).length > 0 && (
          <ul className="mt-4 divide-y divide-garis border-y border-garis text-sm" data-testid="riwayat-kerja">
            {((rw ?? []) as Riwayat[]).map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><span data-pengguna>{nama.get(r.orang_id) ?? "-"}</span>: {t.jenisNama[r.jenis as keyof Kamus["hr"]["jenisNama"]] ?? r.jenis}{r.jabatan ? `, ${r.jabatan}` : ""}{r.level ? ` (${r.level})` : ""}</span>
                <span className="text-tinta-2">{formatTanggalKalender(r.berlaku_dari, bahasa)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 border-t border-garis pt-6" aria-labelledby="judul-sp">
        <h2 id="judul-sp" className={judul}>{t.spJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.spKet}</p>
        <FormSp orang={orang} kunci={randomUUID()} hari={hari} teks={t} />
        {(sp ?? []).length > 0 && (
          <ul className="mt-4 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-sp">
            {((sp ?? []) as Sp[]).map((s) => {
              const aktif = s.berlaku_sampai >= hari;
              return (
                <li key={s.id} className="py-3" data-orang={nama.get(s.orang_id)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold"><span data-pengguna>{nama.get(s.orang_id) ?? "-"}</span>, {tingkatSp(s, t)}</span>
                    <Cap jenis={aktif ? "menunggu" : "diterima"} label={aktif ? t.berlaku : t.lewat} />
                  </div>
                  <p className="mt-1 text-tinta-2">{isiTeks(t.spMasa, { dari: formatTanggalKalender(s.tanggal, bahasa), sampai: formatTanggalKalender(s.berlaku_sampai, bahasa) })}</p>
                  <p className="mt-1" data-pengguna>{s.pelanggaran}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8 border-t border-garis pt-6" aria-labelledby="judul-periksa">
        <h2 id="judul-periksa" className={judul}>{t.periksaJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.periksaKet}</p>
        <FormMulaiPeriksa orang={orang} teks={t} />
        {[...periksa.entries()].map(([k, daftar]) => {
          const [oid, jenis] = k.split("|");
          const selesai = daftar.filter((d) => d.selesai_at).length;
          return (
            <div key={k} className="mt-4" data-testid="daftar-periksa" data-orang={nama.get(oid)}>
              <p className="text-sm font-semibold"><span data-pengguna>{nama.get(oid) ?? "-"}</span>, {jenis === "onboarding" ? t.onboarding : t.offboarding}: {isiTeks(t.periksaProgres, { a: selesai, b: daftar.length })}</p>
              <ul className="mt-1 text-sm">{daftar.map((d) => <li key={d.id}><CentangPeriksa id={d.id} butir={d.butir} selesai={Boolean(d.selesai_at)} /></li>)}</ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default function HalamanKerjaOrang() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
