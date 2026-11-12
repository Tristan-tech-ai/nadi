"use client";

import Script from "next/script";
import { useRef, useState, useSyncExternalStore } from "react";
import { selesaiGoogle } from "@/app/auth-actions";
import { browserDalamAplikasi, buatNonce, opsiInisialisasi, opsiTombol, type ModeGoogle } from "@/lib/auth/google-gis";
import type { Kamus } from "@/lib/i18n/kamus";

type IdGoogle = {
  initialize: (o: Record<string, unknown> & { callback: (r: { credential?: string }) => void }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global {
  interface Window { google?: { accounts?: { id?: IdGoogle } } }
}
const berlangganan = () => () => {};

/**
 * Tombol resmi "Masuk dengan Google" (Google Identity Services). Skrip Google hanya dimuat di halaman yang memasang komponen
 * ini (/masuk dan /daftar). Kartu ID dari Google ditukar ke sesi Supabase dengan nonce yang sama; langkah sesudahnya
 * (catatan aktivitas, kode 2FA) memakai jalur server yang sama dengan masuk lewat email.
 */
export function TombolGoogle({ clientId, mode, bahasa, next, teks: t }: { clientId: string; mode: ModeGoogle; bahasa: "id" | "en"; next: string; teks: Kamus["auth"] }) {
  const wadah = useRef<HTMLDivElement>(null);
  const [keadaan, setKeadaan] = useState<"muat" | "siap" | "gagal" | "masuk">("muat");
  const [galat, setGalat] = useState(false);
  // Dibaca dari peramban tanpa efek (server dan hidrasi menganggap bukan webview, lalu React membaca ulang di klien).
  const webview = useSyncExternalStore(berlangganan, () => browserDalamAplikasi(navigator.userAgent), () => false);

  async function siapkan() {
    const id = window.google?.accounts?.id;
    if (!id || !wadah.current || browserDalamAplikasi(navigator.userAgent)) return;
    const { nonce, hash } = await buatNonce();
    id.initialize({
      ...opsiInisialisasi(clientId, hash, mode),
      callback: async (r) => {
        if (!r.credential) return setGalat(true);
        setKeadaan("masuk");
        setGalat(false);
        // Pustaka Supabase peramban baru diunduh saat kartu ID datang, supaya /masuk tetap ringan (anggaran JS H-04).
        const { createBrowserSupabase } = await import("@/lib/supabase/browser");
        const { error } = await createBrowserSupabase().auth.signInWithIdToken({ provider: "google", token: r.credential, nonce });
        if (error) {
          setKeadaan("siap");
          return setGalat(true);
        }
        await selesaiGoogle(next);
      },
    });
    id.renderButton(wadah.current, opsiTombol(mode, bahasa, wadah.current.clientWidth || 400));
    setKeadaan("siap");
  }

  if (webview) return <p className="mt-3 text-sm text-tinta-2" data-testid="google-webview">{t.googleWebview}</p>;
  return (
    <div className="mt-3" data-testid="tombol-google-resmi" data-keadaan={keadaan}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => { void siapkan(); }} onError={() => setKeadaan("gagal")} />
      {galat && <p role="alert" className="mb-3 text-sm text-cap">{t.googleGagal}</p>}
      <div ref={wadah} className="flex min-h-11 w-full justify-center [&_iframe:focus]:outline-2! [&_iframe:focus]:outline-offset-2! [&_iframe:focus]:outline-tinta! [&_iframe:focus]:outline-solid!" aria-busy={keadaan === "muat" || keadaan === "masuk"} />
      {keadaan === "muat" && <p className="text-center text-sm text-tinta-2">{t.googleMuat}</p>}
      {keadaan === "masuk" && <p role="status" className="mt-2 text-center text-sm text-tinta-2">{t.sebentar}</p>}
      {keadaan === "gagal" && <p role="alert" className="text-sm text-cap">{t.googleSkripGagal}</p>}
    </div>
  );
}
