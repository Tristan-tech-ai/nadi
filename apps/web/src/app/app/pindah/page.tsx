import type { Metadata } from "next";
import { Suspense } from "react";
import { FormPindah } from "@/components/app/pindah";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Pindah ke Nadi" };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).pindah;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/pindah" judul={t.judul} ket={t.hanyaPengelola} /></div>;
  }
  const supabase = await createClient();
  const { data } = await supabase.from("pindah_akun").select("kode_asal, nama_asal, akun_kode, digabung").order("dibuat_at", { ascending: false }).limit(100);
  const peta = (data ?? []) as { kode_asal: string | null; nama_asal: string; akun_kode: string; digabung: boolean }[];
  const sel = "border-b border-garis py-2 pr-3";
  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/pindah" judul={t.judul} ket={t.ket} />

      <section className="mt-8" aria-labelledby="pd-impor"><h2 id="pd-impor" className="text-lg font-semibold">{t.formJudul}</h2>
        <ul className="mt-2 grid max-w-2xl list-disc gap-1 pl-5 text-sm">{t.didukung.map((x) => <li key={x}>{x}</li>)}</ul>
        <FormPindah teks={t} />
      </section>

      {peta.length > 0 && (
        <section className="mt-10" aria-labelledby="pd-peta"><h2 id="pd-peta" className="text-lg font-semibold">{t.petaJudul}</h2>
          <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.petaKet}</p>
          <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label={t.petaJudul}>
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-tinta-2"><tr><th className={sel}>{t.kolAsal}</th><th className={sel}>{t.kolNama}</th><th className={sel}>{t.kolNadi}</th></tr></thead>
              <tbody>{peta.map((p, i) => (
                <tr key={i} data-testid="peta-akun"><td className={`${sel} angka text-tinta-2`}>{p.kode_asal ?? ""}</td><td className={sel} data-pengguna>{p.nama_asal}</td>
                  <td className={`${sel} angka`}>{p.akun_kode}{p.digabung ? ` ${t.digabung}` : ""}</td></tr>))}</tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-10" aria-labelledby="pd-ekspor"><h2 id="pd-ekspor" className="text-lg font-semibold">{t.eksporJudul}</h2>
        <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.eksporKet}</p>
        {sesi.peran === "pemilik" ? (
          <a href="/app/pindah/ekspor" download className="mt-3 inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-4 text-sm font-semibold hover:bg-kertas-2" data-testid="unduh-semua">{t.unduhSemua}</a>
        ) : <p className="mt-2 text-sm text-tinta-2">{t.eksporHanyaPemilik}</p>}
      </section>
    </div>
  );
}

export default function HalamanPindah() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
