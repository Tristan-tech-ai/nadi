"use client";

import { useActionState, useId } from "react";
import { aturStatusProyek, buatProyekOps, simpanTemplate, tagihProyek, type HasilOps } from "@/app/app/proyek/ops-actions";
import { Tombol } from "@/components/ui/tombol";

// X-12 bagian Proyek operasional di halaman Proyek: template (dengan pratinjau isinya), buat proyek, status, tagih.
type Opsi = { id: string; nama: string };
const isian = "h-10 w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
function Hasil({ h }: { h: HasilOps }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="w-full text-sm text-cap">{h.galat}</p> : <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
}
function Kolom({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="text-tinta-2">{label}</label>{children}</div>;
}

export function FormTemplate() {
  const [h, kirim, sibuk] = useActionState<HasilOps, FormData>(simpanTemplate, null);
  const id = useId();
  return (
    <form action={kirim} className="grid gap-3 text-sm" aria-label="Simpan template proyek" key={h && "pesan" in h ? h.pesan : "f"}>
      <Kolom label="Nama template" id={`${id}-n`}><input id={`${id}-n`} name="nama" required minLength={3} maxLength={80} className={isian} /></Kolom>
      <Kolom label="Kerja (satu per baris: judul | hari ke- | butir; butir | poin)" id={`${id}-i`}>
        <textarea id={`${id}-i`} name="isi" required rows={4} className="rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 font-mono text-sm"
          placeholder={"Brief klien | 0 | Kumpulkan logo; Konfirmasi warna | 1\nDesain materi | 3 | Draf 1 | 4"} />
      </Kolom>
      <div className="flex flex-wrap items-center gap-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>Simpan template</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function FormProyekOps({ orang, klien, template }: { orang: Opsi[]; klien: Opsi[]; template: Opsi[] }) {
  const [h, kirim, sibuk] = useActionState<HasilOps, FormData>(buatProyekOps, null);
  const id = useId();
  return (
    <form action={kirim} className="grid gap-3 text-sm sm:grid-cols-2" aria-label="Buat proyek operasional" key={h && "pesan" in h ? h.pesan : "f"}>
      <Kolom label="Nama proyek" id={`${id}-n`}><input id={`${id}-n`} name="nama" required minLength={3} maxLength={120} className={isian} /></Kolom>
      <Kolom label="Tipe" id={`${id}-t`}><select id={`${id}-t`} name="tipe" className={isian}><option value="sekali">Sekali</option><option value="berulang">Berulang</option><option value="berkelanjutan">Berkelanjutan</option></select></Kolom>
      <Kolom label="Pola (untuk berulang)" id={`${id}-p`}><select id={`${id}-p`} name="pola" className={isian}><option value="">Tidak berulang</option><option value="mingguan">Mingguan</option><option value="bulanan">Bulanan</option></select></Kolom>
      <Kolom label="Template" id={`${id}-tp`}><select id={`${id}-tp`} name="template" className={isian}><option value="">Tanpa template</option>{template.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select></Kolom>
      <Kolom label="Klien" id={`${id}-k`}><select id={`${id}-k`} name="klien" className={isian}><option value="">Tanpa klien</option>{klien.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select></Kolom>
      <Kolom label="PIC" id={`${id}-pic`}><select id={`${id}-pic`} name="pic" className={isian}><option value="">Pilih PIC</option>{orang.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}</select></Kolom>
      <Kolom label="Mulai" id={`${id}-m`}><input id={`${id}-m`} name="mulai" type="date" className={isian} /></Kolom>
      <Kolom label="Target selesai" id={`${id}-tg`}><input id={`${id}-tg`} name="target" type="date" className={isian} /></Kolom>
      <fieldset className="sm:col-span-2"><legend className="text-tinta-2">Tim</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{orang.map((x) => <label key={x.id} className="inline-flex min-h-8 items-center gap-2"><input type="checkbox" name="tim" value={x.id} className="size-4" /><span data-pengguna>{x.nama}</span></label>)}</div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><Tombol type="submit" disabled={sibuk}>Buat proyek</Tombol><Hasil h={h} /></div>
    </form>
  );
}

export function StatusProyek({ proyek, status }: { proyek: string; status: string }) {
  const [h, kirim, sibuk] = useActionState<HasilOps, FormData>(aturStatusProyek, null);
  const id = useId();
  return (
    <form action={kirim} className="flex flex-wrap items-center gap-2 text-sm" aria-label="Ubah status proyek">
      <input type="hidden" name="proyek" value={proyek} />
      <label htmlFor={id} className="sr-only">Status proyek</label>
      <select id={id} name="status" defaultValue={status} className="h-9 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2">
        {["rencana", "jalan", "tunda", "selesai", "batal"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
      </select>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>Simpan</Tombol>
      {h && "galat" in h && <Hasil h={h} />}
    </form>
  );
}

export function TagihProyek({ proyek, nama }: { proyek: string; nama: string }) {
  const [h, kirim, sibuk] = useActionState<HasilOps, FormData>(tagihProyek, null);
  const id = useId();
  return (
    <details className="text-sm" data-testid="tagih-proyek">
      <summary className="cursor-pointer font-semibold">Buat invoice dari proyek</summary>
      <form action={kirim} className="mt-2 grid gap-2 sm:grid-cols-3" aria-label={`Invoice ${nama}`}>
        <input type="hidden" name="proyek" value={proyek} />
        <Kolom label="Uraian" id={`${id}-u`}><input id={`${id}-u`} name="uraian" required maxLength={200} className={isian} /></Kolom>
        <Kolom label="Nilai (Rp)" id={`${id}-v`}><input id={`${id}-v`} name="nilai" required inputMode="numeric" className={`${isian} angka`} /></Kolom>
        <Kolom label="Jatuh tempo" id={`${id}-j`}><input id={`${id}-j`} name="jatuh_tempo" type="date" className={isian} /></Kolom>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3"><Tombol type="submit" ragam="kedua" disabled={sibuk}>Buat invoice</Tombol><Hasil h={h} /></div>
      </form>
    </details>
  );
}
