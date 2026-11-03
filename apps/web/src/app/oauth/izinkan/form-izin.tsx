"use client";

import { useActionState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { sisip } from "@/lib/i18n/sisip";
import { putuskanIzin } from "./actions";

type Usaha = { id: string; nama: string; peran: string };


/** Formulir izin: pilih usaha, cakupan tulis opsional, lalu Izinkan atau Tolak. */
export function FormIzin({ q, usaha, aktif, mintaUsul, hostKembali, teks: t }: { q: Record<string, string>; usaha: Usaha[]; aktif: string | null; mintaUsul: boolean; hostKembali: string; teks: Kamus["oauthIzin"] }) {
  const PERAN: Record<string, string> = { pemilik: t.pPemilik, admin: t.pAdmin, akuntan: t.pAkuntan, staf: t.pStaf };
  const [pesan, aksi, jalan] = useActionState(putuskanIzin, null);
  return (
    <form action={aksi} className="space-y-6">
      {Object.entries(q).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <fieldset>
        <legend className="text-sm font-semibold">{t.untukUsaha}</legend>
        <div className="mt-2 space-y-2">
          {usaha.map((u) => (
            <label key={u.id} className="flex min-h-12 items-center gap-3 rounded-[var(--radius-isian)] border border-garis px-3 has-[:checked]:border-tinta">
              <input type="radio" name="perusahaan" value={u.id} defaultChecked={u.id === (aktif ?? usaha[0]?.id)} required className="size-4 accent-tinta" />
              <span className="flex-1" data-pengguna>{u.nama}</span>
              <span className="text-sm text-tinta-2">{isiTeks(t.kamuPeran, { peran: PERAN[u.peran] ?? u.peran })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t.bolehApa}</legend>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="flex gap-3"><input type="checkbox" checked disabled aria-label={t.lihatAria} className="mt-0.5 size-4 accent-tinta" /><span>{t.lihat}</span></li>
          {mintaUsul && (
            <li>
              <label className="flex gap-3">
                <input type="checkbox" name="cakupan_nadi.usul" defaultChecked className="mt-0.5 size-4 accent-tinta" />
                <span>{t.usul}</span>
              </label>
            </li>
          )}
        </ul>
      </fieldset>
      <p className="text-sm text-tinta-2">{sisip(t.arahKembali, { host: <span className="font-semibold text-tinta">{hostKembali}</span> })}</p>
      {pesan && <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{pesan}</p>}
      <div className="flex flex-wrap gap-3">
        <Tombol type="submit" name="keputusan" value="izinkan" ukuran="besar" disabled={jalan}>{t.izinkan}</Tombol>
        <Tombol type="submit" name="keputusan" value="tolak" ragam="kedua" ukuran="besar" disabled={jalan}>{t.tolak}</Tombol>
      </div>
    </form>
  );
}
