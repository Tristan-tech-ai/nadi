import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { TempelHasil, TombolSalinTeks } from "@/components/app/siapkan";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { resourceMcp } from "@/lib/mcp/http";
import { CONTOH_TEKS_NADI, PROMPT_ONBOARDING } from "@/lib/onboarding/prompt";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Siapkan usaha dengan AI" };

// W-04: tiga jalan pilihan di samping formulir biasa (yang tetap jalan utama). Petunjuk paket tiap aplikasi dari sumber resmi
// yang dibaca 4 Nov 2026 (loop/LEARN.md); yang tidak bisa dibaca dari sumber resmi ditulis apa adanya.
async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).siapkan;
  if (!["pemilik", "admin"].includes(sesi.peran)) {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/siapkan" judul={t.judul} ket={t.hanya} /></div>;
  }
  const [h, zona] = [await headers(), await zonaUsahaIni(sesi.perusahaanId)];
  const alamat = resourceMcp(h);
  const cursor = `cursor://anysphere.cursor-deeplink/mcp/install?name=nadi&config=${encodeURIComponent(Buffer.from(JSON.stringify({ url: alamat })).toString("base64"))}`;
  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/siapkan" judul={t.judul} ket={<>{t.ket} <a href="/app/perusahaan" className="underline underline-offset-4">{t.formulirBiasa}</a></>} />

      <nav aria-label={t.pilihanAria} className="mt-6 grid gap-2 text-sm sm:grid-cols-3">
        <a href="#prompt" className="rounded-[var(--radius-kartu)] border border-garis p-3 hover:bg-kertas-2"><span className="font-semibold">{t.jalanPrompt}</span><br /><span className="text-tinta-2">{t.jalanPromptKet}</span></a>
        <a href="#sambung" className="rounded-[var(--radius-kartu)] border border-garis p-3 hover:bg-kertas-2"><span className="font-semibold">{t.jalanSambung}</span><br /><span className="text-tinta-2">{t.jalanSambungKet}</span></a>
        <a href="/app/lempar" className="rounded-[var(--radius-kartu)] border border-garis p-3 hover:bg-kertas-2"><span className="font-semibold">{t.jalanLempar}</span><br /><span className="text-tinta-2">{t.jalanLemparKet}</span></a>
      </nav>

      <section id="prompt" className="mt-8 scroll-mt-20" aria-labelledby="judul-prompt">
        <h2 id="judul-prompt" className="text-lg font-semibold">{t.promptJudul}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          <li>{t.langkah1}</li><li>{t.langkah2}</li><li>{t.langkah3}</li>
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-3"><TombolSalinTeks teks={PROMPT_ONBOARDING} label={t.salinPrompt} labelSudah={t.tersalin} />
          {/* U-04: tautan prompt terisi tidak didokumentasikan resmi oleh penyedia (LEARN 6 Nov 2026), jadi hanya membuka halaman utamanya. */}
          <span className="text-sm text-tinta-2">{bahasa === "en" ? "then open" : "lalu buka"}</span>
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">ChatGPT</a>
          <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-4">Gemini</a>
          <span className="text-sm text-tinta-2">{bahasa === "en" ? "or any AI chat" : "atau chat AI lain"}</span></div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">{t.lihatPrompt}</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-[var(--radius-kartu)] bg-kertas-2 p-3 font-mono text-xs" lang="id" tabIndex={0}>{PROMPT_ONBOARDING}</pre>
        </details>
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-tinta-2 underline underline-offset-4">{t.lihatContoh}</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-[var(--radius-kartu)] bg-kertas-2 p-3 font-mono text-xs" lang="id" tabIndex={0} data-testid="contoh-teks-nadi">{CONTOH_TEKS_NADI}</pre>
        </details>
        <TempelHasil hari={hariIni(new Date(), zona)} teks={t} />
      </section>

      <section id="sambung" className="mt-10 scroll-mt-20" aria-labelledby="judul-sambung">
        <h2 id="judul-sambung" className="text-lg font-semibold">{t.sambungJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.sambungKet}</p>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-sm"><span className="break-all font-mono" data-testid="alamat-mcp">{alamat}</span>
          <TombolSalinTeks teks={alamat} label={t.salinAlamat} labelSudah={t.tersalin} /></p>
        <ul className="mt-4 divide-y divide-garis border-y border-garis text-sm">
          <li className="py-3"><p className="font-semibold">{t.app1}</p><p className="text-tinta-2">{t.app1Ket}</p></li>
          <li className="py-3"><p className="font-semibold">Cursor</p><p className="text-tinta-2">{t.app2Ket}</p>
            <a href={cursor} className="mt-1 inline-block underline underline-offset-4">{t.pasangCursor}</a></li>
          <li className="py-3"><p className="font-semibold">VS Code</p><p className="text-tinta-2">{t.app3Ket}</p></li>
          <li className="py-3"><p className="font-semibold">ChatGPT</p><p className="text-tinta-2">{t.app4Ket}</p></li>
        </ul>
        <p className="mt-3 text-sm text-tinta-2">{t.setelahSambung}</p>
      </section>
    </div>
  );
}

export default function Siapkan() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi />
      </Suspense>
    </main>
  );
}
