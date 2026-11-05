"use client";

// U-01 kerangka aplikasi adaptif (docs/design/REKONSTRUKSI-APP.md bagian 4), mengikuti kelas lebar jendela:
// < 600 px bilah bawah 5 butir + lembar Menu; 600-1199 px rail ruang + panel halaman ruang; >= 1200 px sidebar penuh.
// Dua layar berdampingan (horizontal-viewport-segments: 2) diatur di globals.css (.kerangka-*). Isi navigasi dari src/lib/ruang.ts.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ListIcon, LifebuoyIcon, PushPinIcon, PushPinSlashIcon, UsersThreeIcon, WalletIcon, XIcon } from "@phosphor-icons/react";
import { IKON_HALAMAN, IKON_RUANG, type Ikon } from "@/components/app/ikon-halaman";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { SEMUA_HALAMAN, halamanDari, type Ruang } from "@/lib/ruang";
import { PERISTIWA_SEMAT, SEMATAN_BAWAAN, bacaSematan, gantiSematan } from "@/lib/sematan";
import { DialogCari, type TeksCari } from "@/components/app/cari-fitur";


type Teks = { navUtama: string; menu: string; tutup: string; semuaMenu: string; peta: string; cari: TeksCari; menunggu: string; disematkan: string; semuaRuang: string; bantuan: string; semat: string; lepas: string };
type Butir = { href: string; label: string; Ikon: Ikon };

export function bilahBawah(peran: string, b: Bahasa): Butir[] {
  const t = (id: string, en: string) => (b === "en" ? en : id);
  if (peran === "staf") return [
    { href: "/app", label: t("Hari ini", "Today"), Ikon: IKON_HALAMAN["/app"] }, { href: "/app/kerja", label: t("Kerja", "Work"), Ikon: IKON_HALAMAN["/app/kerja"] },
    { href: "/app/izin", label: t("Izin", "Leave"), Ikon: IKON_HALAMAN["/app/izin"] }, { href: "/app/gaji", label: t("Gaji", "Pay"), Ikon: IKON_HALAMAN["/app/gaji"] }];
  if (peran === "akuntan") return [
    { href: "/app", label: t("Hari ini", "Today"), Ikon: IKON_HALAMAN["/app"] }, { href: "/app/lempar", label: t("Lempar", "Drop"), Ikon: IKON_HALAMAN["/app/lempar"] },
    { href: "/app/buku", label: t("Laporan", "Reports"), Ikon: IKON_HALAMAN["/app/buku"] }, { href: "/app/akuntan", label: t("Akuntan", "Accountant"), Ikon: IKON_HALAMAN["/app/akuntan"] }];
  return [
    { href: "/app", label: t("Hari ini", "Today"), Ikon: IKON_HALAMAN["/app"] }, { href: "/app/lempar", label: t("Lempar", "Drop"), Ikon: IKON_HALAMAN["/app/lempar"] },
    { href: "/app/invoice", label: t("Uang", "Money"), Ikon: WalletIcon }, { href: "/app/orang", label: t("Orang", "People"), Ikon: UsersThreeIcon }];
}

function IkonHalaman({ href, size = 16 }: { href: string; size?: number }) {
  const I = IKON_HALAMAN[href] ?? ListIcon;
  return <I size={size} aria-hidden className="shrink-0" />;
}

/** Lencana hanya untuk hal yang bisa ditindak (mis. usulan menunggu), tidak tampil bila nol (NN/g, indikator bersifat kondisional). */
function Lencana({ n, label }: { n?: number; label: string }) {
  if (!n) return null;
  return <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-tinta px-1.5 text-[11px] font-semibold leading-5 text-kertas" data-lencana={n}>
    <span aria-hidden>{n > 99 ? "99+" : n}</span><span className="sr-only">{label.replace("{n}", String(n))}</span></span>;
}

const aktifDi = (jalur: string, href: string) => (href === "/app" ? jalur === "/app" : jalur === href || jalur.startsWith(`${href}/`));

