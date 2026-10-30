import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { LogoNadi } from "@/components/ui/logo";
import { wajibSesi } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { FormIzin } from "./form-izin";
import { periksaPermintaan } from "./periksa";

export const metadata: Metadata = { title: "Izinkan asisten AI", robots: { index: false } };

async function Isi({ searchParams }: { searchParams: PageProps<"/oauth/izinkan">["searchParams"] }) {
  const sesi = await wajibSesi();
  const sp = await searchParams;
  const supabase = await createClient();
  const v = await periksaPermintaan(sp, await headers(), supabase);
  if (!v.ok) {
    return (
      <>
        <h1 className="mt-10 font-judul text-3xl font-extrabold leading-tight tracking-tight">Tautan izin tidak bisa dipakai</h1>
        <p role="alert" className="mt-3 text-tinta-2">{v.pesan} Mulai lagi dari aplikasi asisten AI-mu.</p>
        <Link href="/app" className="mt-6 inline-block font-semibold underline underline-offset-4">Kembali ke Nadi</Link>
      </>
    );
  }
  const { data } = await supabase.from("anggota").select("perusahaan_id, peran, perusahaan(nama)").eq("user_id", sesi.userId).eq("aktif", true);
  const usaha = ((data ?? []) as unknown as { perusahaan_id: string; peran: string; perusahaan: { nama: string } | null }[])
    .map((a) => ({ id: a.perusahaan_id, nama: a.perusahaan?.nama ?? "Usaha", peran: a.peran }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  const q = Object.fromEntries(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
  const { p } = v;
  return (
    <>
      <h1 className="mt-10 font-judul text-3xl font-extrabold leading-tight tracking-tight">Izinkan {p.namaKlien} memakai Nadi?</h1>
      <p className="mt-2 text-tinta-2">
        Aplikasi dari <span className="font-mono text-sm text-tinta">{p.hostKlien}</span> ingin bekerja atas namamu. Ia hanya bisa melakukan yang boleh dilakukan peranmu.
      </p>
      <div className="mt-8">
        {usaha.length === 0 ? (
          <p role="alert" className="text-tinta-2">Kamu belum tergabung di usaha mana pun. <Link href="/app/mulai" className="font-semibold text-tinta underline underline-offset-4">Buat usaha dulu</Link>, lalu ulangi dari aplikasi asistenmu.</p>
        ) : (
          <FormIzin q={q} usaha={usaha} aktif={sesi.perusahaanId} mintaUsul={p.cakupan.includes("nadi.usul")} hostKembali={new URL(p.redirectUri).host} />
        )}
      </div>
    </>
  );
}

export default function Izinkan(props: PageProps<"/oauth/izinkan">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-10 pb-16">
      <Link href="/" aria-label="Beranda Nadi" className="self-start">
        <LogoNadi />
      </Link>
      <Suspense fallback={<div className="mt-10 h-80 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
