import type { Metadata } from "next";
import { HalamanUntukDaftar } from "@/components/landing/halaman-untuk";

export const metadata: Metadata = {
  title: "Nadi for your business",
  description: "One working day at a shop, cafe, workshop, salon, laundry, guesthouse, tutoring centre, or contractor with Nadi.",
  alternates: { canonical: "/en/untuk", languages: { id: "/untuk", en: "/en/untuk" } },
};

export default function Halaman() {
  return <HalamanUntukDaftar bahasa="en" />;
}
