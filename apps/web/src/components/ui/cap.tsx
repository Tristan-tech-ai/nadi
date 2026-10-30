import { CheckIcon, ClockIcon, ProhibitIcon, SealCheckIcon } from "@phosphor-icons/react/dist/ssr";

export type JenisCap = "diterima" | "lunas" | "ditolak" | "menunggu" | "ditahan";

const GAYA: Record<JenisCap, { warna: string; Ikon: typeof CheckIcon; label: string }> = {
  diterima: { warna: "text-daun border-daun", Ikon: CheckIcon, label: "Diterima" },
  lunas: { warna: "text-daun border-daun", Ikon: SealCheckIcon, label: "Lunas" },
  ditolak: { warna: "text-cap border-cap", Ikon: ProhibitIcon, label: "Ditolak" },
  ditahan: { warna: "text-cap border-cap", Ikon: ProhibitIcon, label: "Ditahan" },
  menunggu: { warna: "text-tinta-2 border-garis-kuat", Ikon: ClockIcon, label: "Menunggu" },
};

/** Tanda status berbentuk cap stempel: selalu ikon + teks, tidak pernah warna saja (ANTI-SLOP S06). */
export function Cap({ jenis, label }: { jenis: JenisCap; label?: string }) {
  const g = GAYA[jenis];
  return (
    <span className={`inline-flex items-center gap-1 rounded-[3px] border-[1.5px] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${g.warna}`}>
      <g.Ikon size={12} weight="bold" aria-hidden />
      {label ?? g.label}
    </span>
  );
}
