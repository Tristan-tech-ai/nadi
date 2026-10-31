import type { Metadata } from "next";
import { LayarKios } from "@/components/absen/layar-kios";
import { LogoNadi } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Layar absen", robots: { index: false } };

// Mode kios: tablet di pintu masuk menampilkan QR absen. Staf memindainya dengan kamera HP.
export default function Kios() {
  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-3xl flex-col items-center px-5 py-8">
      <LogoNadi />
      <h1 className="mt-6 text-center font-judul text-3xl font-extrabold tracking-tight">Pindai untuk absen</h1>
      <p className="mt-2 mb-8 text-center text-tinta-2">Buka kamera HP, arahkan ke kode ini, lalu ikuti langkah di layar HP-mu.</p>
      <LayarKios />
    </main>
  );
}
