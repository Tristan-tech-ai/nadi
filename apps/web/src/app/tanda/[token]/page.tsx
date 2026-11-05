import type { Metadata } from "next";
import { Suspense } from "react";
import { HalamanTanda } from "@/components/tanda/halaman";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";

// M-17: halaman tanda tangan publik dengan token sekali pakai. Token tidak pernah dikirim ke server Nadi selain sebagai bagian
// alamat halaman; dokumen dibaca dan ditandatangani langsung dari peramban penanda tangan.
export const metadata: Metadata = { title: "Tanda tangani dokumen", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function Tanda(props: PageProps<"/tanda/[token]">) {
  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi params={props.params} />
      </Suspense>
    </main>
  );
}

async function Isi({ params }: { params: PageProps<"/tanda/[token]">["params"] }) {
  const { token } = await params;
  const bahasa: Bahasa = await bahasaAplikasi();
  const k = ambilKamus(bahasa);
  if (!/^[0-9a-f]{48}$/.test(token)) return <p className="text-tinta-2" lang={bahasa}>{k.tandaPublik.tidakBerlaku}</p>;
  return <div lang={bahasa}><HalamanTanda token={token} bahasa={bahasa} teks={k.tandaPublik} status={k.tanda.statusPenanda} /></div>;
}
