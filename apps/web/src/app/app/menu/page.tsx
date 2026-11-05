import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";
import { cariFitur } from "@/lib/cari-fitur";
import { teksCari } from "@/lib/cari-teks";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { ruangSesi } from "@/lib/ruang-sesi";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Semua menu" };

// U-02 Semua menu: peta seluruh fitur yang boleh dibuka sesi ini, dikelompokkan per ruang, tiap fitur dengan satu kalimat gunanya.
// Pencarian di sini memakai formulir GET (jalan tanpa JavaScript); dialog Ctrl+K memakai fungsi yang sama.
async function Isi({ searchParams }: { searchParams: PageProps<"/app/menu">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const b: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const ruang = await ruangSesi(sesi.peran);
  const tc = teksCari(b);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const boleh = new Set(ruang.flatMap((r) => r.halaman.map((x) => x.href)));
  const hasil = q.trim().length >= 2 ? cariFitur(q, sesi.peran, b, 8, boleh) : null;
  const nama = Object.fromEntries(ruang.map((r) => [r.id, r.label[b]]));
  const jumlah = boleh.size;
  const en = b === "en";
  return (
    <div lang={b}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{en ? "All menus" : "Semua menu"}</h1>
      <p className="mt-1 max-w-2xl text-sm text-tinta-2">
        {en ? `${jumlah} features in ${ruang.length} spaces. Each line says what the feature is for.` : `${jumlah} fitur dalam ${ruang.length} ruang. Tiap baris menyebut gunanya.`}
      </p>
      <form role="search" action="/app/menu" className="mt-5 flex max-w-xl gap-2">
        <label htmlFor="cari-menu" className="sr-only">{tc.isian}</label>
        <input id="cari-menu" name="q" type="search" defaultValue={q} placeholder={tc.isian} autoComplete="off"
          className="h-11 min-w-0 flex-1 rounded-[var(--radius-isian)] border border-garis bg-kertas px-3 text-base" />
        <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-isian)] bg-tinta px-4 text-sm font-semibold text-kertas">
          <MagnifyingGlassIcon size={18} aria-hidden />{en ? "Search" : "Cari"}
        </button>
      </form>
      {hasil && (
        <section aria-labelledby="hasil-cari" className="mt-5 max-w-xl">
          <h2 id="hasil-cari" className="text-sm font-semibold text-tinta-2">{tc.hasil}</h2>
          {hasil.length === 0 ? <p role="status" className="mt-2 text-sm text-tinta-2">{tc.kosong}</p> : (
            <ul className="mt-2 grid gap-1">{hasil.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="block rounded-[var(--radius-isian)] border border-garis px-3 py-2 hover:bg-kertas-2">
                  <span className="flex items-baseline justify-between gap-3"><span className="font-semibold">{x.label[b]}</span><span className="text-xs text-tinta-2">{nama[x.ruang]}</span></span>
                  <span className="block text-sm text-tinta-2">{x.guna[b]}</span>
                </Link>
              </li>))}</ul>
          )}
        </section>
      )}
      <div className="mt-8 gap-8 min-[840px]:columns-2 min-[1600px]:columns-3">
        {ruang.map((r) => (
          <section key={r.id} aria-labelledby={`menu-${r.id}`} className="mb-8 break-inside-avoid">
            <h2 id={`menu-${r.id}`} className="border-b border-garis pb-1 text-base font-bold">{r.label[b]}</h2>
            <ul className="mt-1">{r.halaman.map((x) => (
              <li key={x.href} className="border-b border-garis/60 last:border-b-0">
                <Link href={x.href} className="block rounded-[var(--radius-isian)] px-2 py-2 hover:bg-kertas-2">
                  <span className="font-semibold">{x.label[b]}</span>
                  <span className="block text-sm text-tinta-2">{x.guna[b]}</span>
                </Link>
              </li>))}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default function HalamanMenu({ searchParams }: PageProps<"/app/menu">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
