"use client";

import { useActionState, useState } from "react";
import { cabutAdmin, tambahAdmin, type HasilAdmin } from "@/app/app/orang/admin-actions";
import type { TeksAdmin } from "@/components/app/admin-teks";
import { Tombol } from "@/components/ui/tombol";

// ADMIN-01: tambah admin lewat email akun Nadi (dengan centang paham hak admin) dan cabut dengan konfirmasi dua langkah.
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Pesan({ h }: { h: HasilAdmin }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-sm text-cap">{h.galat}</p> : <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
}

export function FormTambahAdmin({ teks: t }: { teks: TeksAdmin }) {
  const [h, aksi, sibuk] = useActionState<HasilAdmin, FormData>(tambahAdmin, null);
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm" aria-label={t.aria} data-testid="form-tambah-admin">
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.email}</span>
        <input name="email" type="email" required autoComplete="off" className={isian} /></label>
      <label className="flex items-start gap-2"><input type="checkbox" name="paham" value="ya" required className="mt-0.5 size-5" /> <span>{t.paham}</span></label>
      <div><Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.tambah}</Tombol></div>
      <Pesan h={h} />
    </form>
  );
}

export function FormCabutAdmin({ user, email, teks: t }: { user: string; email: string; teks: TeksAdmin }) {
  const [h, aksi, sibuk] = useActionState<HasilAdmin, FormData>(cabutAdmin, null);
  const [tanya, setTanya] = useState(false);
  if (!tanya) {
    return <button type="button" onClick={() => setTanya(true)} className="text-sm text-tinta-2 underline underline-offset-4" aria-label={`${t.cabut} ${email}`}>{t.cabut}</button>;
  }
  return (
    <form action={aksi} className="flex w-full flex-wrap items-center gap-2 text-sm" data-testid="konfirmasi-cabut-admin">
      <input type="hidden" name="user" value={user} />
      <p className="w-full">{t.yakin.replace("{email}", email)}</p>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.ya}</Tombol>
      <button type="button" onClick={() => setTanya(false)} className="text-tinta-2 underline underline-offset-4">{t.batal}</button>
      <Pesan h={h} />
    </form>
  );
}
