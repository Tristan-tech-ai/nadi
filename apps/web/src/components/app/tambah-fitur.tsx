"use client";

import { useActionState, useId } from "react";
import { aturMod, pasangPaket, simpanManifest, terapkanDraf, type HasilTambah } from "@/app/app/tambah-fitur/actions";
import { Tombol } from "@/components/ui/tombol";

// X-06: tombol dan formulir halaman Tambah fitur. Hasil dari server tampil sebagai teks (status atau galat + alasan pengawas).
function Hasil({ h }: { h: HasilTambah }) {
  if (!h) return null;
  if ("pesan" in h) return <p role="status" className="w-full text-sm text-daun">{h.pesan}</p>;
  return (
    <div role="alert" className="w-full text-sm text-cap">
      <p>{h.galat}</p>
      {h.alasan && h.alasan.length > 0 && <ul className="mt-1 list-disc pl-5" data-testid="alasan-pengawas">{h.alasan.slice(0, 20).map((a, i) => <li key={i}>{a}</li>)}</ul>}
    </div>
  );
}

type Aksi = (s: HasilTambah, f: FormData) => Promise<HasilTambah>;
function SatuTombol({ aksi, isian, label, ragam = "kedua", nama }: { aksi: Aksi; isian: Record<string, string>; label: string; ragam?: "utama" | "kedua" | "bahaya"; nama: string }) {
  const [h, kirim, sibuk] = useActionState<HasilTambah, FormData>(aksi, null);
  return (
    <form action={kirim} className="flex flex-wrap items-center gap-2" aria-label={nama}>
      {Object.entries(isian).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Tombol type="submit" ragam={ragam} disabled={sibuk}>{sibuk ? "Memproses..." : label}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export const TombolPasang = ({ kode, nama }: { kode: string; nama: string }) =>
  <SatuTombol aksi={pasangPaket} isian={{ kode }} label="Pasang" ragam="utama" nama={`Pasang ${nama}`} />;
export const TombolAturMod = ({ id, aksi, nama }: { id: string; aksi: "matikan" | "nyalakan"; nama: string }) =>
  <SatuTombol aksi={aturMod} isian={{ id, aksi }} label={aksi === "matikan" ? "Lepas" : "Pasang lagi"} ragam={aksi === "matikan" ? "kedua" : "utama"} nama={`${aksi === "matikan" ? "Lepas" : "Pasang lagi"} ${nama}`} />;
export const TombolTerapkan = ({ id, nama }: { id: string; nama: string }) =>
  <SatuTombol aksi={terapkanDraf} isian={{ id }} label="Terapkan" ragam="utama" nama={`Terapkan ${nama}`} />;

export function FormManifest() {
  const [h, kirim, sibuk] = useActionState<HasilTambah, FormData>(simpanManifest, null);
  const id = useId();
  return (
    <form action={kirim} className="grid gap-3" aria-label="Simpan fitur buatan sendiri">
      <label htmlFor={id} className="text-sm text-tinta-2">Isi fitur (manifest JSON)</label>
      <textarea id={id} name="manifest" required rows={10} maxLength={65536} spellCheck={false}
        className="w-full rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas p-2 font-mono text-sm" placeholder='{"skema": 1, "kode": "...", ...}' />
      <div className="flex flex-wrap items-center gap-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Memeriksa..." : "Periksa dan simpan draf"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}
