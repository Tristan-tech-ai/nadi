import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { TinjauDraf } from "@/components/app/tinjau-draf";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { bahasaAplikasi } from "@/lib/i18n/server";
import type { BarisDraf } from "@/lib/onboarding/draf";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tinjau draf AI" };

// U-04: layar tinjau draf AI. Draf dibaca lewat RLS (hanya pemilik/admin usaha ini); perubahan dari AI lewat MCP tampil saat dimuat ulang.
async function Isi({ params }: { params: PageProps<"/app/siapkan/draf/[id]">["params"] }) {
  const sesi = await wajibPerusahaan();
  const b: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const en = b === "en";
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("ai_draft").select("id, status, baris, sumber, batal_sampai, dibuat_at").eq("id", id).maybeSingle();
  const d = data as { id: string; status: string; baris: BarisDraf[]; sumber: string; batal_sampai: string | null } | null;
  return (
    <div lang={b}>
      <KepalaHalaman jalur="/app/siapkan" judul={en ? "Check your AI draft" : <>Periksa draf dari <span className="whitespace-nowrap">AI-mu</span></>}
        ket={en ? "Change any cell, delete what is wrong, then apply once. Nothing is saved before you apply, and you can undo for 10 minutes."
          : "Ubah sel yang keliru, hapus yang salah, lalu terapkan sekali. Belum ada yang tersimpan sebelum kamu menerapkan, dan bisa dibatalkan 10 menit."} />
      {!d ? (
        <p className="mt-6 text-sm text-tinta-2">{en ? "This draft is not available. Only the owner or admin of this business can open it." : "Draf ini tidak tersedia. Hanya pemilik atau admin usaha ini yang bisa membukanya."}{" "}
          <Link href="/app/siapkan" className="font-semibold text-tinta underline underline-offset-4">{en ? "Make a new draft" : "Buat draf baru"}</Link></p>
      ) : d.status === "ditutup" ? (
        <p className="mt-6 text-sm text-tinta-2">{en ? "A newer draft replaced this one." : "Draf ini sudah diganti draf yang lebih baru."}{" "}
          <Link href="/app/siapkan" className="font-semibold text-tinta underline underline-offset-4">{en ? "Back" : "Kembali"}</Link></p>
      ) : (
        <div className="mt-6"><TinjauDraf draf={d.id} awal={d.baris} status={d.status} batalSampai={d.batal_sampai} bahasa={b} /></div>
      )}
    </div>
  );
}

export default function HalamanDraf({ params }: PageProps<"/app/siapkan/draf/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi params={params} />
      </Suspense>
    </main>
  );
}
