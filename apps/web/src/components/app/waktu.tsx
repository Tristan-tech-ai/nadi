"use client";

import { useActionState } from "react";
import { ajukanLembur, aturGeofence, aturKunci, aturSiaga, type HasilWaktu } from "@/app/app/waktu-actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["waktu"];
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const kotak = "mt-3 flex flex-wrap items-end gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm";

function Hasil({ h }: { h: HasilWaktu }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}
const Label = ({ teks, children }: { teks: string; children: React.ReactNode }) => <label className="flex min-w-0 max-w-full flex-col gap-1"><span className="text-tinta-2">{teks}</span>{children}</label>;

export function FormGeofence({ tempat, titik, radius, teks: t }: { tempat: string; titik: string; radius: number | null; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilWaktu, FormData>(aturGeofence, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.geofenceAria}>
      <input type="hidden" name="tempat" value={tempat} />
      <Label teks={t.titik}><input name="titik" defaultValue={titik} placeholder="-8.6705, 115.2126" inputMode="decimal" className={`${isian} w-56`} /></Label>
      <Label teks={t.radius}><input name="radius" defaultValue={radius ?? 100} inputMode="numeric" className={`${isian} angka w-24 text-right`} /></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanGeofence}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormKunci({ bulan, terkunci, teks: t }: { bulan: { nilai: string; label: string }[]; terkunci: boolean; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilWaktu, FormData>(aturKunci, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.kunciAria}>
      <Label teks={t.bulan}><select name="bulan" className={isian}>{bulan.map((b) => <option key={b.nilai} value={b.nilai}>{b.label}</option>)}</select></Label>
      <Label teks={t.tindakan}><select name="kunci" className={isian} defaultValue={terkunci ? "tidak" : "ya"}><option value="ya">{t.kunci}</option><option value="tidak">{t.buka}</option></select></Label>
      <Label teks={t.alasanBuka}><input name="alasan" maxLength={300} className={isian} /></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.simpanKunci}</Tombol><Hasil h={h} />
    </form>
  );
}

export function FormLembur({ hari, kunci, teks: t }: { hari: string; kunci: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilWaktu, FormData>(ajukanLembur, null);
  return (
    <form action={aksi} className={kotak} aria-label={t.lemburAria} key={h && "pesan" in h ? h.pesan : "f"}>
      <input type="hidden" name="kunci" value={kunci} />
      <Label teks={t.tanggal}><input type="date" name="tanggal" defaultValue={hari} max={hari} required className={isian} /></Label>
      <Label teks={t.jenisHari}><select name="jenis" className={isian}>{Object.entries(t.jenisNama).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Label>
      <Label teks={t.jam}><input name="jam" type="number" min={1} max={12} defaultValue={1} required className={`${isian} angka w-20 text-right`} /></Label>
      <Label teks={t.alasan}><input name="alasan" required minLength={3} maxLength={300} className={isian} /></Label>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.ajukanLembur}</Tombol><Hasil h={h} />
    </form>
  );
}

export function TombolSiaga({ shift, siaga, label, teks: t }: { shift: string; siaga: boolean; label: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilWaktu, FormData>(aturSiaga, null);
  return (
    <form action={aksi} className="inline-flex items-center gap-2">
      <input type="hidden" name="shift" value={shift} /><input type="hidden" name="siaga" value={siaga ? "tidak" : "ya"} />
      <button type="submit" disabled={sibuk} className="text-sm underline underline-offset-4" aria-label={`${siaga ? t.bukanSiaga : t.jadikanSiaga} ${label}`}>{siaga ? t.bukanSiaga : t.jadikanSiaga}</button>
      {h && "galat" in h ? <span role="alert" className="text-cap">{h.galat}</span> : null}
    </form>
  );
}
