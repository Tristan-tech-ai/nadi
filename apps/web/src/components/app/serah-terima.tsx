"use client";

import { useActionState } from "react";
import { batalkanBerhenti, catatBerhenti, pindahkanSemua, tandaiButir, type HasilSerah } from "@/app/app/serah-terima/actions";
import { Tombol } from "@/components/ui/tombol";

const isian = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";

function Hasil({ h }: { h: HasilSerah }) {
  if (!h) return null;
  return "galat" in h ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : <p role="status" className="text-sm text-daun">{h.pesan}</p>;
}

/** Catat berhenti: orang, tanggal surat, tanggal efektif, alasan. Kunci acak per formulir supaya kirim ulang tidak menggandakan. */
export function FormCatatBerhenti({ orang, pilih, hari, kunci }: { orang: { id: string; nama: string }[]; pilih: string; hari: string; kunci: string }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(catatBerhenti, null);
  const isi = h && "galat" in h ? (h.isian ?? {}) : {};
  return (
    <form key={JSON.stringify(isi)} action={aksi} className="mt-4 grid grid-cols-1 gap-3 rounded-[var(--radius-kartu)] border border-garis p-4 text-sm sm:grid-cols-2" aria-label="Catat berhenti">
      <input type="hidden" name="kunci" value={isi.kunci ?? kunci} />
      <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-tinta-2">Siapa yang berhenti</span>
        <select name="orang" required defaultValue={isi.orang ?? pilih} className={isian}>
          <option value="" disabled>Pilih orang</option>
          {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
        </select></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Tanggal surat diterima</span>
        <input type="date" name="surat" required defaultValue={isi.surat ?? hari} className={isian} /></label>
      <label className="flex flex-col gap-1"><span className="text-tinta-2">Tanggal efektif (hari kerja terakhir)</span>
        <input type="date" name="efektif" required defaultValue={isi.efektif ?? ""} className={isian} /></label>
      <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-tinta-2">Alasan</span>
        <select name="alasan" required defaultValue={isi.alasan ?? "mundur"} className={isian}>
          <option value="mundur">Mengundurkan diri</option>
          <option value="kontrak_selesai">Kontrak selesai</option>
          <option value="lainnya">Lainnya</option>
        </select></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Menyiapkan..." : "Siapkan paket serah terima"}</Tombol>
        <Hasil h={h} />
      </div>
    </form>
  );
}

export function FormPindahkan({ berhenti, jumlah }: { berhenti: string; jumlah: number }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(pindahkanSemua, null);
  return (
    <form action={aksi} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="berhenti" value={berhenti} />
      <Tombol type="submit" ragam="utama" disabled={sibuk || jumlah === 0}>{sibuk ? "Memindah..." : `Pindahkan ${jumlah} kerja ke pengganti`}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

/** Ganti pengganti satu butir kerja/topi. */
export function FormPengganti({ butir, judul, pengganti, orang }: { butir: string; judul: string; pengganti: string | null; orang: { id: string; nama: string }[] }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(tandaiButir, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2" aria-label={`Pengganti ${judul}`}>
      <input type="hidden" name="butir" value={butir} />
      <input type="hidden" name="status" value="terbuka" />
      <label className="sr-only" htmlFor={`pengganti-${butir}`}>Pengganti untuk {judul}</label>
      <select id={`pengganti-${butir}`} name="pengganti" defaultValue={pengganti ?? ""} className={isian}>
        <option value="">Belum ada pengganti</option>
        {orang.map((o) => <option key={o.id} value={o.id}>{o.nama}</option>)}
      </select>
      <Tombol type="submit" ragam="kedua" disabled={sibuk}>Simpan</Tombol>
      <Hasil h={h} />
    </form>
  );
}

/** Centang butir (ilmu, akses manual) selesai atau buka lagi. */
export function FormCentang({ butir, judul, selesai }: { butir: string; judul: string; selesai: boolean }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(tandaiButir, null);
  return (
    <form action={aksi} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="butir" value={butir} />
      <input type="hidden" name="status" value={selesai ? "terbuka" : "selesai"} />
      <Tombol type="submit" ragam="kedua" disabled={sibuk} aria-label={`${selesai ? "Buka lagi" : "Tandai beres"}: ${judul}`}>{selesai ? "Buka lagi" : "Tandai beres"}</Tombol>
      <Hasil h={h} />
    </form>
  );
}

export function FormBatalBerhenti({ berhenti }: { berhenti: string }) {
  const [h, aksi, sibuk] = useActionState<HasilSerah, FormData>(batalkanBerhenti, null);
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-tinta-2">Batalkan proses berhenti</summary>
      <form action={aksi} className="mt-2 flex flex-wrap items-end gap-2" aria-label="Batalkan proses berhenti">
        <input type="hidden" name="berhenti" value={berhenti} />
        <label className="flex min-w-0 flex-1 flex-col gap-1"><span className="text-tinta-2">Alasan</span>
          <input name="alasan" required minLength={3} maxLength={300} className={isian} /></label>
        <Tombol type="submit" ragam="kedua" disabled={sibuk}>Batalkan</Tombol>
        <Hasil h={h} />
      </form>
    </details>
  );
}
