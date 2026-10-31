"use client";

import { useActionState, useEffect } from "react";
import { putuskan, type HasilPutusan } from "@/app/app/actions";
import { useCatatPutusan } from "@/components/app/halaman-feed";
import { Cap } from "@/components/ui/cap";
import { Tombol } from "@/components/ui/tombol";

/** Tombol Setujui/Tolak di kartu Feed. Tetap bekerja tanpa JavaScript (form biasa); dengan JS menampilkan hasilnya. */
export function AksiPutusan({ usulanId }: { usulanId: string }) {
  const [hasil, aksi, sibuk] = useActionState<HasilPutusan, FormData>(putuskan, {});
  const catat = useCatatPutusan();
  // Status hanya terisi sekali (setelah itu formulir diganti cap), jadi setiap kartu tercatat paling banyak sekali.
  useEffect(() => {
    if (hasil.status) catat();
  }, [hasil.status, catat]);
  if (hasil.status)
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-sm" data-testid="hasil-putusan">
        <Cap jenis={hasil.status} />
        <span>{hasil.pesan}</span>
      </p>
    );
  return (
    <form action={aksi} className="flex w-full flex-col gap-2">
      <input type="hidden" name="usulan" value={usulanId} />
      <div className="flex gap-2">
        <Tombol type="submit" name="keputusan" value="setuju" ukuran="besar" className="flex-1" disabled={sibuk}>
          {sibuk ? "Menyimpan..." : "Setujui"}
        </Tombol>
        <Tombol type="submit" name="keputusan" value="tolak" ukuran="besar" ragam="kedua" disabled={sibuk}>
          Tolak
        </Tombol>
      </div>
      {hasil.galat ? <p role="alert" className="text-sm text-cap">{hasil.galat}</p> : null}
    </form>
  );
}
