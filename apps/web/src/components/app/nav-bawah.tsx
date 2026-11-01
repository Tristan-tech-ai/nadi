"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalculatorIcon, CalendarCheckIcon, ClipboardTextIcon, GraduationCapIcon, HouseSimpleIcon, MoneyIcon, PaperPlaneTiltIcon, StorefrontIcon, UsersThreeIcon } from "@phosphor-icons/react";

const SEMUA = [
  { href: "/app", label: "Feed", Ikon: HouseSimpleIcon, peran: ["pemilik", "admin", "akuntan", "staf"] },
  { href: "/app/lempar", label: "Lempar", Ikon: PaperPlaneTiltIcon, peran: ["pemilik", "admin", "akuntan", "staf"] },
  { href: "/app/kerja", label: "Kerja", Ikon: ClipboardTextIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/izin", label: "Izin", Ikon: CalendarCheckIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/gaji", label: "Gaji", Ikon: MoneyIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/magang", label: "Magang", Ikon: GraduationCapIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/orang", label: "Orang", Ikon: UsersThreeIcon, peran: ["pemilik", "admin"] },
  { href: "/app/akuntan", label: "Akuntan", Ikon: CalculatorIcon, peran: ["akuntan"] },
  { href: "/app/perusahaan", label: "Usaha", Ikon: StorefrontIcon, peran: ["pemilik", "admin", "akuntan"] },
];

/** Navigasi bawah di jangkauan ibu jari; isinya menurut peran. Staf melihat Magang hanya bila menjadi mentor atau peserta. */
export function NavBawah({ peran, magang = false }: { peran: string; magang?: boolean }) {
  const jalur = usePathname();
  const item = SEMUA.filter((i) => i.peran.includes(peran) && (i.href !== "/app/magang" || peran !== "staf" || magang));
  return (
    <nav aria-label="Navigasi utama" className="sticky bottom-0 z-10 border-t border-garis bg-kertas pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-2xl">
        {item.map(({ href, label, Ikon }) => {
          const aktif = href === "/app" ? jalur === "/app" : jalur.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link href={href} aria-current={aktif ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${aktif ? "font-semibold text-tinta" : "text-tinta-2"}`}>
                <Ikon size={22} weight={aktif ? "fill" : "regular"} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
