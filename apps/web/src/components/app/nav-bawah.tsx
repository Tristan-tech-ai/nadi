"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Kamus } from "@/lib/i18n/kamus";
import { CalculatorIcon, CalendarCheckIcon, ClipboardTextIcon, GraduationCapIcon, HouseSimpleIcon, MoneyIcon, PaperPlaneTiltIcon, StorefrontIcon, UsersThreeIcon } from "@phosphor-icons/react";

const SEMUA = [
  { href: "/app", kunci: "feed", Ikon: HouseSimpleIcon, peran: ["pemilik", "admin", "akuntan", "staf"] },
  { href: "/app/lempar", kunci: "lempar", Ikon: PaperPlaneTiltIcon, peran: ["pemilik", "admin", "akuntan", "staf"] },
  { href: "/app/kerja", kunci: "kerja", Ikon: ClipboardTextIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/izin", kunci: "izin", Ikon: CalendarCheckIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/gaji", kunci: "gaji", Ikon: MoneyIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/magang", kunci: "magang", Ikon: GraduationCapIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/orang", kunci: "orang", Ikon: UsersThreeIcon, peran: ["pemilik", "admin"] },
  { href: "/app/akuntan", kunci: "akuntan", Ikon: CalculatorIcon, peran: ["akuntan"] },
  { href: "/app/perusahaan", kunci: "usaha", Ikon: StorefrontIcon, peran: ["pemilik", "admin", "akuntan"] },
] as const;

/** Navigasi bawah di jangkauan ibu jari; isinya menurut peran. Staf melihat Magang hanya bila menjadi mentor atau peserta. */
export function NavBawah({ peran, magang = false, teks, lang }: { peran: string; magang?: boolean; teks: Kamus["aplikasi"]; lang: string }) {
  const jalur = usePathname();
  const item = SEMUA.filter((i) => (i.peran as readonly string[]).includes(peran) && (i.href !== "/app/magang" || peran !== "staf" || magang));
  return (
    <nav aria-label={teks.navUtama} lang={lang} className="sticky bottom-0 z-10 border-t border-garis bg-kertas pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-2xl">
        {item.map(({ href, kunci, Ikon }) => {
          const aktif = href === "/app" ? jalur === "/app" : jalur.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={aktif ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${aktif ? "font-semibold text-tinta" : "text-tinta-2"}`}>
                <Ikon size={22} weight={aktif ? "fill" : "regular"} aria-hidden />
                {teks.nav[kunci]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
