"use client";

import Link from "next/link";
import { useActionState } from "react";
import { tutupKartuInfo, type HasilTutupInfo } from "@/app/app/actions";
import { Tombol } from "@/components/ui/tombol";
import { KartuUsulan, type TeksKartu, type Usulan } from "@/components/ui/kartu-usulan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import type { Kamus } from "@/lib/i18n/kamus";

/** Kartu info di Feed (F3-07B, docs/design/sinyal-beban-layar.md): bukan keputusan, jadi tanpa Setujui/Tolak. Satu tombol utama
 *  "Lihat bebannya" ke tab beban, dan "Sudah ditangani" yang menutup kartu (hanya pemilik, dicatat di database). */
export function KartuInfo({ usulanId, usulan, teks, teksKartu, bahasa = "id", tautan, label }: {
  usulanId: string; usulan: Usulan; teks: Kamus["kartuInfo"]; teksKartu: TeksKartu; bahasa?: Bahasa; tautan: string; label?: string;
}) {
  const [h, aksi, sibuk] = useActionState<HasilTutupInfo, FormData>(tutupKartuInfo, {});
  const isiLang = bahasa === "id" ? undefined : "id";
  return (
    <div data-testid="kartu-info">
      <KartuUsulan
        usulan={usulan}
        teks={teksKartu}
        bahasa={bahasa}
        isiLang={isiLang}
        aksi={h.ok ? (
          <p role="status" className="text-sm text-daun" data-testid="info-ditangani">{teks.ditangani}</p>
        ) : (
          <form action={aksi} className="flex w-full flex-col gap-2">
            <input type="hidden" name="usulan" value={usulanId} />
            <div className="flex flex-wrap items-center gap-3">
              <Link href={tautan} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-[var(--radius-isian)] bg-tinta px-4 font-semibold text-kertas">
                {label ?? teks.lihatBeban}
              </Link>
              <Tombol type="submit" ragam="teks" disabled={sibuk}>{sibuk ? teks.menyimpan : teks.sudahDitangani}</Tombol>
            </div>
            {h.galat ? <p role="alert" className="text-sm text-cap">{h.galat}</p> : null}
          </form>
        )}
      />
    </div>
  );
}
