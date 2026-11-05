import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { FormLembur } from "@/components/app/waktu";
import { hariIni } from "@/lib/izin";
import { Suspense } from "react";
import { IlustrasiKalender } from "@/components/ilustrasi";
import { FormIzin } from "@/components/app/form-izin";
import { Cap } from "@/components/ui/cap";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
import { capStatus, rentangTanggal } from "@/lib/izin";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { LangkahPertama } from "@/components/app/langkah-pertama";

export const metadata: Metadata = { title: "Izin dan cuti" };

type Ringkas = { punya_orang: boolean; tahun: number; cuti: { jatah: number | null; terpakai: number; sisa: number | null } };
type Pengajuan = {
  id: string;
  jenis: string;
  mulai: string;
  selesai: string;
  hari: number;
  status: string;
  oleh_otopilot: boolean;
  alasan_putusan: string;
  orang: { nama: string } | null;
};

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).izin;
  const isiLang = bahasa === "id" ? undefined : "id";
  const lamaHari = (n: number) => isiTeks(n === 1 ? t.hariSatu : t.hariBanyak, { n });
  const supabase = await createClient();
  const [{ data: r }, { data: daftar }, zona] = await Promise.all([
    supabase.rpc("izin_ringkas"),
    supabase
      .from("pengajuan_izin")
      .select("id, jenis, mulai, selesai, hari, status, oleh_otopilot, alasan_putusan, orang:orang_id(nama)")
      .order("dibuat_at", { ascending: false })
      .limit(30),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  const ringkas = r as Ringkas | null;
  const baris = (daftar ?? []) as unknown as Pengajuan[];
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const tw = ambilKamus(bahasa).waktu;
  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/izin" judul={t.judul} ket={t.ket} />
      {ringkas?.punya_orang ? (
        <>
          {ringkas.cuti.jatah !== null && (
            <p className="mt-4 rounded-[var(--radius-kartu)] bg-kertas-2 px-4 py-3" data-testid="saldo-cuti">
              {sisip(t.sisaCuti, { tahun: ringkas.tahun, sisa: <span className="angka font-semibold">{ringkas.cuti.sisa}</span>, jatah: ringkas.cuti.jatah })}
            </p>
          )}
          <FormIzin zona={zona} teks={t} bahasa={bahasa} />
          <section className="mt-8" aria-labelledby="judul-lembur">
            <h2 id="judul-lembur" className="text-lg font-semibold">{tw.lemburJudul}</h2>
            <p className="mt-1 text-sm text-tinta-2">{tw.lemburKet}</p>
            <FormLembur hari={hariIni(new Date(), zona)} kunci={randomUUID()} teks={tw} />
          </section>
        </>
      ) : (
        <p className="mt-6 text-tinta-2" data-testid="izin-tanpa-orang">
          {t.tanpaOrang} {pengelola ? t.tanpaOrangPengelola : t.tanpaOrangStaf}
        </p>
      )}
      <section className="mt-10" aria-labelledby="judul-daftar-izin">
        <h2 id="judul-daftar-izin" className="text-lg font-semibold">{pengelola ? t.pengajuanTim : t.pengajuanmu}</h2>
        {baris.length === 0 ? (
          <div className="mt-2 flex items-center gap-3"><IlustrasiKalender className="w-20" /><p className="text-sm text-tinta-2" data-testid="izin-kosong">{t.kosong}{pengelola && <> <LangkahPertama href="/app/perusahaan#judul-kebijakan-izin">{t.langkahKosong}</LangkahPertama></>}</p></div>
        ) : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis" data-testid="daftar-izin">
            {baris.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {pengelola && p.orang ? <><span data-pengguna>{p.orang.nama}</span>: </> : ""}
                    {t.jenis[p.jenis as keyof typeof t.jenis] ?? p.jenis} {lamaHari(p.hari)}
                  </p>
                  <Cap {...capStatus(p.status, t.status)} />
                </div>
                <p className="text-sm text-tinta-2">{rentangTanggal(p.mulai, p.selesai, bahasa)}</p>
                <p className="mt-1 text-sm" lang={isiLang}>{p.alasan_putusan}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Izin() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <Suspense
        fallback={
          <div aria-hidden>
            <div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" />
            <div className="mt-6 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />
          </div>
        }
      >
        <Isi />
      </Suspense>
    </main>
  );
}
