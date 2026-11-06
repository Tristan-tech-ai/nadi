import type { Metadata } from "next";
import { HalamanIntegrasi } from "@/components/landing/halaman-untuk";

export const metadata: Metadata = {
  title: "Integrasi Nadi",
  description: "AI milikmu lewat MCP, n8n, Make, Zapier, webhook, QRIS, Coretax, CCTV, dan pindah dari aplikasi lain.",
  alternates: { canonical: "/integrasi", languages: { id: "/integrasi", en: "/en/integrasi" } },
};

export default function Halaman() {
  return <HalamanIntegrasi bahasa="id" />;
}
