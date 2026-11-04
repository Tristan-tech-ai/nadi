import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormPengumuman, TombolBaca } from "@/components/app/hr";
import { Cap } from "@/components/ui/cap";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pengumuman" };

type Pengumuman = { id: string; judul: string; isi: string; untuk_peran: string[] | null; dibuat_at: string };

// M-11: pengumuman untuk anggota usaha + tanda baca. Staf juga melihat profil kerja dan surat peringatannya sendiri (RLS).
async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).hr;
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: pg }, { data: baca }, ringkas, { data: pf }, { data: sp }] = await Promise.all([
    supabase.from("pengumuman").select("id, judul, isi, untuk_peran, dibuat_at").order("dibuat_at", { ascending: false }).limit(30),
    supabase.from("pengumuman_baca").select("pengumuman_id").eq("user_id", user?.id ?? ""),
    pengelola ? supabase.rpc("ringkas_pengumuman") : Promise.resolve({ data: [] }),
    pengelola ? Promise.resolve({ data: [] }) : supabase.from("profil_kerja").select("jabatan, level, departemen, status_kerja, kontrak_sampai").limit(1),
    pengelola ? Promise.resolve({ data: [] }) : supabase.from("surat_peringatan").select("id, tingkat, terakhir, tanggal, berlaku_sampai, pelanggaran").order("tanggal", { ascending: false }).order("dibuat_at", { ascending: false }),
  ]);
  const sudah = new Set(((baca ?? []) as { pengumuman_id: string }[]).map((b) => b.pengumuman_id));
  const angka = new Map(((ringkas.data ?? []) as { id: string; sasaran: number; dibaca: number }[]).map((r) => [r.id, r]));
  const daftar = (pg ?? []) as Pengumuman[];
  const profil = ((pf ?? []) as { jabatan: string | null; level: string | null; departemen: string | null; status_kerja: string | null; kontrak_sampai: string | null }[])[0];
  const peringatan = (sp ?? []) as { id: string; tingkat: number; terakhir: boolean; tanggal: string; berlaku_sampai: string; pelanggaran: string }[];
  return (
    <div lang={bahasa}>
      <h1 className="text-2xl font-semibold">{t.pengumumanJudul}</h1>
      {daftar.length === 0 ? (
        <p className="mt-4 text-tinta-2" data-testid="pengumuman-kosong">{t.pengumumanKosong}</p>
      ) : (
        <ul className="mt-4 divide-y divide-garis border-y border-garis" data-testid="daftar-pengumuman">
          {daftar.map((p) => (
            <li key={p.id} className="py-4" data-judul={p.judul}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold" data-pengguna>{p.judul}</h2>
                <span className="text-sm text-tinta-2">{formatTanggalKalender(hariIni(new Date(p.dibuat_at), zona), bahasa)}</span>
              </div>
              <p className="mt-1 whitespace-pre-line" data-pengguna>{p.isi}</p>
              {pengelola ? (
                <p className="mt-2 text-sm text-tinta-2" data-testid="jumlah-baca">{isiTeks(t.sudahBaca, { a: angka.get(p.id)?.dibaca ?? 0, b: angka.get(p.id)?.sasaran ?? 0 })}</p>
              ) : sudah.has(p.id) ? (
                <p className="mt-2 text-sm text-daun">{t.sudahKamuBaca}</p>
              ) : (
                <TombolBaca id={p.id} judul={p.judul} teks={t} />
              )}
            </li>
          ))}
        </ul>
      )}
      {pengelola && (
        <section className="mt-8" aria-labelledby="judul-tulis-pengumuman">
          <h2 id="judul-tulis-pengumuman" className="text-lg font-semibold">{t.tulisPengumuman}</h2>
          <FormPengumuman kunci={randomUUID()} teks={t} />
          <p className="mt-6 text-sm"><a href="/app/orang/kerja" className="underline underline-offset-4">{t.judul}</a></p>
        </section>
      )}
      {!pengelola && (
        <section className="mt-8 border-t border-garis pt-6" aria-labelledby="judul-kerjaku" data-testid="kerjaku">
          <h2 id="judul-kerjaku" className="text-lg font-semibold">{t.kerjakuJudul}</h2>
          {profil?.jabatan ? (
            <p className="mt-2">{profil.jabatan}{profil.level ? ` (${profil.level})` : ""}{profil.departemen ? `, ${profil.departemen}` : ""}{profil.status_kerja ? `, ${t.statusNama[profil.status_kerja as keyof typeof t.statusNama] ?? profil.status_kerja}` : ""}{profil.kontrak_sampai ? `, ${isiTeks(t.kontrakHingga, { t: formatTanggalKalender(profil.kontrak_sampai, bahasa) })}` : ""}</p>
          ) : (
            <p className="mt-2 text-tinta-2">{t.kerjakuKosong}</p>
          )}
          {peringatan.length > 0 && (
            <ul className="mt-4 divide-y divide-garis border-y border-garis text-sm" data-testid="sp-saya">
              {peringatan.map((s) => (
                <li key={s.id} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{s.terakhir ? t.spTerakhir : isiTeks(t.spKe, { n: s.tingkat })}</span>
                    <Cap jenis="menunggu" label={isiTeks(t.berlakuSampai, { t: formatTanggalKalender(s.berlaku_sampai, bahasa) })} />
                  </div>
                  <p className="mt-1" data-pengguna>{s.pelanggaran}</p>
                </li>
              ))}
            </ul>
          )}
          {peringatan.length > 0 && <p className="mt-2 text-xs text-tinta-2">{t.spBanding}</p>}
        </section>
      )}
    </div>
  );
}

export default function HalamanPengumuman() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
