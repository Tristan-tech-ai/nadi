"use client";

// U-02 cari fitur: tombol Cari di kepala aplikasi (dan Ctrl+K / Cmd+K di mana saja) membuka dialog combobox. Hasil dari
// src/lib/cari-fitur.ts atas halaman yang tampil untuk sesi ini; Enter membuka hasil yang disorot, panah atas/bawah memilih.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { cariFitur } from "@/lib/cari-fitur";
import type { Ruang } from "@/lib/ruang";

const PERISTIWA = "nadi:cari";

export function TombolCari({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(PERISTIWA))} aria-keyshortcuts="Control+K Meta+K"
      className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-isian)] border border-garis px-3 text-sm text-tinta-2 hover:bg-kertas-2 hover:text-tinta">
      <MagnifyingGlassIcon size={18} aria-hidden />
      <span>{label}</span>
      <kbd className="hidden rounded border border-garis px-1.5 font-mono text-[11px] lg:inline">Ctrl K</kbd>
    </button>
  );
}

export type TeksCari = { judul: string; isian: string; petunjuk: string; kosong: string; semuaMenu: string; tutup: string; hasil: string };

export function DialogCari({ ruang, peran, bahasa: b, teks }: { ruang: Ruang[]; peran: string; bahasa: Bahasa; teks: TeksCari }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [kata, setKata] = useState("");
  const [sorot, setSorot] = useState(0);
  const isian = useRef<HTMLInputElement>(null);
  const lembar = useRef<HTMLDialogElement>(null);
  const pemicu = useRef<Element | null>(null);
  const idDaftar = useId();
  const boleh = useMemo(() => new Set(ruang.flatMap((r) => r.halaman.map((x) => x.href))), [ruang]);
  const namaRuang = useMemo(() => Object.fromEntries(ruang.map((r) => [r.id, r.label[b]])), [ruang, b]);
  const hasil = useMemo(() => cariFitur(kata, peran, b, 8, boleh), [kata, peran, b, boleh]);

  useEffect(() => {
    const bukaDialog = () => { pemicu.current = document.activeElement; setKata(""); setSorot(0); setBuka(true); };
    const tombol = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); bukaDialog(); }
    };
    window.addEventListener(PERISTIWA, bukaDialog);
    window.addEventListener("keydown", tombol);
    return () => { window.removeEventListener(PERISTIWA, bukaDialog); window.removeEventListener("keydown", tombol); };
  }, []);
  // <dialog> asli dengan showModal: isi halaman di belakang menjadi inert (fokus terkunci, pembaca layar dan axe mengabaikannya).
  useEffect(() => {
    const d = lembar.current;
    if (!d) return;
    if (buka && !d.open) d.showModal();
    if (!buka && d.open) d.close();
    if (buka) isian.current?.focus();
  }, [buka]);

  function tutup() {
    if (!buka) return;
    setBuka(false);
    if (pemicu.current instanceof HTMLElement) pemicu.current.focus();
  }
  function pergi(href: string) { setBuka(false); router.push(href); }

  const aktif = hasil[Math.min(sorot, hasil.length - 1)];
  return (
    <dialog ref={lembar} aria-label={teks.judul} onCancel={(e) => { e.preventDefault(); tutup(); }}
      onClick={(e) => { if (e.target === e.currentTarget) tutup(); }}
      className="m-0 h-full max-h-none w-full max-w-none bg-kertas p-0 text-tinta backdrop:bg-tinta/40 min-[600px]:mx-auto min-[600px]:mt-[12vh] min-[600px]:h-fit min-[600px]:max-h-[70vh] min-[600px]:max-w-xl min-[600px]:rounded-[var(--radius-lembar)] min-[600px]:border min-[600px]:border-garis">
      {buka && <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-garis px-3 py-2">
          <MagnifyingGlassIcon size={20} aria-hidden className="shrink-0 text-tinta-2" />
          <input ref={isian} type="text" value={kata} placeholder={teks.isian} aria-label={teks.isian} autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded={hasil.length > 0} aria-controls={hasil.length > 0 ? idDaftar : undefined} aria-autocomplete="list"
            aria-activedescendant={aktif ? `${idDaftar}-${aktif.href}` : undefined}
            onChange={(e) => { setKata(e.target.value); setSorot(0); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); tutup(); }
              else if (e.key === "ArrowDown") { e.preventDefault(); setSorot((s) => (hasil.length ? (s + 1) % hasil.length : 0)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSorot((s) => (hasil.length ? (s - 1 + hasil.length) % hasil.length : 0)); }
              else if (e.key === "Enter" && aktif) { e.preventDefault(); pergi(aktif.href); }
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-tinta-2" />
          <button type="button" onClick={tutup} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-kertas-2">
            <XIcon size={20} aria-hidden /><span className="sr-only">{teks.tutup}</span>
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          {kata.trim().length < 2 ? <p className="px-2 py-3 text-sm text-tinta-2">{teks.petunjuk}</p>
            : hasil.length === 0 ? (
              <p role="status" className="px-2 py-3 text-sm text-tinta-2">{teks.kosong}{" "}
                <Link href="/app/menu" onClick={() => setBuka(false)} className="font-semibold text-tinta underline underline-offset-4">{teks.semuaMenu}</Link>
              </p>
            ) : (
              <ul id={idDaftar} role="listbox" aria-label={teks.hasil} className="grid gap-0.5">
                {hasil.map((x, i) => (
                  <li key={x.href} id={`${idDaftar}-${x.href}`} role="option" aria-selected={i === sorot}
                    onMouseEnter={() => setSorot(i)} onClick={() => pergi(x.href)}
                    className={`cursor-pointer rounded-[var(--radius-isian)] px-3 py-2 ${i === sorot ? "bg-kertas-2" : ""}`}>
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-tinta">{x.label[b]}</span>
                      <span className="shrink-0 text-xs text-tinta-2">{namaRuang[x.ruang]}</span>
                    </span>
                    <span className="block text-sm text-tinta-2">{x.guna[b]}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>}
    </dialog>
  );
}
