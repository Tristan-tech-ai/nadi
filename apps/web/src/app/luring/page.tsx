import type { Metadata } from "next";
import { TandaNadi } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Sedang luring", robots: { index: false } };

export default function Luring() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <TandaNadi ukuran={40} />
      {/* Disimpan service worker sebagai halaman statis tanpa cookie, jadi dua bahasa sekaligus (I-03). */}
      <h1 className="mt-6 font-judul text-3xl font-extrabold tracking-tight">Sinyal sedang hilang</h1>
      <p className="mt-2 text-tinta-2">Nadi akan memuat ulang begitu internet kembali. Yang sudah kamu isi sebelumnya tidak hilang.</p>
      <div lang="en" className="mt-6 border-t border-garis pt-4">
        <h2 className="text-lg font-semibold">The connection is gone</h2>
        <p className="mt-1 text-tinta-2">Nadi reloads as soon as the internet is back. What you already entered is kept.</p>
      </div>
    </main>
  );
}
