import type { Metadata } from "next";
import { HalamanIntegrasi } from "@/components/landing/halaman-untuk";

export const metadata: Metadata = {
  title: "Nadi integrations",
  description: "Your own AI through MCP, n8n, Make, Zapier, webhooks, QRIS, Coretax, CCTV, and moving from other apps.",
  alternates: { canonical: "/en/integrasi", languages: { id: "/integrasi", en: "/en/integrasi" } },
};

export default function Halaman() {
  return <HalamanIntegrasi bahasa="en" />;
}
