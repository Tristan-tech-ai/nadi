import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Kalkulator THR | Nadi", alternates: { canonical: "/alat/thr" } };

export default function Halaman() {
  return <HalamanAlat slug="thr" />;
}
