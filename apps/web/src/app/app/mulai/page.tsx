import type { Metadata } from "next";
import { FormMulai } from "./form-mulai";

export const metadata: Metadata = { title: "Siapkan usahamu" };

export default function Mulai() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold leading-tight tracking-tight">Usaha apa yang kamu jalankan?</h1>
      <p className="mt-2 text-tinta-2">Dua isian saja. Sisanya bisa Nadi baca dari berkas yang kamu lempar nanti.</p>
      <div className="mt-8">
        <FormMulai />
      </div>
    </main>
  );
}
