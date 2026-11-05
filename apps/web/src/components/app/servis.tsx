"use client";

import { useActionState, useId } from "react";
import { tagihServis, terimaBarang, ubahStatusServis, type HasilServis } from "@/app/app/servis/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["servis"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilServis }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}
function Kolom({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>{children}</div>;
}

export function FormTerima({ kunci, hariIni, teks: t }: { kunci: string; hariIni: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilServis, FormData>(terimaBarang, null);
  const id = { p: useId(), hp: useId(), i: useId(), k: useId(), e: useId(), j: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-3" aria-label={t.terimaJudul} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      <Kolom label={t.pelanggan} id={id.p}><input id={id.p} name="pelanggan" required maxLength={100} className={isian} /></Kolom>
      <Kolom label={t.hp} id={id.hp}><input id={id.hp} name="hp" inputMode="tel" placeholder="0812-3456-7890" className={isian} /></Kolom>
      <Kolom label={t.item} id={id.i}><input id={id.i} name="item" required minLength={2} maxLength={160} placeholder={t.itemContoh} className={isian} /></Kolom>
      <div className="sm:col-span-3"><Kolom label={t.keluhan} id={id.k}><input id={id.k} name="keluhan" maxLength={500} className={isian} /></Kolom></div>
      <Kolom label={t.estimasi} id={id.e}><input id={id.e} name="estimasi" inputMode="numeric" className={`${isian} angka`} /></Kolom>
      <Kolom label={t.janji} id={id.j}><input id={id.j} name="janji" type="date" min={hariIni} className={isian} /></Kolom>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" disabled={sibuk}>{t.simpan}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

const BERIKUT: Record<string, "dikerjakan" | "selesai" | "diambil" | undefined> = { diterima: "dikerjakan", dikerjakan: "selesai", selesai: "diambil" };

export function LangkahServis({ id, nomor, status, teks: t }: { id: string; nomor: string; status: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilServis, FormData>(ubahStatusServis, null);
  const idAlasan = useId();
  const lanjut = BERIKUT[status];
  return (
    <form action={aksi} className="flex flex-wrap items-end gap-2 text-sm" aria-label={nomor}>
      <input type="hidden" name="id" value={id} />
      {lanjut && <Tombol type="submit" name="status" value={lanjut} disabled={sibuk}>{t.maju[lanjut]}</Tombol>}
      <div className="flex flex-col gap-1"><label htmlFor={idAlasan} className="sr-only">{t.alasan}</label>
        <input id={idAlasan} name="alasan" maxLength={200} placeholder={t.alasan} className="h-10 w-40 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base" /></div>
      <Tombol type="submit" ragam="teks" name="status" value="batal" disabled={sibuk}>{t.batal}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormTagih({ id, nomor, uraian, estimasi, teks: t }: { id: string; nomor: string; uraian: string; estimasi: number | null; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilServis, FormData>(tagihServis, null);
  const idU = useId(), idH = useId();
  return (
    <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2 text-sm" aria-label={`${t.tagih} ${nomor}`}>
      <input type="hidden" name="id" value={id} />
      <div className="flex min-w-0 flex-1 flex-col gap-1"><label htmlFor={idU} className="text-tinta-2">{t.uraian}</label>
        <input id={idU} name="uraian" required defaultValue={uraian} maxLength={120} className={isian} /></div>
      <div className="flex flex-col gap-1"><label htmlFor={idH} className="text-tinta-2">{t.harga}</label>
        <input id={idH} name="harga" required inputMode="numeric" defaultValue={estimasi ? String(estimasi) : ""} className={`${isian} angka w-36`} /></div>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.tagih}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

