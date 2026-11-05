import type { Metadata } from "next";
import { Suspense } from "react";
import { PesanJanji } from "@/components/janji/pesan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

// M-16B: halaman pemesanan jadwal publik. Kunci acak dari pengaturan janji temu.
export const metadata: Metadata = { title: "Pesan jadwal", robots: { index: false, follow: false } };

export default function Janji(props: PageProps<"/janji/[kunci]">) {
  return (
    <Suspense fallback={<main className="mx-auto min-h-[70svh] w-full max-w-xl px-5 py-10" aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /></main>}>
      <Isi params={props.params} />
    </Suspense>
  );
}

async function Isi({ params }: { params: PageProps<"/janji/[kunci]">["params"] }) {
  const { kunci } = await params;
  const bahasa: Bahasa = await bahasaAplikasi();
  const t = ambilKamus(bahasa).janjiPublik;
  const supabase = await createClient();
  const { data } = /^[0-9a-f]{18}$/.test(kunci) ? await supabase.rpc("booking_info", { p_kunci: kunci }) : { data: null };
  const info = data as { usaha: string; hari_ini: string; layanan: { id: string; nama: string; durasi: number; harga: number }[] } | null;
  return (
    <main className="mx-auto min-h-[70svh] w-full max-w-xl px-5 py-10" lang={bahasa}>
      {!info || info.layanan.length === 0 ? <p className="text-tinta-2">{t.tidakAktif}</p> : (
        <>
          <h1 className="font-judul text-3xl font-extrabold tracking-tight">{isiTeks(t.judul, { usaha: info.usaha })}</h1>
          <PesanJanji kunci={kunci} layanan={info.layanan} hariIni={info.hari_ini} bahasa={bahasa} teks={t} />
        </>
      )}
    </main>
  );
}