function DaftarRuang({ ruang, jalur, b, guna = false, lipat = false, onPilih, lencana = {}, labelLencana = "", disemat, onSemat, labelSemat = "" }: { ruang: Ruang[]; jalur: string; b: Bahasa; guna?: boolean; lipat?: boolean; onPilih?: () => void; lencana?: Record<string, number>; labelLencana?: string; disemat?: ReadonlySet<string>; onSemat?: (href: string) => void; labelSemat?: string }) {
  const jumlahRuang = (r: Ruang) => r.halaman.reduce((a, x) => a + (disemat?.has(x.href) ? 0 : lencana[x.href] ?? 0), 0);
  const kini = halamanDari(jalur)?.href;
  const ruangKini = halamanDari(jalur)?.ruang;
  if (lipat) {
    // Sidebar: hanya ruang yang sedang dibuka terlipat terbuka; ruang lain cukup satu baris yang bisa diketuk.
    return (
      <div className="grid gap-1" key={ruangKini}>
        {ruang.map((r) => {
          const Ikon = IKON_RUANG[r.id] ?? ListIcon;
          return (
            <details key={r.id} open={r.id === ruangKini || undefined} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[var(--radius-isian)] px-2 py-2 text-sm font-semibold text-tinta hover:bg-kertas-2">
                <Ikon size={18} aria-hidden />{r.label[b]}{r.id !== ruangKini && <Lencana n={jumlahRuang(r)} label={labelLencana} />}
              </summary>
              <ul className="mb-2 ml-6 mt-0.5 grid gap-0.5 border-l border-garis pl-2">{r.halaman.map((x) => (
                <li key={x.href} className="group/item flex items-center gap-1">
                  <Link href={x.href} aria-current={kini === x.href ? "page" : undefined}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-isian)] px-2 py-1.5 text-sm hover:bg-kertas-2 ${kini === x.href ? "bg-kertas-2 font-semibold text-tinta" : "text-tinta"}`}><IkonHalaman href={x.href} /><span className="truncate">{x.label[b]}</span>{!disemat?.has(x.href) && <Lencana n={lencana[x.href]} label={labelLencana} />}</Link>
                  {onSemat && !disemat?.has(x.href) && (
                    <button type="button" title={labelSemat.replace("{x}", x.label[b])} onClick={() => onSemat(x.href)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-tinta-2 opacity-0 hover:bg-kertas-2 hover:text-tinta focus-visible:opacity-100 group-hover/item:opacity-100">
                      <PushPinIcon size={16} aria-hidden /><span className="sr-only">{labelSemat.replace("{x}", x.label[b])}</span>
                    </button>
                  )}
                </li>))}</ul>
            </details>
          );
        })}
      </div>
    );
  }
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
                  <span className="flex items-center gap-2"><IkonHalaman href={x.href} />{x.label[b]}<Lencana n={lencana[x.href]} label={labelLencana} /></span>{guna && <span className="block text-xs font-normal text-tinta-2">{x.guna[b]}</span>}
                </Link>
              </li>))}</ul>
          </section>
        );
      })}
    </div>
  );
}

export function Kerangka({ ruang, mati = [], peran, bahasa: b, teks, lencana: lencanaAwal = {}, kaki, pid }: {
  ruang: Ruang[]; mati?: Ruang[]; peran: string; bahasa: Bahasa; teks: Teks; lencana?: Record<string, number>;
  kaki?: ReactNode; pid?: string;
}) {
  // U-12 lencana live: jumlah usulan menunggu dihitung ulang saat tabel usulan usaha ini berubah (Supabase Realtime Postgres Changes,
  // RLS memeriksa setiap pelanggan) dan saat tab kembali aktif. Angka awal dari server.
  const [lencana, setLencana] = useState(lencanaAwal);
  const [lencanaDari, setLencanaDari] = useState(lencanaAwal);
  if (lencanaDari !== lencanaAwal) { setLencanaDari(lencanaAwal); setLencana(lencanaAwal); }
  useEffect(() => {
    if (!pid) return;
    let batal = false;
    let lepas: (() => void) | undefined;
    (async () => {
      const { createBrowserSupabase } = await import("@/lib/supabase/browser");
      if (batal) return;
      const sb = createBrowserSupabase();
      // Realtime memeriksa RLS dengan token sesi; tanpa setAuth kanal tersambung sebagai anon dan tidak menerima perubahan.
      const { data: sesi } = await sb.auth.getSession();
      if (batal) return;
      if (sesi.session) await sb.realtime.setAuth(sesi.session.access_token);
      const hitung = async () => {
        const { count } = await sb.from("usulan").select("id", { count: "exact", head: true }).eq("status", "menunggu");
        if (!batal && typeof count === "number") setLencana((l) => ({ ...l, "/app": count }));
      };
      const kanal = sb.channel(`usulan-${pid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "usulan", filter: `perusahaan_id=eq.${pid}` }, () => { void hitung(); })
        .subscribe();
      const saatTampil = () => { if (document.visibilityState === "visible") void hitung(); };
      document.addEventListener("visibilitychange", saatTampil);
      lepas = () => { document.removeEventListener("visibilitychange", saatTampil); void sb.removeChannel(kanal); };
    })();
    return () => { batal = true; lepas?.(); };
  }, [pid]);
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
  // U-09 Disematkan: bawaan per peran, diubah dari tombol sematkan di kepala halaman (localStorage per perangkat).
  const [sematan, setSematan] = useState<string[]>(() => SEMATAN_BAWAAN[peran] ?? SEMATAN_BAWAAN.pemilik); // sama di server dan klien, lalu dibaca dari perangkat
  useEffect(() => {
    const segarkan = () => setSematan(bacaSematan(peran));
    segarkan();
    window.addEventListener(PERISTIWA_SEMAT, segarkan);
    return () => window.removeEventListener(PERISTIWA_SEMAT, segarkan);
  }, [peran]);
  const boleh = new Set(ruang.flatMap((r) => r.halaman.map((x) => x.href)));
  const disemat = sematan.map((h) => SEMUA_HALAMAN.find((x) => x.href === h)).filter((x): x is (typeof SEMUA_HALAMAN)[number] => !!x && boleh.has(x.href));
  const ruangBadan = ruang.filter((r) => r.id !== "pengaturan");
  const pengaturan = ruang.find((r) => r.id === "pengaturan");
  const butir = bilahBawah(peran, b);
  const ruangPanel = ruang.find((r) => r.id === panel);

  return (
    <>
      {/* >= 1200 px: sidebar penuh. */}
      <nav aria-label={teks.navUtama} className="kerangka-sidebar fixed bottom-0 left-0 top-[3.25rem] z-10 hidden w-64 flex-col border-r border-garis bg-kertas min-[1200px]:flex print:hidden">
        {/* Badan bergulir: Disematkan lalu semua ruang. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {disemat.length > 0 && (
            <>
              <p className="px-2 pb-1 text-xs font-semibold text-tinta-2">{teks.disematkan}</p>
              <ul className="mb-4 grid gap-0.5" data-testid="disematkan">{disemat.map((x) => {
                const aktif = halamanDari(jalur)?.href === x.href;
                return (
                  <li key={x.href} className="group flex items-center gap-1">
                    <Link href={x.href} aria-current={aktif ? "page" : undefined}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-isian)] px-2 py-2 text-sm hover:bg-kertas-2 ${aktif ? "bg-kertas-2 font-semibold text-tinta" : "text-tinta"}`}>
                      <IkonHalaman href={x.href} size={18} /><span className="truncate">{x.label[b]}</span><Lencana n={lencana[x.href]} label={teks.menunggu} />
                    </Link>
                    <button type="button" title={teks.lepas.replace("{x}", x.label[b])} onClick={() => setSematan(gantiSematan(peran, x.href))}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-tinta-2 opacity-0 hover:bg-kertas-2 hover:text-tinta focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100">
                      <PushPinSlashIcon size={16} aria-hidden /><span className="sr-only">{teks.lepas.replace("{x}", x.label[b])}</span>
                    </button>
                  </li>);
              })}</ul>
            </>
          )}
          <p className="px-2 pb-1 text-xs font-semibold text-tinta-2">{teks.semuaRuang}</p>
          <DaftarRuang ruang={ruangBadan} jalur={jalur} b={b} lipat lencana={lencana} labelLencana={teks.menunggu} disemat={new Set(disemat.map((x) => x.href))} onSemat={(h) => setSematan(gantiSematan(peran, h))} labelSemat={teks.semat} />
        </div>
        {/* Kaki tetap: bantuan, peta menu, pengaturan, akun. */}
        <div className="border-t border-garis px-3 py-2" data-testid="kaki-sidebar">
          <ul className="grid gap-0.5 text-sm">
            <li><Link href="/panduan" className="flex items-center gap-2 rounded-[var(--radius-isian)] px-2 py-2 text-tinta hover:bg-kertas-2"><LifebuoyIcon size={18} aria-hidden />{teks.bantuan}</Link></li>
            <li><Link href="/app/menu" aria-current={jalur === "/app/menu" ? "page" : undefined} className={`flex items-center gap-2 rounded-[var(--radius-isian)] px-2 py-2 text-tinta hover:bg-kertas-2 ${jalur === "/app/menu" ? "bg-kertas-2 font-semibold" : ""}`}><ListIcon size={18} aria-hidden />{teks.peta}</Link></li>
            {pengaturan?.halaman.map((x) => {
              const aktif = halamanDari(jalur)?.href === x.href;
              return (
                <li key={x.href}><Link href={x.href} aria-current={aktif ? "page" : undefined} className={`flex items-center gap-2 rounded-[var(--radius-isian)] px-2 py-2 text-tinta hover:bg-kertas-2 ${aktif ? "bg-kertas-2 font-semibold" : ""}`}>
                  <IkonHalaman href={x.href} size={18} /><span className="truncate">{x.label[b]}</span></Link></li>);
            })}
          </ul>
          {kaki && <div className="mt-1 flex items-center justify-between gap-2 border-t border-garis px-2 pt-2 text-sm">{kaki}</div>}
        </div>
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
                <span className="relative"><Ikon size={22} weight={aktif ? "fill" : "regular"} aria-hidden />
                  {r.halaman.some((x) => lencana[x.href]) && <span className="absolute -right-2 -top-1"><Lencana n={r.halaman.reduce((a, x) => a + (lencana[x.href] ?? 0), 0)} label={teks.menunggu} /></span>}</span>{r.label[b]}
              </button>
            </li>);
        })}
          <li>
            <Link href="/app/menu" aria-current={jalur === "/app/menu" ? "page" : undefined}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] leading-tight ${jalur === "/app/menu" ? "font-semibold text-tinta" : "text-tinta-2"}`}>
              <ListIcon size={22} aria-hidden />{teks.menu}
            </Link>
          </li>
        </ul>
      </nav>
      {ruangPanel && (
        <div id="panel-ruang" className="fixed bottom-0 left-20 top-[3.25rem] z-20 hidden w-72 overflow-y-auto border-r border-garis bg-kertas p-3 shadow-sm min-[600px]:block min-[1200px]:hidden">
          <DaftarRuang ruang={[ruangPanel]} jalur={jalur} b={b} guna onPilih={() => setPanel(null)} lencana={lencana} labelLencana={teks.menunggu} />
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
                  <span className="relative"><Ikon size={22} weight={aktif ? "fill" : "regular"} aria-hidden />
                    {lencana[href] ? <span className="absolute -right-3 -top-1"><Lencana n={lencana[href]} label={teks.menunggu} /></span> : null}</span>{label}
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
          <div className="mt-4"><DaftarRuang ruang={ruang} jalur={jalur} b={b} guna onPilih={() => setMenu(false)} lencana={lencana} labelLencana={teks.menunggu} /></div>
        </div>
      )}
      <DialogCari ruang={ruang} mati={mati} peran={peran} bahasa={b} teks={teks.cari} />
    </>
  );
}
