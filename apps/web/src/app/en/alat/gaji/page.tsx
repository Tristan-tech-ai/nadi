import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Take-home pay calculator | Nadi", alternates: { canonical: "/en/alat/gaji", languages: { id: "/alat/gaji", en: "/en/alat/gaji" } } };

export default function Halaman() {
  return <HalamanAlat slug="gaji" bahasa="en" />;
}
