"use client";

// U-01 kerangka aplikasi adaptif (docs/design/REKONSTRUKSI-APP.md bagian 4), mengikuti kelas lebar jendela:
// < 600 px bilah bawah 5 butir + lembar Menu; 600-1199 px rail ruang + panel halaman ruang; >= 1200 px sidebar penuh.
// Dua layar berdampingan (horizontal-viewport-segments: 2) diatur di globals.css (.kerangka-*). Isi navigasi dari src/lib/ruang.ts.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  BookOpenTextIcon, CalculatorIcon, CalendarCheckIcon, ClipboardTextIcon, FileTextIcon, GearSixIcon, HouseSimpleIcon, LightningIcon, ListIcon,
  MoneyIcon, PackageIcon, PaperPlaneTiltIcon, StorefrontIcon, UsersThreeIcon, VideoCameraIcon, WalletIcon, XIcon, type IconProps,
} from "@phosphor-icons/react";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { halamanDari, type Ruang } from "@/lib/ruang";

type Ikon = ComponentType<IconProps>;
const IKON_RUANG: Record<string, Ikon> = {
  "hari-ini": HouseSimpleIcon, uang: WalletIcon, jual: StorefrontIcon, barang: PackageIcon, orang: UsersThreeIcon,
  tempat: VideoCameraIcon, dokumen: FileTextIcon, otomasi: LightningIcon, pengaturan: GearSixIcon,
};
type Teks = { navUtama: string; menu: string; tutup: string; semuaMenu: string };
type Butir = { href: string; label: string; Ikon: Ikon };

function bilahBawah(peran: string, b: Bahasa): Butir[] {
  const t = (id: string, en: string) => (b === "en" ? en : id);
  if (peran === "staf") return [
    { href: "/app", label: t("Hari ini", "Today"), Ikon: HouseSimpleIcon }, { href: "/app/kerja", label: t("Kerja", "Work"), Ikon: ClipboardTextIcon },
    { href: "/app/izin", label: t("Izin", "Leave"), Ikon: CalendarCheckIcon }, { href: "/app/gaji", label: t("Gaji", "Pay"), Ikon: MoneyIcon }];
  if (peran === "akuntan") return [
    { href: "/app", label: t("Hari ini", "Today"), Ikon: HouseSimpleIcon }, { href: "/app/lempar", label: t("Lempar", "Drop"), Ikon: PaperPlaneTiltIcon },
    { href: "/app/buku", label: t("Laporan", "Reports"), Ikon: BookOpenTextIcon }, { href: "/app/akuntan", label: t("Akuntan", "Accountant"), Ikon: CalculatorIcon }];
  return [
    { href: "/app", label: t("Hari ini", "Today"), Ikon: HouseSimpleIcon }, { href: "/app/lempar", label: t("Lempar", "Drop"), Ikon: PaperPlaneTiltIcon },
    { href: "/app/invoice", label: t("Uang", "Money"), Ikon: WalletIcon }, { href: "/app/orang", label: t("Orang", "People"), Ikon: UsersThreeIcon }];
}

const aktifDi = (jalur: string, href: string) => (href === "/app" ? jalur === "/app" : jalur === href || jalur.startsWith(`${href}/`));

function DaftarRuang({ ruang, jalur, b, guna = false, onPilih }: { ruang: Ruang[]; jalur: string; b: Bahasa; guna?: boolean; onPilih?: () => void }) {
  const kini = halamanDari(jalur)?.href;
  return (
    <div className="grid gap-5">
      {ruang.map((r) => {
        const Ikon = IKON_RUANG[r.id] ?? ListIcon;
        return (
          <section key={r.id} aria-labelledby={`ruang-${r.id}${guna ? "-m" : ""}`}>
            <h2 id={`ruang-${r.id}${guna ? "-m" : ""}`} className="flex items-center gap-2 px-2 text-xs font-semibold text-tinta-2">
              <Ikon size={16} aria-hidden />{r.label[b]}
            </h2>
            <ul className="mt-1 grid gap-0.5">{r.halaman.map((x) => (
              <li key={x.href}>
                <Link href={x.href} onClick={onPilih} aria-current={kini === x.href ? "page" : undefined}
                  className={`block rounded-[var(--radius-isian)] px-2 py-2 text-sm hover:bg-kertas-2 ${kini === x.href ? "bg-kertas-2 font-semibold text-tinta" : "text-tinta"}`}>
                  {x.label[b]}{guna && <span className="block text-xs font-normal text-tinta-2">{x.guna[b]}</span>}
                </Link>
              </li>))}</ul>
          </section>
        );
      })}
    </div>
  );
}

