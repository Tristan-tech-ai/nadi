"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheckIcon, HouseSimpleIcon, PaperPlaneTiltIcon, StorefrontIcon, UsersThreeIcon } from "@phosphor-icons/react";

const SEMUA = [
  { href: "/app", label: "Feed", Ikon: HouseSimpleIcon, peran: ["pemilik", "admin", "akuntan", "staf"] },
  { href: "/app/lempar", label: "Lempar", Ikon: PaperPlaneTiltIcon, peran: ["pemilik", "admin", "akuntan", "staf"] },
  { href: "/app/izin", label: "Izin", Ikon: CalendarCheckIcon, peran: ["pemilik", "admin", "staf"] },
  { href: "/app/orang", label: "Orang", Ikon: UsersThreeIcon, peran: ["pemilik", "admin"] },
  { href: "/app/perusahaan", label: "Usaha", Ikon: StorefrontIcon, peran: ["pemilik", "admin", "akuntan"] },
];

/** Navigasi bawah di jangkauan ibu jari; isinya menurut peran. */
export function NavBawah({ peran }: { peran: string }) {
  const jalur = usePathname();
  const item = SEMUA.filter((i) => i.peran.includes(peran));
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
