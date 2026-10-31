"use client";

import { useActionState, useRef } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { batalkanKolam, setujuiKolam, type HasilKerja } from "@/app/app/kerja/actions";
import { Tombol } from "@/components/ui/tombol";
import { csvKolam, namaBerkasKolam, type BarisKolam, type Pengecualian } from "@/lib/gaji/kolam";

const isian = "rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";

/**
 * Satu tombol utama layar kolam (ANTI-SLOP S22). Pratinjau disimpan sebagai draf lalu disetujui dalam satu kiriman; kunci
 * idempoten dibuat sekali per pratinjau, jadi kiriman ulang mengembalikan draf yang sama, bukan kolam kembar.
 */
export function SetujuiKolam({ bulan, jumlah, dikecualikan, namaBulan }: { bulan: string; jumlah: number; dikecualikan: Pengecualian[]; namaBulan: string }) {
  const kunci = useRef<string | null>(null);
  const [h, aksi, sibuk] = useActionState<HasilKerja, FormData>(async (lalu, fd) => {
    kunci.current ??= crypto.randomUUID();
    fd.set("kunci", kunci.current);
    const r = await setujuiKolam(lalu, fd);
    if (r && "galat" in r) kunci.current = null;
    return r;
  }, null);
  return (
    <form action={aksi} className="mt-4 grid gap-2" aria-label={`Setujui pembagian kolam ${namaBulan}`} data-testid="form-setujui-kolam">
      <input type="hidden" name="bulan" value={bulan} />
      <input type="hidden" name="jumlah" value={jumlah} />
      <input type="hidden" name="dikecualikan" value={JSON.stringify(dikecualikan)} />
      {h && "galat" in h && <p role="alert" className="text-sm text-cap" data-testid="galat-setujui-kolam">{h.galat}</p>}
      {h && "pesan" in h && <p role="status" className="text-sm text-daun" data-testid="hasil-setujui-kolam">{h.pesan}</p>}
      <div>
        <Tombol type="submit" ukuran="besar" disabled={sibuk}>{sibuk ? "Menyetujui..." : "Setujui pembagian"}</Tombol>
      </div>
    </form>
  );
}

/** Ekspor CSV di browser (data sudah ada di layar; tidak ada salinan di server). */
export function UnduhCsvKolam({ baris, bulan, namaBulan }: { baris: BarisKolam[]; bulan: string; namaBulan: string }) {
  const unduh = () => {
    const blob = new Blob([csvKolam(baris, { bulan, namaBulan })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = namaBerkasKolam(bulan);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Tombol ragam="kedua" onClick={unduh} data-testid="unduh-csv-kolam">
      <DownloadSimpleIcon size={18} aria-hidden /> Unduh CSV
    </Tombol>
  );
}

/** Batalkan pembagian yang disetujui selama gaji bulan itu belum disetujui (alasan wajib, tercatat). */
export function BatalKolam({ kolam, namaBulan }: { kolam: string; namaBulan: string }) {
  const [h, aksi, sibuk] = useActionState<HasilKerja, FormData>(batalkanKolam, null);
  return (
    <details className="mt-6 text-sm" data-testid="batal-kolam">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-tinta-2 underline-offset-4 hover:underline">Batalkan pembagian {namaBulan}</summary>
      <form action={aksi} className="mt-2 grid max-w-md gap-2" aria-label={`Batalkan pembagian kolam ${namaBulan}`}>
        <input type="hidden" name="kolam" value={kolam} />
        <label className="flex flex-col gap-1">
          <span className="text-tinta-2">Alasan membatalkan</span>
          <input name="alasan" required minLength={3} maxLength={300} placeholder="Jumlah kolam salah ketik" className={`h-10 ${isian}`} />
        </label>
        <p className="text-tinta-2">Insentif dicabut dari slip draf bulan itu. Bisa dilakukan sampai gaji bulan itu disetujui.</p>
        {h && "galat" in h && <p role="alert" className="text-cap">{h.galat}</p>}
        {h && "pesan" in h && <p role="status" className="text-daun">{h.pesan}</p>}
        <div><Tombol type="submit" ragam="bahaya" disabled={sibuk}>{sibuk ? "Membatalkan..." : "Batalkan pembagian"}</Tombol></div>
      </form>
    </details>
  );
}
