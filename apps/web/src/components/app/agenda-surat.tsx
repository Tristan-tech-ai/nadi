"use client";

import { useActionState } from "react";
import { tautPihak, ubahStatus, type HasilSurat } from "@/app/app/surat/actions";
import { Tombol } from "@/components/ui/tombol";

const pilihan = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilSurat }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

export type Kandidat = { id: string; nama: string; yakin: number };

/** Pilih pihak surat: kandidat dari pencocokan nama (bila ragu) atau orang lain dari daftar. */
export function FormTautPihak({ agenda, kandidat, orang, nomor }: { agenda: string; kandidat: Kandidat[]; orang: { id: string; nama: string }[]; nomor: string }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(tautPihak, null);
  return (
    <div className="mt-2 flex flex-col gap-2 text-sm">
      {kandidat.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {kandidat.map((k) => (
            <form key={k.id} action={aksi}>
              <input type="hidden" name="agenda" value={agenda} />
              <input type="hidden" name="orang" value={k.id} />
              <Tombol type="submit" ragam="kedua" disabled={sibuk}>Taut ke {k.nama} ({Math.round(k.yakin * 100)}%)</Tombol>
            </form>
          ))}
        </div>
      )}
      <form action={aksi} className="flex flex-wrap items-end gap-2" aria-label={`Pihak surat ${nomor}`}>
        <input type="hidden" name="agenda" value={agenda} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{kandidat.length ? "Atau pilih orang lain" : "Pilih orang"}</span>
          <select name="orang" required defaultValue="" className={pilihan}>
            <option value="" disabled>Pilih</option>
            {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
          </select></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>Tautkan</Tombol>
      </form>
      <Hasil h={h} />
    </div>
  );
}

/** Status tindak lanjut dan catatan. */
export function FormStatusSurat({ agenda, status, catatan, nomor }: { agenda: string; status: string; catatan: string | null; nomor: string }) {
  const [h, aksi, sibuk] = useActionState<HasilSurat, FormData>(ubahStatus, null);
  return (
    <form action={aksi} className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[auto_1fr_auto] sm:items-end" aria-label={`Tindak lanjut surat ${nomor}`}>
      <input type="hidden" name="agenda" value={agenda} />
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Status</span>
        <select name="status" defaultValue={status} className={pilihan}>
          <option value="baru">Baru</option>
          <option value="ditindaklanjuti">Ditindaklanjuti</option>
          <option value="selesai">Selesai</option>
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Catatan</span>
        <input name="catatan" defaultValue={catatan ?? ""} maxLength={500} placeholder="Misalnya: sudah diteruskan ke Andi" className={pilihan} /></label>
      <div className="flex items-center gap-3">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyimpan..." : "Simpan"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}
