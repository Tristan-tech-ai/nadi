import type { Metadata } from "next";
import { TandaNadi } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Sedang luring", robots: { index: false } };

export default function Luring() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <TandaNadi ukuran={40} />
      <h1 className="mt-6 font-judul text-3xl font-extrabold tracking-tight">Sinyal sedang hilang</h1>
      <p className="mt-2 text-tinta-2">Nadi akan memuat ulang begitu internet kembali. Yang sudah kamu isi sebelumnya tidak hilang.</p>
    </main>
  );
}
