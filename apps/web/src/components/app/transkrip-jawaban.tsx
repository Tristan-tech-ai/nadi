"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tombol } from "@/components/ui/tombol";
import { simpanTranskrip } from "@/app/app/wawancara/actions";
import { transkripsi, type ModelTranskrip } from "@/lib/wawancara/transkrip";

type Keadaan = { jenis: "diam" } | { jenis: "unduh"; persen: number } | { jenis: "dengar" } | { jenis: "galat"; pesan: string };

/** Tombol transkrip untuk satu klip. Model ucapan berjalan di perangkat ini; hasilnya disimpan lewat server action. */
export function TranskripJawaban({ jawabanId, urutan, url, model, ada }: { jawabanId: string; urutan: number; url: string; model: ModelTranskrip | null; ada: boolean }) {
  const router = useRouter();
  const [k, setK] = useState<Keadaan>({ jenis: "diam" });
  if (!model) return <p className="text-sm text-tinta-2">Transkrip belum tersedia di usaha ini. Dengarkan klipnya langsung.</p>;

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
      setK({ jenis: "galat", pesan: "Transkrip gagal dibuat di perangkat ini. Dengarkan klipnya langsung, atau coba lagi dari laptop." });
    }
  }

  const sibuk = k.jenis === "unduh" || k.jenis === "dengar";
  return (
    <div className="flex flex-col gap-2">
      <Tombol ragam="kedua" onClick={mulai} disabled={sibuk} data-testid={`transkrip-${urutan}`} className="self-start">
        {sibuk ? "Sedang mentranskrip..." : ada ? "Transkrip ulang" : "Buat transkrip"}
      </Tombol>
      <p className="text-sm text-tinta-2" aria-live="polite">
        {k.jenis === "unduh"
          ? `Mengunduh model suara sekali untuk perangkat ini: ${Math.round(k.persen)}%`
          : k.jenis === "dengar"
            ? "Nadi sedang mendengarkan klip ini di perangkatmu. Suara tidak dikirim ke mana pun."
            : k.jenis === "galat"
              ? <span role="alert" className="text-cap">{k.pesan}</span>
              : null}
      </p>
    </div>
  );
}
