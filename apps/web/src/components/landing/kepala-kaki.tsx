import Link from "next/link";
import { PemilihBahasa } from "@/components/landing/pemilih-bahasa";
import { LogoNadi } from "@/components/ui/logo";
import { awalanJalur, type Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";

// Kepala dan kaki situs publik (landing dan halaman pendukung D-15), dua bahasa (I-02, I-03). Tautan ke halaman
// yang punya versi Inggris memakai awalanJalur; demo, masuk, dan daftar tetap berbahasa Indonesia.
export function KepalaSitus({ bahasa = "id" }: { bahasa?: Bahasa }) {
  const k = ambilKamus(bahasa).kepala;
  const akar = awalanJalur(bahasa) || "/";
  const nav = [
    { href: `${akar}#hari`, label: k.nav.hari },
    { href: `${akar}#peran`, label: k.nav.peran },
    { href: `${awalanJalur(bahasa)}/harga`, label: k.nav.harga },
    { href: `${awalanJalur(bahasa)}/keamanan`, label: k.nav.keamanan },
    { href: `${awalanJalur(bahasa)}/panduan`, label: k.nav.panduan },
  ];
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pt-6">
      <Link href={akar} aria-label={k.beranda}>
        <LogoNadi />
      </Link>
      <nav aria-label={k.navUtama} className="hidden items-center gap-6 text-sm font-semibold text-tinta-2 lg:flex">
        {nav.map((n) => (
          <Link key={n.label} href={n.href} className="hover:text-tinta">{n.label}</Link>
        ))}
      </nav>
      <div className="flex items-center gap-4 text-sm font-semibold">
        <PemilihBahasa bahasa={bahasa} />
        <Link href="/masuk" className="underline-offset-4 hover:underline">{k.masuk}</Link>
        <Link href="/demo" className="hidden h-10 items-center rounded-[var(--radius-isian)] border border-tinta px-4 transition-[background-color] duration-150 hover:bg-kertas-2 sm:inline-flex">
          {k.cobaContoh}
        </Link>
      </div>
    </header>
  );
}

export function KakiSitus({ bahasa = "id" }: { bahasa?: Bahasa }) {
  const k = ambilKamus(bahasa).kaki;
  return (
    <footer className="mx-auto w-full max-w-6xl border-t border-garis px-5 py-10 text-sm text-tinta-2">
      <div className="grid gap-8 sm:grid-cols-3">
        <div>
          <LogoNadi />
          <p className="mt-3 max-w-xs">{k.slogan}</p>
        </div>
        <nav aria-label={k.produk} className="flex flex-col gap-2">
          <p className="font-semibold text-tinta">{k.produk}</p>
          <Link href="/demo" className="hover:text-tinta">{k.contohMakanan}</Link>
          <Link href="/demo/toko" className="hover:text-tinta">{k.contohToko}</Link>
          <Link href={`${awalanJalur(bahasa)}/panduan`} className="hover:text-tinta">{k.panduan}</Link>
          <Link href={`${awalanJalur(bahasa)}/harga`} className="hover:text-tinta">{k.harga}</Link>
          <Link href={`${awalanJalur(bahasa)}/tentang`} className="hover:text-tinta">{k.tentang}</Link>
        </nav>
        <nav aria-label={k.akun} className="flex flex-col gap-2">
          <p className="font-semibold text-tinta">{k.akun}</p>
          <Link href="/daftar" className="hover:text-tinta">{k.buatAkun}</Link>
          <Link href="/masuk" className="hover:text-tinta">{k.masuk}</Link>
          <Link href="/masuk/staf" className="hover:text-tinta">{k.masukStaf}</Link>
          <Link href={`${awalanJalur(bahasa)}/keamanan`} className="hover:text-tinta">{k.keamanan}</Link>
          <Link href={`${awalanJalur(bahasa)}/privasi`} className="hover:text-tinta">{k.privasi}</Link>
          <Link href={`${awalanJalur(bahasa)}/syarat`} className="hover:text-tinta">{k.syarat}</Link>
        </nav>
      </div>
      <p className="mt-10">© 2026 Nadi</p>
    </footer>
  );
}
