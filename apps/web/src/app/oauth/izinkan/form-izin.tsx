"use client";

import { useActionState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { putuskanIzin } from "./actions";

type Usaha = { id: string; nama: string; peran: string };

const PERAN: Record<string, string> = { pemilik: "pemilik", admin: "admin", akuntan: "akuntan", staf: "staf" };

/** Formulir izin: pilih usaha, cakupan tulis opsional, lalu Izinkan atau Tolak. */
export function FormIzin({ q, usaha, aktif, mintaUsul, hostKembali }: { q: Record<string, string>; usaha: Usaha[]; aktif: string | null; mintaUsul: boolean; hostKembali: string }) {
  const [pesan, aksi, jalan] = useActionState(putuskanIzin, null);
  return (
    <form action={aksi} className="space-y-6">
      {Object.entries(q).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <fieldset>
        <legend className="text-sm font-semibold">Untuk usaha</legend>
        <div className="mt-2 space-y-2">
          {usaha.map((u) => (
            <label key={u.id} className="flex min-h-12 items-center gap-3 rounded-[var(--radius-isian)] border border-garis px-3 has-[:checked]:border-tinta">
              <input type="radio" name="perusahaan" value={u.id} defaultChecked={u.id === (aktif ?? usaha[0]?.id)} required className="size-4 accent-tinta" />
              <span className="flex-1">{u.nama}</span>
              <span className="text-sm text-tinta-2">kamu {PERAN[u.peran] ?? u.peran}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">Yang boleh dilakukan</legend>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="flex gap-3"><input type="checkbox" checked disabled aria-label="Melihat data (wajib)" className="mt-0.5 size-4 accent-tinta" /><span>Melihat data usaha sesuai peranmu: orang, usulan, ringkasan.</span></li>
          {mintaUsul && (
            <li>
              <label className="flex gap-3">
                <input type="checkbox" name="cakupan_nadi.usul" defaultChecked className="mt-0.5 size-4 accent-tinta" />
                <span>Mengajukan usulan (tambah orang, catat belanja, izin sakit, catatan). Setiap usulan tetap harus kamu atau admin setujui di Nadi.</span>
              </label>
            </li>
          )}
        </ul>
      </fieldset>
      <p className="text-sm text-tinta-2">Setelah kamu memilih, Nadi mengarahkanmu kembali ke <span className="font-semibold text-tinta">{hostKembali}</span>. Izin bisa dicabut kapan saja.</p>
      {pesan && <p role="alert" className="rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap">{pesan}</p>}
      <div className="flex flex-wrap gap-3">
        <Tombol type="submit" name="keputusan" value="izinkan" ukuran="besar" disabled={jalan}>Izinkan</Tombol>
        <Tombol type="submit" name="keputusan" value="tolak" ragam="kedua" ukuran="besar" disabled={jalan}>Tolak</Tombol>
      </div>
    </form>
  );
}
