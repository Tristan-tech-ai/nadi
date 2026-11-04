import type { Metadata } from "next";
import { Suspense } from "react";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { FormMulai } from "./form-mulai";

export const metadata: Metadata = { title: "Siapkan usahamu" };

// Bahasa dibaca dari akun/cookie, jadi isi di balik Suspense (Cache Components).
async function Isi() {
  const bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).mulai;
  const supabase = await createClient();
  const { data } = await supabase.from("negara").select("kode, nama_id, nama_en").order("urut");
  const negara = ((data ?? []) as { kode: string; nama_id: string; nama_en: string }[]).map((n) => ({ kode: n.kode, nama: bahasa === "en" ? n.nama_en : n.nama_id }));
  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold leading-tight tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      <div className="mt-8">
        <FormMulai teks={t} negara={negara.length ? negara : [{ kode: "ID", nama: "Indonesia" }]} />
      </div>
    </div>
  );
}

export default function Mulai() {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
