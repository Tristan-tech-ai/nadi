import { Suspense } from "react";
import Link from "next/link";
import { keluar } from "@/app/auth-actions";
import { Kerangka } from "@/components/app/kerangka";
import { TombolCari } from "@/components/app/cari-fitur";
import { teksCari } from "@/lib/cari-teks";
import { ruangDanMati } from "@/lib/ruang-sesi";
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
function TautanKepala({ lompat, beranda, cari, lang }: { lompat: string; beranda: string; cari: string; lang?: string }) {
  return (
    <>
      <a href="#isi" className="lompat-isi" lang={lang}>{lompat}</a>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-garis bg-kertas px-4 py-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/app" aria-label={beranda} lang={lang}>
            <TandaNadi ukuran={26} />
          </Link>
          <TombolCari label={cari} />
        </div>
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
  return <TautanKepala lompat={t.lompat} beranda={t.beranda} cari={bahasa === "en" ? "Search" : "Cari"} lang={bahasa} />;
}

async function Navigasi() {
  const sesi = await bacaSesi();
  if (!sesi?.peran) return null;
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const { ruang, mati } = await ruangDanMati(sesi.peran, sesi.perusahaanId);
  const en = bahasa === "en";
  return <Kerangka ruang={ruang} mati={mati} peran={sesi.peran} bahasa={bahasa}
    teks={{ navUtama: ambilKamus(bahasa).aplikasi.navUtama, menu: "Menu", tutup: en ? "Close" : "Tutup", semuaMenu: en ? "All menus" : "Semua menu",
      peta: en ? "All menus, with what each does" : "Semua menu dan gunanya", cari: teksCari(bahasa) }} />;
}

export default function LayoutApp({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* WCAG 2.4.1: kepala dan navigasi berulang di setiap layar; tautan pertama melompati kepala langsung ke isi. */}
      <Suspense fallback={<TautanKepala lompat={ambilKamus("id").aplikasi.lompat} beranda={ambilKamus("id").aplikasi.beranda} cari="Cari" />}>
        <Kepala />
      </Suspense>
      <div id="isi" tabIndex={-1} className="kerangka-isi flex flex-1 flex-col focus:outline-none min-[600px]:pl-20 min-[1200px]:pl-64 print:pl-0">{children}</div>
      <Suspense fallback={<div className="h-14 border-t border-garis" aria-hidden />}>
        <Navigasi />
      </Suspense>
    </div>
  );
}
