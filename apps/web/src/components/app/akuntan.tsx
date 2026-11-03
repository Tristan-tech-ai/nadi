"use client";

import { useActionState, useState } from "react";
import { aturIdentitas, cabutAkuntan, tambahAkuntan, type HasilIdentitas } from "@/app/app/akuntan/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["akuntan"];

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

/** NPWP pemotong (16 angka) dan ID TKU (22 angka, bawaan NPWP + 000000). Terkendali agar nilai tersimpan tetap terlihat. */
export function FormIdentitas({ awal, teks: t }: { awal: { npwp?: string; id_tku?: string } | null; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilIdentitas, FormData>(aturIdentitas, null);
  const [npwp, setNpwp] = useState(awal?.npwp ?? "");
  const [tku, setTku] = useState(awal?.id_tku ?? "");
  return (
    <form action={aksi} className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.identitasAria}>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.npwp}</span>
        <input name="npwp" value={npwp} onChange={(e) => setNpwp(e.target.value)} inputMode="numeric" required className={`${isian} font-mono`} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.tku}</span>
        <input name="id_tku" value={tku} onChange={(e) => setTku(e.target.value)} inputMode="numeric" placeholder="NPWP + 000000" className={`${isian} font-mono`} /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpanIdentitas}</Tombol>
        {h && ("galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>)}
      </div>
    </form>
  );
}

/** Pemilik menambahkan akuntan lepasan lewat email akun Nadi-nya. */
export function FormTambahAkuntan({ teks: t }: { teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilIdentitas, FormData>(tambahAkuntan, null);
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-3 text-sm" aria-label={t.tambahAria}>
      <label className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-tinta-2">{t.email}</span>
        <input name="email" type="email" required autoComplete="off" className={isian} /></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menambahkan : t.tambah}</Tombol>
      {h && ("galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>)}
    </form>
  );
}

export function FormCabutAkuntan({ user, email, teks: t }: { user: string; email: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilIdentitas, FormData>(cabutAkuntan, null);
  return (
    <form action={aksi} className="flex items-center gap-2 text-sm">
      <input type="hidden" name="user" value={user} />
      <button type="submit" disabled={sibuk} className="text-tinta-2 underline underline-offset-4" aria-label={isiTeks(t.cabutAria, { email })}>{t.cabut}</button>
      {h && "galat" in h && <span role="alert" className="text-cap">{h.galat}</span>}
    </form>
  );
}
