"use client";

import { useActionState, useId, useState } from "react";
import { aturAktif, kirimFormulir, simpanAlur, simpanFormulir, type HasilAlur } from "@/app/app/alur/actions";
import { Tombol } from "@/components/ui/tombol";
import type { Bidang } from "@/lib/alur/isian";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";

type Teks = Kamus["otomasi"];
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const area = "w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 text-base";

function Hasil({ h }: { h: HasilAlur }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-cap">{h.galat}</p> : <p role="status" className="w-full text-daun">{h.pesan}</p>;
}
function Kolom({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>{children}</div>;
}

export function FormFormulir({ teks: t }: { teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilAlur, FormData>(simpanFormulir, null);
  const id = { n: useId(), i: useId() };
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm" aria-label={t.formulirBaru}>
      <Kolom label={t.namaFormulir} id={id.n}><input id={id.n} name="nama" required minLength={3} maxLength={80} placeholder={t.namaFormulirContoh} className={isian} /></Kolom>
      <Kolom label={t.isian} id={id.i}><textarea id={id.i} name="isian" required rows={4} className={area} placeholder={t.isianContoh} /></Kolom>
      <p className="text-xs text-tinta-2">{t.isianKet}</p>
      <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.buatFormulir}</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormAlur({ formulir, teks: t }: { formulir: { id: string; nama: string; bidang: Bidang[] }[]; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilAlur, FormData>(simpanAlur, null);
  const [pemicu, setPemicu] = useState(formulir[0] ? `formulir:${formulir[0].id}` : "invoice.lunas");
  const id = { n: useId(), p: useId(), k: useId(), j: useId(), w: useId(), b: useId(), d: useId() };
  const baris = [useId(), useId()];
  const dipilih = formulir.find((f) => `formulir:${f.id}` === pemicu);
  const saran = dipilih ? dipilih.bidang.map((b) => b.kunci) : ["nilai"];
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={t.alurBaru}>
      <Kolom label={t.namaAlur} id={id.n}><input id={id.n} name="nama" required minLength={3} maxLength={80} placeholder={t.namaAlurContoh} className={isian} /></Kolom>
      <Kolom label={t.pemicu} id={id.p}>
        <select id={id.p} name="pemicu" value={pemicu} onChange={(e) => setPemicu(e.target.value)} className={isian}>
          {formulir.map((f) => <option key={f.id} value={`formulir:${f.id}`}>{isiTeks(t.pemicuFormulir, { nama: f.nama })}</option>)}
          {(Object.keys(t.pemicuNama) as (keyof Teks["pemicuNama"])[]).map((k) => <option key={k} value={k}>{t.pemicuNama[k]}</option>)}
        </select>
      </Kolom>
      <fieldset className="grid gap-2 sm:col-span-2"><legend className="text-tinta-2">{t.syarat}</legend>
        <datalist id={id.d}>{saran.map((s) => <option key={s} value={s} />)}</datalist>
        {baris.map((b, i) => (
          <div key={b} className="grid grid-cols-[2fr_1fr_2fr] gap-2">
            <label htmlFor={`${b}-b`} className="sr-only">{isiTeks(t.syaratBidang, { n: i + 1 })}</label>
            <input id={`${b}-b`} name={`syarat_bidang_${i}`} list={id.d} placeholder={t.syaratBidangContoh} className={isian} />
            <label htmlFor={`${b}-o`} className="sr-only">{isiTeks(t.syaratOp, { n: i + 1 })}</label>
            <select id={`${b}-o`} name={`syarat_op_${i}`} defaultValue="=" className={isian}>
              {(["=", "!=", ">", ">=", "<", "<=", "berisi"] as const).map((o) => <option key={o} value={o}>{t.opNama[o]}</option>)}</select>
            <label htmlFor={`${b}-n`} className="sr-only">{isiTeks(t.syaratNilai, { n: i + 1 })}</label>
            <input id={`${b}-n`} name={`syarat_nilai_${i}`} maxLength={100} className={isian} />
          </div>
        ))}
        <p className="text-xs text-tinta-2">{dipilih ? isiTeks(t.syaratKetFormulir, { kunci: saran.join(", ") }) : t.syaratKet}</p>
      </fieldset>
      <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3"><legend className="text-tinta-2">{t.aksi}</legend>
        <Kolom label={t.aksiKartu} id={id.k}><input id={id.k} name="kartu" maxLength={140} placeholder={t.aksiKartuContoh} className={isian} /></Kolom>
        <Kolom label={t.aksiKerja} id={id.j}><input id={id.j} name="kerja" maxLength={140} placeholder={t.aksiKerjaContoh} className={isian} /></Kolom>
        <Kolom label={t.aksiWebhook} id={id.w}><input id={id.w} name="webhook" type="url" inputMode="url" maxLength={500} placeholder="https://" className={isian} /></Kolom>
        <p className="text-xs text-tinta-2 sm:col-span-3">{t.aksiKet}</p>
      </fieldset>
      <Kolom label={t.batas} id={id.b}><input id={id.b} name="batas_jam" type="number" min={1} max={500} defaultValue={30} className={`${isian} angka`} /></Kolom>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Tombol type="submit" disabled={sibuk}>{t.buatAlur}</Tombol><Hasil h={h} /></div>
      {h && "rahasia" in h && h.rahasia && (
        <div className="rounded-[var(--radius-kartu)] bg-kertas-2 p-3 sm:col-span-2" data-testid="rahasia-alur">
          <p className="font-semibold">{t.rahasiaJudul}</p><p className="mt-1 break-all font-mono text-xs">{h.rahasia}</p><p className="mt-1 text-xs text-tinta-2">{t.rahasiaKet}</p>
        </div>
      )}
    </form>
  );
}

export function TombolAktif({ alur, aktif, nama, teks: t }: { alur: string; aktif: boolean; nama: string; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilAlur, FormData>(aturAktif, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="alur" value={alur} /><input type="hidden" name="aktif" value={aktif ? "0" : "1"} />
      <Tombol type="submit" ragam="teks" disabled={sibuk}>{aktif ? t.matikan : t.nyalakan}<span className="sr-only"> {nama}</span></Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormIsi({ formulir, teks: t }: { formulir: { id: string; nama: string; bidang: Bidang[] }; teks: Teks }) {
  const [h, aksi, sibuk] = useActionState<HasilAlur, FormData>(kirimFormulir, null);
  const dasar = useId();
  return (
    <form action={aksi} className="mt-3 grid gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label={formulir.nama}>
      <p className="font-semibold sm:col-span-2" data-pengguna>{formulir.nama}</p>
      <input type="hidden" name="formulir" value={formulir.id} />
      {formulir.bidang.map((b, i) => {
        const id = `${dasar}-${i}`;
        const label = b.wajib ? b.label : isiTeks(t.opsional, { label: b.label });
        return (
          <Kolom key={b.kunci} label={label} id={id}>
            {b.jenis === "pilihan" ? (
              <select id={id} name={`f:${b.kunci}`} required={b.wajib} defaultValue="" className={isian}><option value="">{t.pilih}</option>
                {(b.pilihan ?? []).map((p) => <option key={p} value={p} data-pengguna>{p}</option>)}</select>
            ) : (
              <input id={id} name={`f:${b.kunci}`} required={b.wajib} maxLength={300} type={b.jenis === "tanggal" ? "date" : "text"}
                inputMode={b.jenis === "angka" ? "decimal" : undefined} className={`${isian}${b.jenis === "angka" ? " angka" : ""}`} />
            )}
          </Kolom>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Tombol type="submit" ragam="kedua" disabled={sibuk}>{t.kirim}</Tombol><Hasil h={h} /></div>
    </form>
  );
}
