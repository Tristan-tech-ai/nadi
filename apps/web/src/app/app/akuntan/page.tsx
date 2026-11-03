import type { Metadata } from "next";
import { Suspense } from "react";
import { pindahPerusahaan } from "@/app/app/actions";
import { FormCabutAkuntan, FormIdentitas, FormTambahAkuntan } from "@/components/app/akuntan";
import { Rupiah } from "@/components/ui/rupiah";
import { Tombol } from "@/components/ui/tombol";
import { formatTanggalKalender } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Ruang Akuntan" };

// F4-08 (docs/research/coretax-bpmp.md): semua usaha tempat pengguna menjadi akuntan, pemilik, atau admin, dengan ringkasan
// pekerjaan; untuk usaha yang sedang dibuka: identitas pemotong dan ekspor BPMP siap konverter Coretax.
type Klien = { id: string; nama: string; peran: string; aktif_sekarang: boolean; npwp_ada: boolean; gaji_terakhir: string | null; gaji_draf: number; invoice_terbuka: number; piutang: number };
const namaBulan = (b: string, bahasa: "id" | "en") => formatTanggalKalender(b, bahasa).replace(/^\d+ /, "");

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).akuntan;
  const PERAN: Record<string, string> = { akuntan: t.pAkuntan, pemilik: t.pPemilik, admin: t.pAdmin };
  const supabase = await createClient();
  const kelola = ["pemilik", "admin", "akuntan"].includes(sesi.peran);
  const [klien, bpmp, usaha, akuntan] = await Promise.all([
    supabase.rpc("ruang_akuntan"),
    kelola ? supabase.rpc("data_bpmp", { p_bulan: new Date().toISOString().slice(0, 10) }) : Promise.resolve({ data: null }),
    supabase.from("perusahaan").select("nama, pengaturan").eq("id", sesi.perusahaanId).maybeSingle(),
    sesi.peran === "pemilik" ? supabase.rpc("daftar_akuntan") : Promise.resolve({ data: null }),
  ]);
  const tim = (akuntan.data ?? []) as { user_id: string; email: string; aktif: boolean }[];
  const daftar = (klien.data ?? []) as Klien[];
  const bulan = ((bpmp.data as { bulan_disetujui?: string[] } | null)?.bulan_disetujui ?? []).slice(0, 12);
  const identitas = ((usaha.data?.pengaturan as { identitas_pajak?: { npwp: string; id_tku: string } } | null)?.identitas_pajak) ?? null;

  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      <section className="mt-6" aria-labelledby="judul-klien">
        <h2 id="judul-klien" className="text-lg font-semibold">{t.klien}</h2>
        {daftar.length === 0 ? <p className="mt-1 text-sm text-tinta-2">{t.kosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="daftar-klien">
            {daftar.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3" data-testid="baris-klien" data-nama={k.nama}>
                <div className="text-sm">
                  <p className="text-base font-semibold"><span data-pengguna>{k.nama}</span> <span className="text-sm font-normal text-tinta-2">{PERAN[k.peran] ?? k.peran}</span></p>
                  <p className="text-tinta-2">
                    {isiTeks(t.gajiTerakhir, { bulan: k.gaji_terakhir ? namaBulan(k.gaji_terakhir, bahasa) : t.belumAda })}{k.gaji_draf > 0 ? isiTeks(t.drafMenunggu, { n: k.gaji_draf }) : ""}.
                    {" "}{sisip(t.tagihan, { n: k.invoice_terbuka, rp: <Rupiah nilai={Number(k.piutang)} /> })}{k.npwp_ada ? "" : t.npwpBelum}
                  </p>
                </div>
                {k.aktif_sekarang ? <span className="text-sm font-semibold" data-testid="klien-aktif">{t.sedangDibuka}</span> : (
                  <form action={pindahPerusahaan}>
                    <input type="hidden" name="perusahaan" value={k.id} />
                    <input type="hidden" name="ke" value="/app/akuntan" />
                    <Tombol type="submit" ragam="kedua" aria-label={isiTeks(t.bukaAria, { nama: k.nama })}>{t.buka}</Tombol>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {sesi.peran === "pemilik" && (
        <section className="mt-8" aria-labelledby="judul-tim" data-testid="akuntan-usaha">
          <h2 id="judul-tim" className="text-lg font-semibold">{t.timJudul}</h2>
          <p className="mt-1 text-sm text-tinta-2">{t.timKet}</p>
          {tim.length > 0 && (
            <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm">
              {tim.map((a) => (
                <li key={a.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-mono">{a.email}</span>
                  {a.aktif ? <FormCabutAkuntan user={a.user_id} email={a.email} teks={t} /> : <span className="text-tinta-2">{t.dicabut}</span>}
                </li>
              ))}
            </ul>
          )}
          <FormTambahAkuntan teks={t} />
        </section>
      )}

      {kelola && (
        <section className="mt-8" aria-labelledby="judul-bpmp" data-testid="ekspor-bpmp">
          <h2 id="judul-bpmp" className="text-lg font-semibold">{sisip(t.bpmpJudul, { nama: <span data-pengguna>{usaha.data?.nama}</span> })}</h2>
          {bahasa !== "id" && <p className="mt-1 text-sm font-semibold" data-testid="khusus-indonesia">{t.khususId}</p>}
          <p className="mt-1 text-sm text-tinta-2">{t.bpmpKet}</p>
          {(sesi.peran === "pemilik" || sesi.peran === "akuntan") && <FormIdentitas awal={identitas} teks={t} />}
          {!identitas ? <p className="mt-3 text-sm" data-testid="bpmp-butuh-npwp">{t.butuhNpwp}</p>
            : bulan.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.belumGaji}</p> : (
              <ul className="mt-3 flex flex-wrap gap-2 text-sm" data-testid="unduh-bpmp">
                {bulan.map((b) => (
                  <li key={b}><a href={`/app/akuntan/bpmp?bulan=${b.slice(0, 7)}`} download className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-3 font-semibold hover:bg-kertas-2">
                    {isiTeks(t.unduh, { bulan: namaBulan(b, bahasa) })}</a></li>
                ))}
              </ul>
            )}
        </section>
      )}
    </div>
  );
}

export default function RuangAkuntan() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
