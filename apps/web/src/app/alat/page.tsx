import type { Metadata } from "next";
import { IndeksAlat } from "@/components/alat/halaman-alat";

export const metadata: Metadata = { title: "Alat gratis: gaji, THR, pesangon | Nadi", description: "Kalkulator gaji bersih (PPh 21 dan BPJS), THR, dan pesangon tanpa akun.", alternates: { canonical: "/alat" } };

export default function Alat() {
  return <IndeksAlat />;
}
