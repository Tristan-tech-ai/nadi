import type { Metadata } from "next";
import { Suspense } from "react";
import { FormIzinUsaha } from "@/components/app/kepatuhan";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Kalender kepatuhan" };

type Tenggat = { tanggal: string; jenis: string; judul: string; dasar: string; ref: string };

// M-25: satu daftar tenggat 90 hari ke depan (pajak, BPJS, THR, kontrak, SP, izin usaha). Judul dan dasar ditulis database dalam
// bahasa Indonesia (nama pasal), jadi di bahasa lain ditandai lang="id".
async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).kepatuhan;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran ?? "")) return <p className="mt-6">{t.hanyaPengelola}</p>;
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const sampai = new Date(`${hari}T00:00:00Z`);
  sampai.setUTCDate(sampai.getUTCDate() + 90);
  const supabase = await createClient();
  const [{ data }, { data: iz }] = await Promise.all([
    supabase.rpc("kalender_kepatuhan", { p_dari: hari, p_sampai: sampai.toISOString().slice(0, 10) }),
    supabase.from("izin_usaha").select("id, jenis, nama, nomor, berlaku_sampai").eq("aktif", true).order("berlaku_sampai"),
  ]);
  const daftar = (data ?? []) as Tenggat[];
  const izin = (iz ?? []) as { id: string; jenis: keyof Kamus["kepatuhan"]["jenisNama"]; nama: string; nomor: string | null; berlaku_sampai: string | null }[];
  const isiLang = bahasa === "id" ? undefined : "id";
  const perBulan = new Map<string, Tenggat[]>();
  for (const d of daftar) perBulan.set(d.tanggal.slice(0, 7), [...(perBulan.get(d.tanggal.slice(0, 7)) ?? []), d]);
  return (
    <div lang={bahasa}>
      <h1 className="text-2xl font-semibold">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      {daftar.length === 0 ? <p className="mt-6 text-tinta-2" data-testid="kepatuhan-kosong">{t.kosong}</p> : (
        <div className="mt-6" data-testid="kalender-kepatuhan">
          {[...perBulan.entries()].map(([b, isi]) => (
            <section key={b} className="mt-4" aria-label={b}>
              <h2 className="text-sm font-semibold text-tinta-2">{formatTanggalKalender(`${b}-01`, bahasa).replace(/^\d+\s/, "")}</h2>
              <ul className="mt-1 divide-y divide-garis border-y border-garis text-sm">
                {isi.map((d) => (
                  <li key={d.ref} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2" data-ref={d.ref} data-jenis={d.jenis}>
                    <span className="angka font-semibold">{formatTanggalKalender(d.tanggal, bahasa)}</span>
                    <span><span lang={isiLang} data-pengguna>{d.judul}</span><span className="block text-xs text-tinta-2" lang={isiLang}>{d.dasar}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-tinta-2">{t.catatan}</p>

      <section className="mt-8 border-t border-garis pt-6" aria-labelledby="judul-izin-usaha">
        <h2 id="judul-izin-usaha" className="text-lg font-semibold">{t.izinJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.izinKet}</p>
        {izin.length > 0 && (
          <ul className="mt-3 text-sm" data-testid="daftar-izin-usaha">
            {izin.map((i) => <li key={i.id}><span data-pengguna>{i.nama}</span>{i.nomor ? <span className="font-mono">, {i.nomor}</span> : null}, {i.berlaku_sampai ? formatTanggalKalender(i.berlaku_sampai, bahasa) : t.tanpaMasa}</li>)}
          </ul>
        )}
        {sesi.peran !== "akuntan" && <FormIzinUsaha teks={t} />}
      </section>
    </div>
  );
}

export default function HalamanKepatuhan() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
