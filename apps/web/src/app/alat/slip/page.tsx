import type { Metadata } from "next";
import { HalamanAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Slip gaji online | Nadi", alternates: { canonical: "/alat/slip" } };

export default function Halaman() {
  return <HalamanAlat slug="slip" />;
}
