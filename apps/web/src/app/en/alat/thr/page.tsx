import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "THR calculator | Nadi", alternates: { canonical: "/en/alat/thr", languages: { id: "/alat/thr", en: "/en/alat/thr" } } };

export default function Halaman() {
  return <HalamanAlat slug="thr" bahasa="en" />;
}
