"use client";

import { XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// U-05 tur 60 detik, hanya bila diminta dari bantuan "?" (/app?tur=1), tidak pernah muncul sendiri (NN/g 2023). Lima titik yang
// menunjuk bagian asli layar ini, masing-masing satu kalimat dan satu ajakan mencoba; pengguna bebas mengeklik bagian yang disorot.
// Elemen dipilih yang terlihat di ukuran layar sekarang (sidebar, rail, atau bilah bawah); bila tidak ada, kartu tampil di tengah.
type Bahasa = "id" | "en";
type Titik = { pilih: string; judul: Record<Bahasa, string>; isi: Record<Bahasa, string> };

const TITIK: readonly Titik[] = [
  { pilih: '[data-tur="cari"]',
    judul: { id: "Cari apa saja", en: "Search anything" },
    isi: { id: "Ketik nama fitur, misalnya invoice atau gaji. Bisa juga tekan Ctrl K.", en: "Type a feature name, like invoice or payroll. Or press Ctrl K." } },
  { pilih: 'a[href="/app/lempar"]',
    judul: { id: "Lempar berkas", en: "Drop a file" },
    isi: { id: "Foto nota, slip gaji, atau Excel apa saja. Nadi membacanya lalu menaruh usulan di Hari ini.", en: "A receipt photo, payslip, or any Excel. Nadi reads it and puts a proposal on Today." } },
  { pilih: "#perlu-keputusan",
    judul: { id: "Keputusanmu ada di sini", en: "Your decisions live here" },
    isi: { id: "Setujui atau tolak usulan. Data baru berubah setelah kamu setuju, dan bisa dibatalkan sebentar.", en: "Approve or reject proposals. Data only changes after you approve, with a short undo window." } },
  { pilih: 'a[href="/app/menu"]',
    judul: { id: "Semua fitur", en: "All features" },
    isi: { id: "Semua fitur per ruang, masing-masing dengan gunanya. Sematkan yang sering kamu pakai.", en: "Every feature by area, each with what it is for. Pin the ones you use often." } },
  { pilih: '[data-tur="bantuan"]',
    judul: { id: "Bantuan di setiap halaman", en: "Help on every page" },
    isi: { id: "Guna halaman, daftar Mulai di Nadi, dan tur ini ada di tombol ini.", en: "What the page is for, the getting-started list, and this tour live here." } },
];

function terlihat(pilih: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(pilih)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

type Kotak = { top: number; left: number; width: number; height: number } | null;

export function TurSingkat({ bahasa }: { bahasa: Bahasa }) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [kotak, setKotak] = useState<Kotak>(null);
  const kartu = useRef<HTMLDivElement>(null);
  const en = bahasa === "en";
  const titik = TITIK[i];

  const tutup = useCallback(() => router.replace("/app", { scroll: false }), [router]);

  useEffect(() => {
    const el = terlihat(titik.pilih);
    el?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    const ukur = () => {
      const r = terlihat(titik.pilih)?.getBoundingClientRect();
      setKotak(r ? { top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 } : null);
    };
    ukur();
    window.addEventListener("resize", ukur);
    window.addEventListener("scroll", ukur, true);
    kartu.current?.focus();
    return () => {
      window.removeEventListener("resize", ukur);
      window.removeEventListener("scroll", ukur, true);
    };
  }, [titik.pilih]);

  // Tur dibuka dari panel bantuan "?": tutup panelnya supaya tidak menutupi bagian yang disorot.
  useEffect(() => {
    for (const d of document.querySelectorAll("details[open]")) d.removeAttribute("open");
  }, []);

  useEffect(() => {
    const kunci = (e: KeyboardEvent) => { if (e.key === "Escape") tutup(); };
    window.addEventListener("keydown", kunci);
    return () => window.removeEventListener("keydown", kunci);
  }, [tutup]);

  // Kartu di bawah sorotan bila muat, kalau tidak di atasnya; tanpa sorotan, di tengah bawah layar.
  const LEBAR = 320;
  const gaya: React.CSSProperties = kotak
    ? {
        left: Math.max(16, Math.min(kotak.left, (typeof window === "undefined" ? 1024 : window.innerWidth) - LEBAR - 16)),
        ...(kotak.top + kotak.height + 220 < (typeof window === "undefined" ? 800 : window.innerHeight)
          ? { top: kotak.top + kotak.height + 12 }
          : { bottom: (typeof window === "undefined" ? 800 : window.innerHeight) - kotak.top + 12 }),
      }
    : { left: "50%", bottom: 96, transform: "translateX(-50%)" };

  return (
    <div data-testid="tur-singkat">
      {kotak && (
        <div aria-hidden className="pointer-events-none fixed z-[60] rounded-[var(--radius-kartu)] border-2 border-tinta shadow-[0_0_0_9999px_color-mix(in_srgb,var(--tinta)_30%,transparent)]"
          style={{ top: kotak.top, left: kotak.left, width: kotak.width, height: kotak.height }} />
      )}
      <div ref={kartu} tabIndex={-1} role="dialog" aria-modal="false" aria-labelledby="judul-tur"
        className="fixed z-[61] w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-kartu)] border border-garis bg-kertas p-4 text-sm shadow-sm outline-none" style={gaya}>
        <div className="flex items-start justify-between gap-2">
          <p className="text-tinta-2" data-testid="tur-langkah">{en ? `Step ${i + 1} of ${TITIK.length}` : `Langkah ${i + 1} dari ${TITIK.length}`}</p>
          <button type="button" onClick={tutup} title={en ? "Close" : "Tutup"} className="-m-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-tinta-2 hover:bg-kertas-2 hover:text-tinta">
            <XIcon size={18} aria-hidden /><span className="sr-only">{en ? "Close tour" : "Tutup tur"}</span>
          </button>
        </div>
        <h2 id="judul-tur" className="text-base font-semibold">{titik.judul[bahasa]}</h2>
        <p className="mt-1">{titik.isi[bahasa]}</p>
        <div className="mt-3 flex justify-end gap-2">
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)} className="inline-flex min-h-10 items-center rounded-[var(--radius-isian)] px-3 font-semibold hover:bg-kertas-2">
              {en ? "Back" : "Kembali"}
            </button>
          )}
          <button type="button" onClick={() => (i + 1 < TITIK.length ? setI(i + 1) : tutup())}
            className="inline-flex min-h-10 items-center rounded-[var(--radius-isian)] bg-tinta px-4 font-semibold text-kertas">
            {i + 1 < TITIK.length ? (en ? "Next" : "Lanjut") : (en ? "Done" : "Selesai")}
          </button>
        </div>
      </div>
    </div>
  );
}
