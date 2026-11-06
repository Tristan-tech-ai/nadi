import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Pembuat invoice | Nadi", alternates: { canonical: "/alat/invoice" } };

export default function Halaman() {
  return <HalamanAlat slug="invoice" />;
}
