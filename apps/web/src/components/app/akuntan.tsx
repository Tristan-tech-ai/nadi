"use client";

import { useActionState, useState } from "react";
import { aturIdentitas, cabutAkuntan, tambahAkuntan, type HasilIdentitas } from "@/app/app/akuntan/actions";
import { Tombol } from "@/components/ui/tombol";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

/** NPWP pemotong (16 angka) dan ID TKU (22 angka, bawaan NPWP + 000000). Terkendali agar nilai tersimpan tetap terlihat. */
export function FormIdentitas({ awal }: { awal: { npwp?: string; id_tku?: string } | null }) {
  const [h, aksi, sibuk] = useActionState<HasilIdentitas, FormData>(aturIdentitas, null);
  const [npwp, setNpwp] = useState(awal?.npwp ?? "");
  const [tku, setTku] = useState(awal?.id_tku ?? "");
  return (
    <form action={aksi} className="mt-3 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label="Identitas pemotong">
      <label className="flex flex-col gap-1"><span className="text-tinta-2">NPWP pemotong (16 angka)</span>
        <input name="npwp" value={npwp} onChange={(e) => setNpwp(e.target.value)} inputMode="numeric" required className={`${isian} font-mono`} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">ID TKU (22 angka, boleh kosong)</span>
        <input name="id_tku" value={tku} onChange={(e) => setTku(e.target.value)} inputMode="numeric" placeholder="NPWP + 000000" className={`${isian} font-mono`} /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan identitas"}</Tombol>
        {h && ("galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>)}
      </div>
    </form>
  );
}

/** Pemilik menambahkan akuntan lepasan lewat email akun Nadi-nya. */
export function FormTambahAkuntan() {
  const [h, aksi, sibuk] = useActionState<HasilIdentitas, FormData>(tambahAkuntan, null);
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-3 text-sm" aria-label="Tambah akuntan">
      <label className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-tinta-2">Email akun Nadi akuntanmu</span>
        <input name="email" type="email" required autoComplete="off" className={isian} /></label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menambahkan..." : "Tambah akuntan"}</Tombol>
      {h && ("galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>)}
    </form>
  );
}

export function FormCabutAkuntan({ user, email }: { user: string; email: string }) {
  const [h, aksi, sibuk] = useActionState<HasilIdentitas, FormData>(cabutAkuntan, null);
  return (
    <form action={aksi} className="flex items-center gap-2 text-sm">
      <input type="hidden" name="user" value={user} />
      <button type="submit" disabled={sibuk} className="text-tinta-2 underline underline-offset-4" aria-label={`Cabut akses ${email}`}>Cabut akses</button>
      {h && "galat" in h && <span role="alert" className="text-cap">{h.galat}</span>}
    </form>
  );
}
