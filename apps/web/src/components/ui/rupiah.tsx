import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";

/** Satu-satunya cara menampilkan rupiah (ANTI-SLOP S13, S35): angka tabular, format EYD. */
export function Rupiah({ nilai, ringkas = false, className = "", bahasa = "id" }: { nilai: number; ringkas?: boolean; className?: string; bahasa?: Bahasa }) {
  return (
    <span className={`angka whitespace-nowrap ${className}`} title={ringkas ? formatRupiah(nilai, { bahasa }) : undefined}>
      {formatRupiah(nilai, { ringkas, bahasa })}
    </span>
  );
}
