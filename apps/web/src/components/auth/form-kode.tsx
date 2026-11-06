"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { cocokkanKode, kirimKode } from "@/app/auth-actions";
import type { HasilForm } from "@/lib/auth-pesan";
import { isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { Tombol } from "@/components/ui/tombol";

const isianKelas =
  "mt-1 h-12 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base text-tinta placeholder:text-tinta-2";
const JEDA = 60; // Supabase menolak kirim ulang ke email yang sama lebih cepat dari 60 detik.

function Pesan({ hasil }: { hasil: HasilForm }) {
  return <>
    {hasil.galat ? <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{hasil.galat}</p> : null}
    {hasil.info ? <p role="status" className="rounded-[var(--radius-isian)] border border-daun px-3 py-2 text-sm text-daun">{hasil.info}</p> : null}
  </>;
}

/**
 * Masuk lewat email, dua langkah: email lalu kode. Dipakai untuk masuk tanpa sandi, lupa sandi, dan aktivasi daftar
 * (mulai langsung di langkah kedua karena email sudah terkirim oleh pendaftaran). Isian kode hanya tampil bila server
 * menyatakan email memuat kode (kode: true, templat dengan {{ .Token }}); tanpa itu langkah kedua hanya meminta membuka tautan.
 */
export function FormKode({ jenis, next, email: emailAwal, info, adaKode = false, teks: t }: { jenis: "masuk" | "lupa" | "daftar"; next?: string; email?: string; info?: string; adaKode?: boolean; teks: Kamus["auth"] }) {
  const awal: HasilForm = emailAwal ? { isian: { email: emailAwal }, kode: adaKode, info, waktu: 1 } : {};
  const [kirim, aksiKirim, mengirim] = useActionState(kirimKode, awal);
  const [cocok, aksiCocok, mencocokkan] = useActionState(cocokkanKode, {});
  const [gantiEmail, setGantiEmail] = useState(false);
  const email = kirim.isian?.email ?? emailAwal ?? "";
  const terkirim = !!kirim.waktu && !gantiEmail;

  const tersembunyi = <>
    <input type="hidden" name="jenis" value={jenis} />
    {next ? <input type="hidden" name="next" value={next} /> : null}
  </>;

  if (!terkirim) {
    return (
      <form action={(f) => { setGantiEmail(false); aksiKirim(f); }} className="grid gap-4" noValidate data-testid="form-kirim-kode">
        {tersembunyi}
        <div>
          <label htmlFor="email-kode" className="text-sm font-medium">{t.email}</label>
          <input id="email-kode" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={email} className={isianKelas} placeholder={t.emailContoh} />
        </div>
        <Pesan hasil={gantiEmail ? {} : kirim} />
        <Tombol type="submit" ukuran="besar" disabled={mengirim}>{mengirim ? t.sebentar : t.kirimEmail}</Tombol>
      </form>
    );
  }

  return (
    <div className="grid gap-4" data-testid="langkah-kode" data-ada-kode={kirim.kode ? "ya" : "tidak"}>
      <Pesan hasil={cocok.galat ? cocok : kirim} />
      {kirim.kode ? (
        <form action={aksiCocok} className="grid gap-4" noValidate>
          {tersembunyi}
          <input type="hidden" name="email" value={email} />
          <div>
            <label htmlFor="kode" className="text-sm font-medium">{t.kodeLabel}</label>
            <input id="kode" name="kode" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 -]*" maxLength={12} required autoFocus
              className={`${isianKelas} font-mono text-xl tracking-[0.3em]`} placeholder={t.kodeContohIsian} />
          </div>
          <Tombol type="submit" ukuran="besar" disabled={mencocokkan}>
            {mencocokkan ? t.sebentar : jenis === "lupa" ? t.cocokLupa : jenis === "daftar" ? t.cocokDaftar : t.cocokMasuk}
          </Tombol>
        </form>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <KirimUlang key={kirim.waktu} mulai={kirim.waktu && kirim.waktu > 1 ? JEDA : 0} mengirim={mengirim} teks={t}>
          {(tombol) => <form action={aksiKirim}>{tersembunyi}<input type="hidden" name="email" value={email} />{tombol}</form>}
        </KirimUlang>
        <button type="button" onClick={() => setGantiEmail(true)} className="text-tinta-2 underline underline-offset-4">{t.gantiEmail}</button>
      </div>
    </div>
  );
}

/** Tombol kirim ulang dengan hitung mundur; dipasang ulang (key) setiap kali kode baru terkirim. */
function KirimUlang({ mulai, mengirim, teks: t, children }: { mulai: number; mengirim: boolean; teks: Kamus["auth"]; children: (tombol: ReactNode) => ReactNode }) {
  const [sisa, setSisa] = useState(mulai);
  useEffect(() => {
    if (mulai <= 0) return;
    const id = setInterval(() => setSisa((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [mulai]);
  return children(
    <button type="submit" disabled={sisa > 0 || mengirim} className="font-semibold text-tinta underline underline-offset-4 disabled:cursor-not-allowed disabled:text-tinta-2 disabled:no-underline">
      {sisa > 0 ? isiTeks(t.kirimUlangTunggu, { n: sisa }) : t.kirimUlang}
    </button>,
  );
}
