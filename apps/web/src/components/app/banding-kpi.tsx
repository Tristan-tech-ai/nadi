"use client";

import { useActionState, useRef, useState } from "react";
import { useOffline } from "next/offline";
import { FlagIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { tandaiKeliru, type HasilKerja } from "@/app/app/kerja/actions";
import { Tombol } from "@/components/ui/tombol";

type Pilihan = { id: string; judul: string; hari: string; ditandai: boolean };

const isian = "rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-3 text-base";

/**
 * "Ada yang keliru? Tandai kerjanya, pemilik akan melihat." (docs/design/kpi-cermin.md). Formulir terbuka di bawah tautan teks,
 * bukan tombol utama: layar cermin untuk membaca, banding jalan samping. Kunci idempoten dibuat sekali per isian; kiriman ulang
 * useOffline membawa kunci yang sama sehingga pemilik tidak menerima usulan kembar.
 */
export function BandingKpi({ kerja }: { kerja: Pilihan[] }) {
  const [buka, setBuka] = useState(false);
  const [versi, setVersi] = useState(0);
  const luring = useOffline();
  const kunci = useRef<string | null>(null);
  const [h, aksi, sibuk] = useActionState<HasilKerja, FormData>(async (lalu, fd) => {
    kunci.current ??= crypto.randomUUID();
    fd.set("kunci", kunci.current);
    const r = await tandaiKeliru(lalu, fd);
    if (r && "pesan" in r) {
      kunci.current = null;
      setVersi((v) => v + 1);
      setBuka(false);
    }
    return r;
  }, null);
  const bisa = kerja.filter((k) => !k.ditandai);

  return (
    <section aria-labelledby="judul-banding" className="mt-8 border-t border-garis pt-4" data-testid="banding-kpi">
      <h3 id="judul-banding" className="font-semibold">Ada yang keliru?</h3>
      <p className="mt-1 text-sm text-tinta-2">Tandai kerjanya, pemilik akan melihat. Angka tidak berubah sampai pemilik meninjaunya.</p>
      {h && "pesan" in h && <p role="status" className="mt-2 text-sm text-daun" data-testid="hasil-banding">{h.pesan}</p>}
      {bisa.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-2" data-testid="banding-kosong">
          {kerja.length ? "Semua kerja minggu ini sudah kamu tandai." : "Belum ada kerja selesai minggu ini yang bisa ditandai."}
        </p>
      ) : !buka ? (
        <Tombol ragam="kedua" className="mt-3" onClick={() => setBuka(true)}>
          <FlagIcon size={18} aria-hidden /> Tandai kerja yang keliru
        </Tombol>
      ) : (
        <form key={versi} action={aksi} className="mt-3 grid gap-3" aria-label="Tandai kerja yang keliru" data-testid="form-banding">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-tinta-2">Kerja</span>
            <select name="kerja" required defaultValue="" className={`h-10 ${isian}`}>
              <option value="" disabled>Pilih kerja</option>
              {bisa.map((k) => <option key={k.id} value={k.id}>{k.judul} ({k.hari})</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-tinta-2">Apa yang keliru?</span>
            <textarea name="alasan" required minLength={3} maxLength={500} rows={3} placeholder="Tenggatnya diundur pemilik hari Senin" className={`py-2 ${isian}`} />
          </label>
          {luring && (
            <p role="status" className="flex items-center gap-2 text-sm" data-testid="banding-luring">
              <WifiSlashIcon size={18} aria-hidden /> Kamu sedang luring. Tandamu dikirim otomatis saat sinyal kembali.
            </p>
          )}
          {h && "galat" in h && <p role="alert" className="text-sm text-cap" data-testid="galat-banding">{h.galat}</p>}
          <div className="flex flex-wrap gap-2">
            <Tombol type="submit" ragam="kedua" disabled={sibuk}>{sibuk ? "Mengirim..." : "Kirim ke pemilik"}</Tombol>
            <Tombol ragam="teks" onClick={() => setBuka(false)}>Batal</Tombol>
          </div>
        </form>
      )}
    </section>
  );
}
