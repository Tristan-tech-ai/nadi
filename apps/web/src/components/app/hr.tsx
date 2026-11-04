"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { cloneElement, useActionState, useId } from "react";
import { beriSp, centangPeriksa, mulaiPeriksa, ubahProfil, type HasilHr } from "@/app/app/orang/kerja/actions";
import { buatPengumuman, tandaiBaca, type HasilPengumuman } from "@/app/app/pengumuman/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Kamus } from "@/lib/i18n/kamus";

type T = Kamus["hr"];
type Orang = { id: string; nama: string };
const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
/** Label eksplisit (htmlFor + id): label pembungkus select ikut membawa teks opsi ke nama aksesibel. */
function Kolom({ label, children, lebar = false }: { label: string; children: React.ReactElement<{ id?: string }>; lebar?: boolean }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${lebar ? "col-span-2" : ""}`}><label htmlFor={id} className="text-tinta-2">{label}</label>{cloneElement(children, { id })}</div>
  );
}
function Hasil({ h }: { h: HasilHr | HasilPengumuman }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-cap">{h.galat}</p> : <p role="status" className="text-daun">{h.pesan}</p>;
}

export function FormProfil({ orang, teks: t }: { orang: Orang[]; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilHr, FormData>(ubahProfil, null);
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.profilAria}>
      <Kolom label={t.orang} lebar><select name="orang" required defaultValue="" className={isian}><option value="" disabled>{t.pilih}</option>{orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}</select></Kolom>
      <Kolom label={t.jabatan}><input name="jabatan" maxLength={80} className={isian} /></Kolom>
      <Kolom label={t.level}><input name="level" maxLength={40} placeholder={t.levelContoh} className={isian} /></Kolom>
      <Kolom label={t.departemen}><input name="departemen" maxLength={60} className={isian} /></Kolom>
      <Kolom label={t.atasan}><select name="atasan" defaultValue="" className={isian}><option value="">{t.tanpaAtasan}</option>{orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}</select></Kolom>
      <Kolom label={t.status}><select name="status" defaultValue="" className={isian}><option value="">{t.statusKosong}</option>{(Object.keys(t.statusNama) as (keyof T["statusNama"])[]).map((s) => <option key={s} value={s}>{t.statusNama[s]}</option>)}</select></Kolom>
      <Kolom label={t.kontrakSampai}><input type="date" name="kontrak_sampai" className={isian} /></Kolom>
      <Kolom label={t.jenis}><select name="jenis" defaultValue="perubahan" className={isian}>{(Object.keys(t.jenisNama) as (keyof T["jenisNama"])[]).map((s) => <option key={s} value={s}>{t.jenisNama[s]}</option>)}</select></Kolom>
      <Kolom label={t.berlakuDari}><input type="date" name="berlaku_dari" className={isian} /></Kolom>
      <Kolom label={t.catatan} lebar><input name="catatan" maxLength={300} className={isian} /></Kolom>
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.simpanProfil}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormSp({ orang, kunci, hari, teks: t }: { orang: Orang[]; kunci: string; hari: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilHr, FormData>(beriSp, null);
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.spAria}>
      <input type="hidden" name="kunci" value={kunci} />
      <Kolom label={t.orang}><select name="orang" required defaultValue="" className={isian}><option value="" disabled>{t.pilih}</option>{orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}</select></Kolom>
      <Kolom label={t.tanggal}><input type="date" name="tanggal" required max={hari} defaultValue={hari} className={isian} /></Kolom>
      <Kolom label={t.pelanggaran} lebar><input name="pelanggaran" required minLength={5} maxLength={500} placeholder={t.pelanggaranContoh} className={isian} /></Kolom>
      <Kolom label={t.dasar}><input name="dasar" maxLength={200} placeholder={t.dasarContoh} className={isian} /></Kolom>
      <Kolom label={t.masa}><input name="masa" type="number" min={1} max={12} defaultValue={6} className={isian} /></Kolom>
      <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="terakhir" className="size-5" /><span>{t.terakhir}</span></label>
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? t.menyimpan : t.beriSp}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormMulaiPeriksa({ orang, teks: t }: { orang: Orang[]; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilHr, FormData>(mulaiPeriksa, null);
  return (
    <form action={aksi} className="mt-3 grid grid-cols-2 gap-3 text-sm" aria-label={t.periksaAria}>
      <Kolom label={t.orang}><select name="orang" required defaultValue="" className={isian}><option value="" disabled>{t.pilih}</option>{orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}</select></Kolom>
      <Kolom label={t.jenisPeriksa}><select name="jenis" defaultValue="onboarding" className={isian}><option value="onboarding">{t.onboarding}</option><option value="offboarding">{t.offboarding}</option></select></Kolom>
      <div className="col-span-2 flex flex-col items-start gap-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.mulaiPeriksa}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function CentangPeriksa({ id, butir, selesai }: { id: string; butir: string; selesai: boolean }) {
  const [, aksi, sibuk] = useActionState<HasilHr, FormData>(centangPeriksa, null);
  return (
    <form action={aksi}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="selesai" value={selesai ? "0" : "1"} />
      <button type="submit" disabled={sibuk} aria-pressed={selesai} className="flex min-h-10 items-center gap-2 text-left">
        <span aria-hidden className={`inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] border-2 border-tinta ${selesai ? "bg-tinta text-kertas" : ""}`}>{selesai ? <CheckIcon size={14} weight="bold" /> : null}</span>
        <span className={selesai ? "text-tinta-2 line-through" : ""}>{butir}</span>
      </button>
    </form>
  );
}

export function FormPengumuman({ kunci, teks: t }: { kunci: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilPengumuman, FormData>(buatPengumuman, null);
  return (
    <form action={aksi} className="mt-3 flex flex-col gap-3 text-sm" aria-label={t.pengumumanAria}>
      <input type="hidden" name="kunci" value={kunci} />
      <Kolom label={t.judulPengumuman}><input name="judul" required minLength={3} maxLength={120} className={isian} /></Kolom>
      <Kolom label={t.isiPengumuman}><textarea name="isi" required minLength={3} maxLength={4000} rows={4} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 py-2 text-base" /></Kolom>
      <fieldset className="flex flex-wrap gap-4"><legend className="mb-1 text-tinta-2">{t.untuk}</legend>
        {(["staf", "admin", "akuntan"] as const).map((p) => <label key={p} className="flex items-center gap-2"><input type="checkbox" name="untuk" value={p} className="size-5" /><span>{t.peranNama[p]}</span></label>)}
      </fieldset>
      <p className="text-xs text-tinta-2">{t.untukKet}</p>
      <div className="flex flex-col items-start gap-2"><Tombol type="submit" disabled={sibuk}>{sibuk ? t.menyimpan : t.kirimPengumuman}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function TombolBaca({ id, judul, teks: t }: { id: string; judul: string; teks: T }) {
  const [h, aksi, sibuk] = useActionState<HasilPengumuman, FormData>(tandaiBaca, null);
  return (
    <form action={aksi} className="mt-2">
      <input type="hidden" name="id" value={id} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={`${t.tandaiBaca}: ${judul}`}>{t.tandaiBaca}</Tombol>
      {h && "galat" in h && <p role="alert" className="mt-1 text-cap">{h.galat}</p>}
    </form>
  );
}
