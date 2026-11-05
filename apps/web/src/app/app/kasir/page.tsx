import type { Metadata } from "next";
import QRCode from "qrcode";
import { Suspense } from "react";
import { KasirApp } from "@/components/kasir/kasir";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kasir" };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).kasir;
  const { data } = await (await createClient()).rpc("pos_payment_qr");
  const q = data as { qris: string; nama: string | null } | null;
  const qris = q?.qris ? { svg: await QRCode.toString(q.qris, { type: "svg", margin: 1, errorCorrectionLevel: "M" }), nama: q.nama ?? "" } : null;
  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      <KasirApp pid={sesi.perusahaanId} bahasa={bahasa} teks={t} qris={qris} />
    </div>
  );
}

export default function HalamanKasir() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
