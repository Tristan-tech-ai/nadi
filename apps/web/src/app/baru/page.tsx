import type { Metadata } from "next";
import Link from "next/link";
import { HalamanInfo } from "@/components/landing/halaman-info";
import { formatTanggalKalender } from "@/lib/format";
import { RILIS } from "@/lib/rilis";

export const metadata: Metadata = {
  title: "Yang baru di Nadi",
  description: "Catatan rilis Nadi: fitur yang sudah bisa dipakai, terbaru di atas.",
  alternates: { canonical: "/baru" },
};

// L-12 catatan rilis: hanya yang sudah berjalan di produksi, dikelompokkan per tanggal.
export default function Baru() {
  const tanggal = [...new Set(RILIS.map((x) => x.tanggal))].sort().reverse();
  return (
    <HalamanInfo judul="Yang baru" pengantar="Fitur yang sudah bisa dipakai di Nadi, terbaru di atas." warna="tulang">
      {tanggal.map((t) => (
        <section key={t} aria-labelledby={`rilis-${t}`} className="mb-10">
          <h2 id={`rilis-${t}`} className="papan papan-sedang">{formatTanggalKalender(t)}</h2>
          <ul className="mt-4 grid gap-4">
            {RILIS.filter((x) => x.tanggal === t).map((x) => (
              <li key={x.judul} className="rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="butir-rilis">
                <h3 className="font-semibold">{x.judul}</h3>
                <p className="mt-1">{x.isi}</p>
                <Link href={x.tautan.href} className="mt-2 inline-block font-semibold underline underline-offset-4">{x.tautan.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </HalamanInfo>
  );
}
