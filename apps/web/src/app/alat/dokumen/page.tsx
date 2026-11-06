import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Templat dokumen kerja | Nadi", alternates: { canonical: "/alat/dokumen" } };

export default function Halaman() {
  return <HalamanAlat slug="dokumen" />;
}
