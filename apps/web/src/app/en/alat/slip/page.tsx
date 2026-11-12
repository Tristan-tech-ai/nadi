import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Online payslip | Nadi", alternates: { canonical: "/en/alat/slip", languages: { id: "/alat/slip", en: "/en/alat/slip" } } };

export default function Halaman() {
  return <HalamanAlat slug="slip" bahasa="en" />;
}
