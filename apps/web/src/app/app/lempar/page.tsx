import type { Metadata } from "next";
import { Suspense } from "react";
import { IlustrasiLempar } from "@/components/ilustrasi";
import { Pelempar, type TeksPelempar } from "@/components/app/pelempar";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Lempar Saja" };

// Kiriman dari menu Bagikan (share target) sudah terunggah di server; id berkasnya dibawa lewat ?berkas= agar dibaca di sini.
// Bahasa dibaca dari akun dan cookie, jadi judul ikut di balik Suspense (kerangka meniru isinya).
async function Isi({ searchParams }: { searchParams: PageProps<"/app/lempar">["searchParams"] }) {
  const [sp, bahasa] = await Promise.all([searchParams, bahasaAplikasi()]);
  const k = ambilKamus(bahasa);
  const t = k.lempar;
  const antre = String(sp.berkas ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 10);
  const gagal = Number(sp.gagal ?? 0);
  const teks: TeksPelempar = { ui: t, pesan: k.lemparPesan, kartu: k.kartu, cap: k.cap, sumber: k.feed.sumber.lempar };
  return (
    <div lang={bahasa}>
      <h1 className="mt-4 font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      {gagal > 0 ? (
        <p role="status" className="mt-4 rounded-[var(--radius-isian)] border border-cap px-3 py-2 text-sm text-cap" data-testid="kiriman-gagal">
          {isiTeks(t.kirimanGagal, { n: gagal })}
        </p>
      ) : null}
      <Pelempar antre={antre} teks={teks} bahasa={bahasa} />
    </div>
  );
}

function Kerangka() {
  return (
    <div aria-hidden>
      <div className="mt-4 h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" />
      <div className="mt-3 h-12 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" />
      <div className="mt-6 h-36 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />
    </div>
  );
}

export default function Lempar(props: PageProps<"/app/lempar">) {
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <IlustrasiLempar className="w-28" />
      <Suspense fallback={<Kerangka />}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
