import type { Metadata } from "next";
import { Suspense } from "react";
import { FormAlur, FormFormulir, FormIsi, TombolAktif } from "@/components/app/alur";
import type { Bidang } from "@/lib/alur/isian";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Alur" };

type Formulir = { id: string; nama: string; bidang: Bidang[] };
type Alur = { id: string; nama: string; aktif: boolean; pemicu: string; form_id: string | null; syarat: { bidang: string; op: string; nilai: string }[];
  aksi: { jenis: "kartu" | "kerja" | "webhook"; judul?: string; url?: string }[]; batas_jam: number };
type Jalan = { id: string; status: "jalan" | "dibatasi" | "gagal"; catatan: string | null; at: string; webhook: { url: string; kode: number | null; galat: string | null }[] | null };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).otomasi;
  const supabase = await createClient();
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const [fm, al] = await Promise.all([
    supabase.from("custom_form").select("id, nama, bidang").eq("aktif", true).order("dibuat_at", { ascending: false }).limit(50),
    pengelola ? supabase.from("flow").select("id, nama, aktif, pemicu, form_id, syarat, aksi, batas_jam").order("dibuat_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
  ]);
  const formulir = (fm.data ?? []) as Formulir[];
  const alur = (al.data ?? []) as Alur[];
  const jalan = new Map<string, Jalan[]>(await Promise.all(alur.slice(0, 20).map(async (a) => [a.id, ((await supabase.rpc("flow_runs", { p_flow: a.id })).data ?? []) as Jalan[]] as const)));
  const namaForm = new Map(formulir.map((f) => [f.id, f.nama]));
  const jam = new Intl.DateTimeFormat(bahasa === "en" ? "en-GB" : "id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: await zonaUsahaIni(sesi.perusahaanId) });

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/alur" judul={t.judul} ket={pengelola ? t.ket : t.ketStaf} />

      <section className="mt-8" aria-labelledby="al-isi"><h2 id="al-isi" className="text-lg font-semibold">{t.isiJudul}</h2>
        {formulir.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.formulirKosong}</p> : (
          <div className="grid gap-3">{formulir.map((f) => <FormIsi key={f.id} formulir={f} teks={t} />)}</div>
        )}
      </section>

      {pengelola && (<>
        <section className="mt-10" aria-labelledby="al-daftar"><h2 id="al-daftar" className="text-lg font-semibold">{t.daftarJudul}</h2>
          {alur.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.alurKosong}</p> : (
            <ul className="mt-3 grid gap-3">{alur.map((a) => {
              const j = jalan.get(a.id) ?? [];
              const n = { jalan: j.filter((x) => x.status === "jalan").length, dibatasi: j.filter((x) => x.status === "dibatasi").length, gagal: j.filter((x) => x.status === "gagal").length };
              const pemicu = a.form_id ? isiTeks(t.pemicuFormulir, { nama: namaForm.get(a.form_id) ?? "" }) : t.pemicuNama[a.pemicu as keyof typeof t.pemicuNama] ?? a.pemicu;
              return (
                <li key={a.id} className="rounded-[var(--radius-kartu)] border border-garis p-4 text-sm" data-testid="alur" data-aktif={a.aktif}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold"><span data-pengguna>{a.nama}</span> <span className="font-normal text-tinta-2">{a.aktif ? t.aktif : t.mati}</span></p>
                    <TombolAktif alur={a.id} aktif={a.aktif} nama={a.nama} teks={t} />
                  </div>
                  <p className="mt-1"><span className="text-tinta-2">{t.ketika}</span> {pemicu}
                    {a.syarat.length > 0 && <> <span className="text-tinta-2">{t.jika}</span> <span data-pengguna>{a.syarat.map((s) => `${s.bidang} ${t.opNama[s.op as keyof typeof t.opNama] ?? s.op} ${s.nilai}`).join(", ")}</span></>}</p>
                  <ul className="mt-1 grid gap-0.5">{a.aksi.map((x, i) => (
                    <li key={i}><span className="text-tinta-2">{t.aksiNama[x.jenis]}:</span> <span data-pengguna className="break-all">{x.judul ?? x.url}</span></li>))}</ul>
                  <p className="mt-2 text-xs text-tinta-2" data-testid="alur-jalan">{isiTeks(t.ringkasJalan, { jalan: n.jalan, dibatasi: n.dibatasi, gagal: n.gagal, batas: a.batas_jam })}</p>
                  {j.length > 0 && (
                    <details className="mt-1 text-xs"><summary className="cursor-pointer text-tinta-2">{t.riwayat}</summary>
                      <ul className="mt-1 grid gap-0.5">{j.slice(0, 10).map((x) => (
                        <li key={x.id}>{jam.format(new Date(x.at)).replace(/(\d{2}):(\d{2})/, "$1.$2")}: {t.statusNama[x.status]}{x.catatan ? ` (${x.catatan})` : ""}
                          {x.webhook?.map((w, i) => <span key={i} className="text-tinta-2">{`. ${isiTeks(t.webhookStatus, { kode: w.kode ?? t.belumDijawab })}`}</span>)}</li>))}</ul>
                    </details>
                  )}
                </li>
              );
            })}</ul>
          )}
        </section>

        <section className="mt-10" aria-labelledby="al-baru"><h2 id="al-baru" className="text-lg font-semibold">{t.alurBaru}</h2>
          <FormAlur formulir={formulir} teks={t} />
        </section>

        <section className="mt-10" aria-labelledby="al-form"><h2 id="al-form" className="text-lg font-semibold">{t.formulirBaru}</h2>
          <FormFormulir teks={t} />
        </section>
      </>)}
    </div>
  );
}

export default function HalamanAlur() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
