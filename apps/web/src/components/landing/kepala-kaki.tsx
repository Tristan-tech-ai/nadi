import Link from "next/link";
import { LogoNadi } from "@/components/ui/logo";

// Kepala dan kaki situs publik (landing dan halaman pendukung D-15).
const NAV = [
  { href: "/#hari", label: "Satu hari" },
  { href: "/#peran", label: "Siapa memakai" },
  { href: "/harga", label: "Harga" },
  { href: "/keamanan", label: "Keamanan" },
  { href: "/panduan", label: "Panduan" },
];

export function KepalaSitus() {
  return (
  <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pt-6">
    <Link href="/" aria-label="Beranda Nadi">
      <LogoNadi />
    </Link>
    <nav aria-label="Utama" className="hidden items-center gap-6 text-sm font-semibold text-tinta-2 lg:flex">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="hover:text-tinta">{n.label}</Link>
      ))}
    </nav>
    <div className="flex items-center gap-4 text-sm font-semibold">
      <Link href="/masuk" className="underline-offset-4 hover:underline">Masuk</Link>
      <Link href="/demo" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-tinta px-4 transition-[background-color] duration-150 hover:bg-kertas-2">
        Coba usaha contoh
      </Link>
    </div>
  </header>
  );
}

export function KakiSitus() {
  return (
  <footer className="mx-auto w-full max-w-6xl border-t border-garis px-5 py-10 text-sm text-tinta-2">
    <div className="grid gap-8 sm:grid-cols-3">
      <div>
        <LogoNadi />
        <p className="mt-3 max-w-xs">Kertas kerja usaha kecil yang mengisi dirinya sendiri.</p>
      </div>
      <nav aria-label="Produk" className="flex flex-col gap-2">
        <p className="font-semibold text-tinta">Produk</p>
        <Link href="/demo" className="hover:text-tinta">Usaha contoh (makanan)</Link>
        <Link href="/demo/toko" className="hover:text-tinta">Usaha contoh (toko)</Link>
        <Link href="/panduan" className="hover:text-tinta">Panduan per peran</Link>
        <Link href="/harga" className="hover:text-tinta">Harga</Link>
        <Link href="/tentang" className="hover:text-tinta">Tentang Nadi</Link>
      </nav>
      <nav aria-label="Akun" className="flex flex-col gap-2">
        <p className="font-semibold text-tinta">Akun</p>
        <Link href="/daftar" className="hover:text-tinta">Buat akun</Link>
        <Link href="/masuk" className="hover:text-tinta">Masuk</Link>
        <Link href="/masuk/staf" className="hover:text-tinta">Masuk sebagai staf</Link>
        <Link href="/keamanan" className="hover:text-tinta">Keamanan data</Link>
        <Link href="/privasi" className="hover:text-tinta">Kebijakan privasi</Link>
        <Link href="/syarat" className="hover:text-tinta">Syarat layanan</Link>
      </nav>
    </div>
    <p className="mt-10">© 2026 Nadi</p>
  </footer>
  );
}
