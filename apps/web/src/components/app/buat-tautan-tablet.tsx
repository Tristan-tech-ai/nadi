"use client";

import { useActionState, useState } from "react";
import { buatTautanTablet, type HasilTautan } from "@/app/app/kios-actions";
import { Tombol } from "@/components/ui/tombol";

/** Formulir tautan tablet. Tautan hanya ditampilkan sekali; setelah halaman ditutup, buat yang baru bila hilang. */
export function BuatTautanTablet() {
  const [hasil, aksi, sedang] = useActionState<HasilTautan, FormData>(buatTautanTablet, null);
  const [tersalin, setTersalin] = useState(false);
  return (
    <div className="mt-4">
      <form action={aksi} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span className="text-tinta-2">Nama tablet</span>
          <input name="nama" maxLength={40} placeholder="Tablet pintu depan" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base" />
        </label>
        <Tombol type="submit" ragam="kedua" disabled={sedang}>{sedang ? "Membuat..." : "Buat tautan tablet"}</Tombol>
      </form>
      {hasil && "galat" in hasil && <p role="alert" className="mt-3 text-sm text-cap">{hasil.galat}</p>}
      {hasil && "tautan" in hasil && (
        <div className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4" data-testid="tautan-tablet">
          <p className="text-sm">Buka tautan ini di {hasil.nama}. Tautan hanya tampil sekali, jadi salin sekarang.</p>
          <p className="mt-2 break-all font-mono text-sm" data-testid="tautan-tablet-isi">{hasil.tautan}</p>
          <Tombol
            ragam="teks"
            className="mt-2 -ml-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(hasil.tautan);
                setTersalin(true);
              } catch {}
            }}
          >
            {tersalin ? "Tersalin" : "Salin tautan"}
          </Tombol>
        </div>
      )}
    </div>
  );
}
