import type { Metadata } from "next";
import { KiosTablet } from "@/components/absen/kios-tablet";
import { LogoNadi } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Layar absen", robots: { index: false } };

// Tablet kios tanpa akun pemilik: dipasang lewat tautan tablet (token di fragmen URL). Hanya menampilkan QR absen.
export default function KiosTabletHalaman() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col items-center px-5 py-8">
      <LogoNadi />
      <h1 className="mt-6 text-center font-judul text-3xl font-extrabold tracking-tight">Pindai untuk absen</h1>
      <p className="mt-2 mb-8 text-center text-tinta-2">Buka kamera HP, arahkan ke kode ini, lalu ikuti langkah di layar HP-mu.</p>
      <KiosTablet />
    </main>
  );
}
