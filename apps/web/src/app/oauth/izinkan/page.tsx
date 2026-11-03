import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { LogoNadi } from "@/components/ui/logo";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { wajibSesi } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { FormIzin } from "./form-izin";
import { periksaPermintaan } from "./periksa";

export const metadata: Metadata = { title: "Izinkan asisten AI", robots: { index: false } };

async function Isi({ searchParams }: { searchParams: PageProps<"/oauth/izinkan">["searchParams"] }) {
  const sesi = await wajibSesi();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).oauthIzin;
  const sp = await searchParams;
  const supabase = await createClient();
  const v = await periksaPermintaan(sp, await headers(), supabase, t);
  const logo = <Link href="/" aria-label={t.berandaAria} className="self-start"><LogoNadi /></Link>;
  if (!v.ok) {
    return (
      <div lang={bahasa} className="flex flex-col">
        {logo}
        <h1 className="mt-10 font-judul text-3xl font-extrabold leading-tight tracking-tight">{t.tidakBisa}</h1>
        <p role="alert" className="mt-3 text-tinta-2">{v.pesan} {t.mulaiLagi}</p>
        <Link href="/app" className="mt-6 inline-block font-semibold underline underline-offset-4">{t.kembali}</Link>
      </div>
    );
  }
  const { data } = await supabase.from("anggota").select("perusahaan_id, peran, perusahaan(nama)").eq("user_id", sesi.userId).eq("aktif", true);
  const usaha = ((data ?? []) as unknown as { perusahaan_id: string; peran: string; perusahaan: { nama: string } | null }[])
    .map((a) => ({ id: a.perusahaan_id, nama: a.perusahaan?.nama ?? t.usaha, peran: a.peran }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  const q = Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  const { p } = v;
  return (
    <div lang={bahasa} className="flex flex-col">
      {logo}
      <h1 className="mt-10 font-judul text-3xl font-extrabold leading-tight tracking-tight">{sisip(t.judul, { klien: <span data-pengguna>{p.namaKlien}</span> })}</h1>
      <p className="mt-2 text-tinta-2">
        {sisip(t.ket, { host: <span className="font-mono text-sm text-tinta">{p.hostKlien}</span> })}
      </p>
      <div className="mt-8">
        {usaha.length === 0 ? (
          <p role="alert" className="text-tinta-2">{t.belumUsaha} <Link href="/app/mulai" className="font-semibold text-tinta underline underline-offset-4">{t.buatUsaha}</Link>{t.ulangi}</p>
        ) : (
          <FormIzin q={q} usaha={usaha} aktif={sesi.perusahaanId} mintaUsul={p.cakupan.includes("nadi.usul")} hostKembali={new URL(p.redirectUri).host} teks={t} />
        )}
      </div>
    </div>
  );
}

export default function Izinkan(props: PageProps<"/oauth/izinkan">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10 pb-16">
      <Suspense fallback={<div className="mt-10 h-80 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
