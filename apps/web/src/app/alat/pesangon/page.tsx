import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Kalkulator pesangon | Nadi", alternates: { canonical: "/alat/pesangon" } };

export default function Halaman() {
  return <HalamanAlat slug="pesangon" />;
}
