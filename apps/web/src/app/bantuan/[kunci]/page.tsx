import type { Metadata } from "next";
import { Suspense } from "react";
import { ObrolanWeb } from "@/components/bantuan/obrolan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-16: halaman obrolan publik untuk pelanggan sebuah usaha. Kunci acak (bukan kode usaha) dari pengaturan layanan.
export const metadata: Metadata = { title: "Tanya kami", robots: { index: false, follow: false } };

export default function Bantuan(props: PageProps<"/bantuan/[kunci]">) {
  return (
    <Suspense fallback={<main className="mx-auto min-h-[70svh] w-full max-w-xl px-5 py-10" aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /></main>}>
      <Isi params={props.params} />
    </Suspense>
  );
}

async function Isi({ params }: { params: PageProps<"/bantuan/[kunci]">["params"] }) {
  const { kunci } = await params;
  const bahasa: Bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).bantuanPublik;
  const supabase = await createClient();
  const { data } = /^[0-9a-f]{18}$/.test(kunci) ? await supabase.rpc("web_chat_info", { p_kunci: kunci }) : { data: null };
  const info = data as { usaha: string; sambutan: string; buka: boolean } | null;
  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-xl px-5 py-10" lang={bahasa}>
      {!info ? <p className="text-tinta-2">{t.tidakAktif}</p> : (
        <>
          <h1 className="font-judul text-3xl font-extrabold tracking-tight">{isiTeks(t.judul, { usaha: info.usaha })}</h1>
          <p className="mt-2 text-tinta-2">{info.sambutan}</p>
          {!info.buka && <p className="mt-2 text-sm text-tinta-2">{t.tutupJam}</p>}
          <ObrolanWeb kunci={kunci} usaha={info.usaha} teks={t} />
          <p className="mt-8 text-xs text-tinta-2">{isiTeks(t.privasi, { usaha: info.usaha })}</p>
        </>
      )}
    </main>
  );
}
