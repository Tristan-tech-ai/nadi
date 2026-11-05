import { Suspense } from "react";
import Link from "next/link";
import { keluar } from "@/app/auth-actions";
import { NavBawah } from "@/components/app/nav-bawah";
import { PemilihBahasaApp } from "@/components/app/pemilih-bahasa-app";
import { TandaNadi } from "@/components/ui/logo";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { bacaSesi } from "@/lib/sesi";

// Kepala aplikasi: logo statis langsung tampil, nama perusahaan dan tombol keluar menyusul di balik Suspense.
async function NamaPerusahaan() {
  const sesi = await bacaSesi();
  if (!sesi?.perusahaanId) return null;
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).aplikasi;
  const supabase = await createClient();
  const { data } = await supabase.from("perusahaan").select("nama").eq("id", sesi.perusahaanId).maybeSingle();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link href="/app/perusahaan" className="truncate text-sm font-semibold" data-testid="nama-perusahaan">
        {data?.nama ?? t.usahaCadangan}
      </Link>
      <PemilihBahasaApp bahasa={bahasa} />
      <form action={keluar}>
        <button type="submit" lang={bahasa} className="text-sm text-tinta-2 underline-offset-4 hover:underline">{t.keluar}</button>
      </form>
    </div>
  );
}

/** Tautan lompat dan logo dalam bahasa pengguna; cadangannya (bahasa Indonesia, bentuk sama) tampil sampai bahasa terbaca. */
function TautanKepala({ lompat, beranda, lang }: { lompat: string; beranda: string; lang?: string }) {
  return (
    <>
      <a href="#isi" className="lompat-isi" lang={lang}>{lompat}</a>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-garis bg-kertas px-4 py-3 print:hidden">
        <Link href="/app" aria-label={beranda} lang={lang}>
          <TandaNadi ukuran={26} />
        </Link>
        <Suspense fallback={<span className="h-4 w-32 animate-pulse rounded bg-kertas-2" aria-hidden />}>
          <NamaPerusahaan />
        </Suspense>
      </header>
    </>
  );
}

async function Kepala() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).aplikasi;
  return <TautanKepala lompat={t.lompat} beranda={t.beranda} lang={bahasa} />;
}

async function Navigasi() {
  const sesi = await bacaSesi();
  if (!sesi?.peran) return null;
  // Staf: tautan Magang hanya bila dia mentor atau peserta (RLS rencana_magang hanya memperlihatkan rencananya sendiri).
  let magang = false;
  let ilmu = false;
  if (sesi.peran === "staf") {
    const supabase = await createClient();
    // F3-07C: tautan Rekam ilmu hanya untuk staf yang sedang berhenti dan punya butir ilmu (RLS serah_butir_baca_ilmu_sendiri).
    const [{ count }, { count: nIlmu }] = await Promise.all([
      supabase.from("rencana_magang").select("id", { count: "exact", head: true }),
      supabase.from("serah_butir").select("id", { count: "exact", head: true }).eq("jenis", "ilmu"),
    ]);
    magang = (count ?? 0) > 0;
    ilmu = (nIlmu ?? 0) > 0;
  }
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  return <NavBawah peran={sesi.peran} magang={magang} ilmu={ilmu} teks={ambilKamus(bahasa).aplikasi} lang={bahasa} />;
}

export default function LayoutApp({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* WCAG 2.4.1: kepala dan navigasi berulang di setiap layar; tautan pertama melompati kepala langsung ke isi. */}
      <Suspense fallback={<TautanKepala lompat={ambilKamus("id").aplikasi.lompat} beranda={ambilKamus("id").aplikasi.beranda} />}>
        <Kepala />
      </Suspense>
      <div id="isi" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">{children}</div>
      <Suspense fallback={<div className="h-14 border-t border-garis" aria-hidden />}>
        <Navigasi />
      </Suspense>
    </div>
  );
}
