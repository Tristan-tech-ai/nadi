import type { Metadata } from "next";
import { IndeksAlat } from "@/components/alat/halaman-alat";

// L-08: alat gratis dalam bahasa Inggris, rumus dan aturan sama dengan /alat.
export const metadata: Metadata = {
  title: "Free tools: take-home pay, THR, severance | Nadi",
  description: "Take-home pay (income tax and BPJS), THR, and severance calculators for Indonesia, plus payslip, invoice, and document makers, without an account.",
  alternates: { canonical: "/en/alat", languages: { id: "/alat", en: "/en/alat" } },
};

export default function Alat() {
  return <IndeksAlat bahasa="en" />;
}
