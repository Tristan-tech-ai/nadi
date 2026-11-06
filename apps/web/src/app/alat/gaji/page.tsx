import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Kalkulator gaji bersih | Nadi", alternates: { canonical: "/alat/gaji" } };

export default function Halaman() {
  return <HalamanAlat slug="gaji" />;
}
