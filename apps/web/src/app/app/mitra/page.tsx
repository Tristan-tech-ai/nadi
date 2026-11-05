import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormBatalPermintaan, FormPermintaan } from "@/components/app/mitra";
import { Cap } from "@/components/ui/cap";
import { formatTanggal, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Mitra" };

// F6-04 (docs/research/mitra.md): direktori psikolog, akuntan publik, dan konsultan pajak; permintaan tersimpan, tanpa uang.

type Mitra = { id: string; jenis: "psikolog" | "akuntan_publik" | "konsultan_pajak"; nama: string; kota: string; layanan: string[]; ringkas: string | null; nomor_izin: string | null; terverifikasi: boolean; diverifikasi_at: string | null; contoh: boolean };
type Permintaan = { id: string; layanan: string; pesan: string; status: "terkirim" | "dibatalkan"; dibuat_at: string; mitra: { nama: string } | null };
const URUT = ["psikolog", "akuntan_publik", "konsultan_pajak"] as const;

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const kamus = ambilKamus(bahasa);
  const t = kamus.mitra;
  const f = kamus.mitraForm;
  const isiLang = bahasa === "id" ? undefined : "id";
  const kepala = (
    <>
      <KepalaHalaman jalur="/app/mitra" judul={t.judul} ket={t.ket} />
    </>
  );
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") return <div lang={bahasa}>{kepala}<p className="mt-6 text-tinta-2">{t.hanyaPeran}</p></div>;
  const supabase = await createClient();
  const [m, p, zona] = await Promise.all([
    supabase.from("mitra").select("id, jenis, nama, kota, layanan, ringkas, nomor_izin, terverifikasi, diverifikasi_at, contoh").order("nama"),
    supabase.from("permintaan_mitra").select("id, layanan, pesan, status, dibuat_at, mitra:mitra_id(nama)").order("dibuat_at", { ascending: false }).limit(30),
    zonaUsahaIni(sesi.perusahaanId),
  ]);
  if (m.error || p.error) return <div lang={bahasa}>{kepala}<p role="alert" className="mt-6 text-cap">{t.gagalMuat}</p></div>;
  const mitra = (m.data ?? []) as Mitra[];
  const permintaan = (p.data ?? []) as unknown as Permintaan[];
  const JUDUL = { psikolog: t.jenisPsikolog, akuntan_publik: t.jenisAkuntan, konsultan_pajak: t.jenisPajak };
  const IZIN = { psikolog: t.izinPsikolog, akuntan_publik: t.izinAkuntan, konsultan_pajak: t.izinPajak };
  return (
    <div lang={bahasa}>
      {kepala}
      {mitra.length > 0 && mitra.every((x) => x.contoh) && (
        <p className="mt-3 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="mitra-contoh">{t.contohBanner}</p>
      )}
      {URUT.map((jenis) => {
        const daftar = mitra.filter((x) => x.jenis === jenis);
        return (
          <section key={jenis} className="mt-8" aria-labelledby={`judul-${jenis}`} data-testid={`mitra-${jenis}`}>
            <h2 id={`judul-${jenis}`} className="text-lg font-semibold">{JUDUL[jenis]}</h2>
            <p className="mt-1 text-sm text-tinta-2">{IZIN[jenis]}</p>
            {daftar.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.kosongJenis}</p> : (
              <ul className="mt-2 divide-y divide-garis border-y border-garis">
                {daftar.map((x) => (
                  <li key={x.id} className="py-3" data-testid="kartu-mitra" data-nama={x.nama}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold" lang={isiLang} data-pengguna>{x.nama}</p>
                        <p className="text-sm text-tinta-2"><span lang={isiLang} data-pengguna>{x.kota}. {x.layanan.join(", ")}</span></p>
                        {x.ringkas && <p className="text-sm text-tinta-2" lang={isiLang} data-pengguna>{x.ringkas}</p>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {x.contoh && <Cap jenis="menunggu" label={t.contoh} />}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-tinta-2">
                      {x.terverifikasi && x.diverifikasi_at ? isiTeks(t.terverifikasi, { tanggal: formatTanggal(new Date(x.diverifikasi_at), zona, bahasa) }) : t.belumVerifikasi}
                    </p>
                    <FormPermintaan mitra={x.id} nama={x.nama} layanan={x.layanan} kunci={randomUUID()} teks={f} isiLang={isiLang} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <section className="mt-10" aria-labelledby="judul-permintaan" data-testid="permintaan-saya">
        <h2 id="judul-permintaan" className="text-lg font-semibold">{t.permintaanJudul}</h2>
        {permintaan.length === 0 ? <p data-langkah='#judul-psikolog' className="mt-1 text-sm text-tinta-2">{t.permintaanKosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis">
            {permintaan.map((x) => (
              <li key={x.id} className="grid gap-1 py-3 text-sm" data-testid="baris-permintaan">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold"><span lang={isiLang} data-pengguna>{x.mitra?.nama}</span> <span className="font-normal text-tinta-2" lang={isiLang} data-pengguna>{x.layanan}</span></p>
                  {x.status === "dibatalkan" ? <Cap jenis="ditolak" label={t.statusBatal} /> : <Cap jenis="diterima" label={t.statusTerkirim} />}
                </div>
                <p className="whitespace-pre-line" data-pengguna>{x.pesan}</p>
                <p className="text-xs text-tinta-2">{isiTeks(t.dikirim, { tanggal: formatTanggalKalender(x.dibuat_at.slice(0, 10), bahasa) })}</p>
                {x.status === "terkirim" && <FormBatalPermintaan permintaan={x.id} nama={x.mitra?.nama ?? ""} teks={f} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function HalamanMitra() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
