"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Kamus } from "@/lib/i18n/kamus";
import { BookOpenTextIcon, CalculatorIcon, CalendarCheckIcon, ClipboardTextIcon, GraduationCapIcon, HouseSimpleIcon, MicrophoneIcon, MoneyIcon, PaperPlaneTiltIcon, StorefrontIcon, UsersThreeIcon } from "@phosphor-icons/react";

const SEMUA = [
  { href: "/app", kunci: "feed", Ikon: HouseSimpleIcon, peran: ["pemilik", "admin", "akuntan", "staf"] },
  { href: "/app/lempar", kunci: "lempar", Ikon: PaperPlaneTiltIcon, peran: ["pemilik", "admin", "akuntan", "staf"] },
  { href: "/app/kerja", kunci: "kerja", Ikon: ClipboardTextIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/izin", kunci: "izin", Ikon: CalendarCheckIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/gaji", kunci: "gaji", Ikon: MoneyIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/magang", kunci: "magang", Ikon: GraduationCapIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/ilmu", kunci: "ilmu", Ikon: MicrophoneIcon, peran: ["staf"] },
  { href: "/app/orang", kunci: "orang", Ikon: UsersThreeIcon, peran: ["pemilik", "admin"] },
  { href: "/app/akuntan", kunci: "akuntan", Ikon: CalculatorIcon, peran: ["akuntan"] },
  { href: "/app/buku", kunci: "buku", Ikon: BookOpenTextIcon, peran: ["akuntan"] },
  { href: "/app/perusahaan", kunci: "usaha", Ikon: StorefrontIcon, peran: ["pemilik", "admin", "akuntan"] },
] as const;

/** Navigasi bawah di jangkauan ibu jari; isinya menurut peran. Staf melihat Magang hanya bila menjadi mentor atau peserta. */
export function NavBawah({ peran, magang = false, ilmu = false, teks, lang }: { peran: string; magang?: boolean; ilmu?: boolean; teks: Kamus["aplikasi"]; lang: string }) {
  const jalur = usePathname();
  const item = SEMUA.filter((i) => (i.peran as readonly string[]).includes(peran) && (i.href !== "/app/magang" || peran !== "staf" || magang) && (i.href !== "/app/ilmu" || ilmu));
  return (
    <nav aria-label={teks.navUtama} lang={lang} className="sticky bottom-0 z-10 border-t border-garis bg-kertas pb-[env(safe-area-inset-bottom)] print:hidden">
      <ul className="mx-auto flex max-w-2xl">
        {item.map(({ href, kunci, Ikon }) => {
          const aktif = href === "/app" ? jalur === "/app" : jalur.startsWith(href);
          return (
            <li key={href} className="flex-1">
              {/* /app/ilmu butuh mikrofon: Permissions-Policy berlaku per dokumen, jadi tautannya memuat halaman penuh (bukan navigasi klien
                  dari dokumen /app yang menolak mikrofon). */}
              {(() => {
                const kelas = `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${aktif ? "font-semibold text-tinta" : "text-tinta-2"}`;
                const isi = <><Ikon size={22} weight={aktif ? "fill" : "regular"} aria-hidden />{teks.nav[kunci]}</>;
                return href === "/app/ilmu"
                  ? <a href={href} aria-current={aktif ? "page" : undefined} className={kelas}>{isi}</a>
                  : <Link href={href} aria-current={aktif ? "page" : undefined} className={kelas}>{isi}</Link>;
              })()}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
