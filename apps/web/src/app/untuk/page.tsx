import type { Metadata } from "next";
import { HalamanUntukDaftar } from "@/components/landing/halaman-untuk";

export const metadata: Metadata = {
  title: "Nadi untuk usahamu",
  description: "Satu hari kerja warung, kafe, bengkel, salon, laundry, kos, kursus, dan kontraktor bersama Nadi.",
  alternates: { canonical: "/untuk", languages: { id: "/untuk", en: "/en/untuk" } },
};

export default function Halaman() {
  return <HalamanUntukDaftar bahasa="id" />;
}
