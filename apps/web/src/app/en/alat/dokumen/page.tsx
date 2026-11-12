import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Workplace document templates | Nadi", alternates: { canonical: "/en/alat/dokumen", languages: { id: "/alat/dokumen", en: "/en/alat/dokumen" } } };

export default function Halaman() {
  return <HalamanAlat slug="dokumen" bahasa="en" />;
}
