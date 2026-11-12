import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Invoice maker | Nadi", alternates: { canonical: "/en/alat/invoice", languages: { id: "/alat/invoice", en: "/en/alat/invoice" } } };

export default function Halaman() {
  return <HalamanAlat slug="invoice" bahasa="en" />;
}
