"use client";

import { useActionState, useId } from "react";
import { buatProyek, catatJam, simpanRab, tandaiJurnal, type HasilProyek } from "@/app/app/proyek/actions";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["proyek"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilProyek }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}
function Kolom({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>{children}</div>;
}

export function FormProyekBaru({ teks: t }: { teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilProyek, FormData>(buatProyek, null);
  const id = useId();
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-end gap-3 text-sm" aria-label={t.proyekBaru} key={h && "pesan" in h ? h.pesan : "f"}>
      <div className="min-w-0 flex-1"><Kolom label={t.namaProyek} id={id}><input id={id} name="nama" required minLength={2} maxLength={60} placeholder={t.namaContoh} className={isian} /></Kolom></div>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.buat}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormRab({ proyek, akun, teks: t }: { proyek: string; akun: { kode: string; nama: string }[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilProyek, FormData>(simpanRab, null);
  const id = { a: useId(), n: useId(), c: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm sm:grid-cols-3" aria-label={t.rabJudul}>
      <input type="hidden" name="proyek" value={proyek} />
      <Kolom label={t.akun} id={id.a}><select id={id.a} name="akun" required defaultValue="" className={isian}><option value="">{t.pilihAkun}</option>
        {akun.map((a) => <option key={a.kode} value={a.kode}>{a.kode} {a.nama}</option>)}</select></Kolom>
      <Kolom label={t.nominal} id={id.n}><input id={id.n} name="nominal" required inputMode="numeric" className={`${isian} angka`} /></Kolom>
      <Kolom label={t.catatan} id={id.c}><input id={id.c} name="catatan" maxLength={200} className={isian} /></Kolom>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" disabled={sibuk}>{t.simpanRab}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function TombolTandai({ jurnal, proyek, namaProyek, label, teks: t }: { jurnal: string; proyek: string; namaProyek: string; label: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilProyek, FormData>(tandaiJurnal, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2" aria-label={label}>
      <input type="hidden" name="jurnal" value={jurnal} /><input type="hidden" name="proyek" value={proyek} />
      <Tombol type="submit" ragam="teks" disabled={sibuk}>{isiTeks(t.tandai, { proyek: namaProyek })}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormJam({ proyek, orang, hariIni, teks: t }: { proyek: { id: string; nama: string }[]; orang: { id: string; nama: string }[] | null; hariIni: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilProyek, FormData>(catatJam, null);
  const id = { p: useId(), o: useId(), t: useId(), j: useId(), c: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 text-sm sm:grid-cols-3" aria-label={t.jamJudul} key={h && "pesan" in h ? h.pesan : "f"}>
      <Kolom label={t.pilih} id={id.p}><select id={id.p} name="proyek" required defaultValue={proyek.length === 1 ? proyek[0].id : ""} className={isian}>
        <option value="">{t.pilih}</option>{proyek.map((p) => <option key={p.id} value={p.id} data-pengguna>{p.nama}</option>)}</select></Kolom>
      {orang && <Kolom label={t.orang} id={id.o}><select id={id.o} name="orang" defaultValue="" className={isian}><option value="">{t.diriSendiri}</option>
        {orang.map((o) => <option key={o.id} value={o.id} data-pengguna>{o.nama}</option>)}</select></Kolom>}
      <Kolom label={t.tanggal} id={id.t}><input id={id.t} name="tanggal" type="date" required defaultValue={hariIni} max={hariIni} className={isian} /></Kolom>
      <Kolom label={t.jam} id={id.j}><input id={id.j} name="jam" required inputMode="decimal" className={`${isian} angka`} /></Kolom>
      <Kolom label={t.catatan} id={id.c}><input id={id.c} name="catatan" maxLength={200} className={isian} /></Kolom>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.catatJam}</Tombol><Hasil h={h} /></div>
    </form>
  );
}
