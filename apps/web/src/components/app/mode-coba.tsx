"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

type Teks = { cobaDialogJudul: string; cobaDialogKet: string; cobaBuatAkun: string; cobaMasuk: string; cobaLanjut: string };

/**
 * L-03 (permintaan Tristan): di usaha contoh, tindakan yang butuh akun sendiri tidak dijalankan lalu gagal diam-diam, tetapi
 * langsung membuka dialog "buat akun atau masuk". Dicegat di fase capture sebelum React: kiriman form selain GET dan selain
 * yang ditandai data-coba-boleh (keluar, ganti bahasa, tanya data), pemilih berkas, seret-lepas berkas, dan tombol yang
 * ditandai data-perlu-akun. Database tetap menolak semua tulis dari sesi coba; ini hanya supaya pengguna tahu sebabnya.
 */
export function PenjagaCoba({ teks: t }: { teks: Teks }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const buka = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dialog.current?.open) dialog.current?.showModal();
    };
    const kirim = (e: Event) => {
      const f = e.target as HTMLFormElement;
      if (f.closest("[data-coba-boleh]") || (f.getAttribute("method") ?? "").toLowerCase() === "get" || dialog.current?.contains(f)) return;
      buka(e);
    };
    const klik = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-perlu-akun]") || (el instanceof HTMLInputElement && el.type === "file")) buka(e);
    };
    const lepas = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) buka(e); };
    const seret = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };
    window.addEventListener("submit", kirim, true);
    window.addEventListener("click", klik, true);
    window.addEventListener("drop", lepas, true);
    window.addEventListener("dragover", seret, true);
    return () => {
      window.removeEventListener("submit", kirim, true);
      window.removeEventListener("click", klik, true);
      window.removeEventListener("drop", lepas, true);
      window.removeEventListener("dragover", seret, true);
    };
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby="judul-dialog-coba" data-testid="dialog-coba"
      className="m-auto h-fit w-[min(28rem,calc(100%-2rem))] rounded-[var(--radius-lembar)] border border-garis bg-kertas p-6 text-tinta backdrop:bg-tinta/40">
      <h2 id="judul-dialog-coba" className="font-judul text-2xl font-extrabold">{t.cobaDialogJudul}</h2>
      <p className="mt-2">{t.cobaDialogKet}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/daftar" className="inline-flex h-12 items-center rounded-[var(--radius-isian)] bg-tinta px-5 font-semibold text-kertas">{t.cobaBuatAkun}</Link>
        <Link href="/masuk" className="inline-flex h-12 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-5 font-semibold">{t.cobaMasuk}</Link>
        <button type="button" onClick={() => dialog.current?.close()} className="inline-flex h-12 items-center px-2 font-semibold underline underline-offset-4">{t.cobaLanjut}</button>
      </div>
    </dialog>
  );
}
