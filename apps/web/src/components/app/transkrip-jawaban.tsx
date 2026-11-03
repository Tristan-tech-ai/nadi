"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { isiTeks } from "@/lib/i18n/isi-teks";
import type { Kamus } from "@/lib/i18n/kamus";
import { simpanTranskrip } from "@/app/app/wawancara/actions";
import { transkripsi, type ModelTranskrip } from "@/lib/wawancara/transkrip";

type Keadaan = { jenis: "diam" } | { jenis: "unduh"; persen: number } | { jenis: "dengar" } | { jenis: "galat"; pesan: string };

/** Tombol transkrip untuk satu klip. Model ucapan berjalan di perangkat ini; hasilnya disimpan lewat server action. */
export function TranskripJawaban({ jawabanId, urutan, url, model, ada, teks: t }: { jawabanId: string; urutan: number; url: string; model: ModelTranskrip | null; ada: boolean; teks: Kamus["wawancara"] }) {
  const router = useRouter();
  const [k, setK] = useState<Keadaan>({ jenis: "diam" });
  if (!model) return <p className="text-sm text-tinta-2">{t.tanpaModel}</p>;

  async function mulai() {
    setK({ jenis: "dengar" });
    try {
      const teks = await transkripsi(url, model!, (persen) => setK({ jenis: "unduh", persen }));
      setK({ jenis: "dengar" });
      const h = await simpanTranskrip(jawabanId, teks);
      if ("galat" in h) return setK({ jenis: "galat", pesan: h.galat });
      setK({ jenis: "diam" });
      router.refresh();
    } catch {
      setK({ jenis: "galat", pesan: t.transkripGagal });
    }
  }

  const sibuk = k.jenis === "unduh" || k.jenis === "dengar";
  return (
    <div className="flex flex-col gap-2">
      <Tombol ragam="kedua" onClick={mulai} disabled={sibuk} data-testid={`transkrip-${urutan}`} className="self-start">
        {sibuk ? t.mentranskrip : ada ? t.transkripUlang : t.buatTranskrip}
      </Tombol>
      <p className="text-sm text-tinta-2" aria-live="polite">
        {k.jenis === "unduh"
          ? isiTeks(t.mengunduh, { n: Math.round(k.persen) })
          : k.jenis === "dengar"
            ? t.mendengar
            : k.jenis === "galat"
              ? <span role="alert" className="text-cap">{k.pesan}</span>
              : null}
      </p>
    </div>
  );
}
