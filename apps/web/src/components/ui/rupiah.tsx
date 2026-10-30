import { formatRupiah } from "@/lib/format";

/** Satu-satunya cara menampilkan rupiah (ANTI-SLOP S13, S35): angka tabular, format EYD. */
export function Rupiah({ nilai, ringkas = false, className = "" }: { nilai: number; ringkas?: boolean; className?: string }) {
  return (
    <span className={`angka whitespace-nowrap ${className}`} title={ringkas ? formatRupiah(nilai) : undefined}>
      {formatRupiah(nilai, { ringkas })}
    </span>
  );
}
