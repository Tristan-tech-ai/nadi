import type { Metadata } from "next";
import { SlipPublik } from "@/components/app/slip-publik";
import { LogoNadi } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Slip gaji", robots: { index: false } };

// Slip gaji lewat tautan dari pemilik (tanpa akun). Token ada di fragmen URL.
export default function Slip() {
  return (
    <main className="mx-auto w-full max-w-lg px-5 py-8">
      <div className="print:hidden"><LogoNadi /></div>
      <SlipPublik />
    </main>
  );
}
