import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Severance calculator | Nadi", alternates: { canonical: "/en/alat/pesangon", languages: { id: "/alat/pesangon", en: "/en/alat/pesangon" } } };

export default function Halaman() {
  return <HalamanAlat slug="pesangon" bahasa="en" />;
}