export function Kerangka({ ruang, peran, bahasa: b, teks }: { ruang: Ruang[]; peran: string; bahasa: Bahasa; teks: Teks }) {
  const jalur = usePathname();
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const tutupMenu = useRef<HTMLButtonElement>(null);
  const ruangKini = halamanDari(jalur)?.ruang;
  // Pindah halaman menutup lembar dan panel (disetel saat render, pola React untuk state yang bergantung pada nilai lain); Escape juga menutup.
  const [jalurTerakhir, setJalurTerakhir] = useState(jalur);
  if (jalurTerakhir !== jalur) { setJalurTerakhir(jalur); setMenu(false); setPanel(null); }
  useEffect(() => {
    if (!menu && !panel) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); setPanel(null); } };
    window.addEventListener("keydown", esc);
    if (menu) tutupMenu.current?.focus();
    return () => window.removeEventListener("keydown", esc);
  }, [menu, panel]);
  const butir = bilahBawah(peran, b);
  const ruangPanel = ruang.find((r) => r.id === panel);

  return (
    <>
      {/* >= 1200 px: sidebar penuh. */}
      <nav aria-label={teks.navUtama} className="kerangka-sidebar fixed bottom-0 left-0 top-[3.25rem] z-10 hidden w-64 overflow-y-auto border-r border-garis bg-kertas px-3 py-4 min-[1200px]:block print:hidden">
        <DaftarRuang ruang={ruang} jalur={jalur} b={b} />
      </nav>

      {/* 600-1199 px: rail ruang, panel halaman ruang yang dipilih. */}
      <nav aria-label={teks.navUtama} className="kerangka-rail fixed bottom-0 left-0 top-[3.25rem] z-20 hidden w-20 overflow-y-auto border-r border-garis bg-kertas py-2 min-[600px]:block min-[1200px]:hidden print:hidden">
        <ul className="grid gap-1">{ruang.map((r) => {
          const Ikon = IKON_RUANG[r.id] ?? ListIcon;
          const aktif = ruangKini === r.id;
          return (
            <li key={r.id}>
              <button type="button" onClick={() => setPanel(panel === r.id ? null : r.id)} aria-expanded={panel === r.id} aria-controls="panel-ruang"
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] leading-tight ${aktif ? "font-semibold text-tinta" : "text-tinta-2"}`}>
                <Ikon size={22} weight={aktif ? "fill" : "regular"} aria-hidden />{r.label[b]}
              </button>
            </li>);
        })}</ul>
      </nav>
      {ruangPanel && (
        <div id="panel-ruang" className="fixed bottom-0 left-20 top-[3.25rem] z-20 hidden w-72 overflow-y-auto border-r border-garis bg-kertas p-3 shadow-sm min-[600px]:block min-[1200px]:hidden">
          <DaftarRuang ruang={[ruangPanel]} jalur={jalur} b={b} guna onPilih={() => setPanel(null)} />
        </div>
      )}

      {/* < 600 px: pengganjal + bilah bawah fixed (elemen fixed tidak dihitung menutupi tombol oleh axe target-size) + lembar Menu. */}
      <div aria-hidden className="h-[calc(3.5rem+1px+env(safe-area-inset-bottom))] shrink-0 min-[600px]:hidden print:hidden" />
      <nav aria-label={teks.navUtama} className="kerangka-bawah fixed inset-x-0 bottom-0 z-10 border-t border-garis bg-kertas pb-[env(safe-area-inset-bottom)] min-[600px]:hidden print:hidden">
        <ul className="flex">
          {butir.map(({ href, label, Ikon }) => {
            const aktif = aktifDi(jalur, href) && !menu;
            return (
              <li key={href} className="flex-1">
                <Link href={href} aria-current={aktif ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${aktif ? "font-semibold text-tinta" : "text-tinta-2"}`}>
                  <Ikon size={22} weight={aktif ? "fill" : "regular"} aria-hidden />{label}
                </Link>
              </li>);
          })}
          <li className="flex-1">
            <button type="button" onClick={() => setMenu(true)} aria-expanded={menu} aria-controls="lembar-menu" className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs ${menu ? "font-semibold text-tinta" : "text-tinta-2"}`}>
              <ListIcon size={22} aria-hidden />{teks.menu}
            </button>
          </li>
        </ul>
      </nav>
      {menu && (
        <div id="lembar-menu" role="dialog" aria-modal="true" aria-label={teks.semuaMenu} className="fixed inset-0 z-30 overflow-y-auto bg-kertas px-4 pb-24 pt-4 min-[600px]:hidden">
          <div className="flex items-center justify-between">
            <p className="font-judul text-xl font-extrabold">{teks.semuaMenu}</p>
            <button ref={tutupMenu} type="button" onClick={() => setMenu(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-kertas-2">
              <XIcon size={22} aria-hidden /><span className="sr-only">{teks.tutup}</span>
            </button>
          </div>
          <div className="mt-4"><DaftarRuang ruang={ruang} jalur={jalur} b={b} guna onPilih={() => setMenu(false)} /></div>
        </div>
      )}
    </>
  );
}
