"use client";

import { useId, useState } from "react";
import { catatAktivitasKeamanan, keluar } from "@/app/auth-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/** Langkah kedua masuk: kode TOTP dari aplikasi autentikator (supabase.auth.mfa.challengeAndVerify), lalu ke tujuan. */
export function Kode2fa({ next, teks: t }: { next: string; teks: Kamus["auth"] }) {
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const id = useId();
  async function kirim(f: FormData) {
    setGalat("");
    setSibuk(true);
    try {
      const sb = createBrowserSupabase();
      const { data: fs } = await sb.auth.mfa.listFactors();
      const faktor = fs?.totp?.[0];
      if (!faktor) return window.location.assign(next);
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: faktor.id, code: String(f.get("kode") ?? "").replace(/\D/g, "") });
      if (error) return setGalat(t.duaSalah);
      await catatAktivitasKeamanan("2fa.lolos");
      window.location.assign(next);
    } finally {
      setSibuk(false);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <form action={kirim} className="flex flex-col gap-3" aria-label={t.duaJudul}>
        <label htmlFor={id} className="text-sm text-tinta-2">{t.duaKode}</label>
        <input id={id} name="kode" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
          className="angka h-12 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-xl tracking-widest" />
        {galat && <p role="alert" className="text-cap">{galat}</p>}
        <Tombol type="submit" disabled={sibuk}>{t.duaLanjut}</Tombol>
      </form>
      <form action={keluar}><button type="submit" className="text-sm underline underline-offset-4">{t.duaLain}</button></form>
    </div>
  );
}
