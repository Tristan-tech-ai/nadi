import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormKasbon } from "@/components/app/kasbon";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kasbon" };

type Kasbon = { id: string; jumlah: number; cicilan: number; sisa: number; tanggal: string; alasan: string; orang: { nama: string } | null; kasbon_bayar: { nilai: number }[] };

// M-10B: kasbon (uang muka upah, PP 36/2021 Pasal 63 ayat (1) huruf c) dari kas usaha; cicilan masuk slip, sisa berkurang saat gaji disetujui.
async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).kasbon;
  if (sesi.peran !== "pemilik" && sesi.peran !== "admin") return <p className="mt-6">{t.hanyaPengelola}</p>;
  const supabase = await createClient();
  const [{ data: kb }, { data: org }] = await Promise.all([
    supabase.from("kasbon").select("id, jumlah, cicilan, sisa, tanggal, alasan, orang:orang_id(nama), kasbon_bayar(nilai)").order("tanggal", { ascending: false }),
    supabase.from("orang").select("id, nama").eq("status", "aktif").overlaps("jenis", ["karyawan", "magang"]).order("nama"),
  ]);
  const daftar = (kb ?? []) as unknown as Kasbon[];
  const sisa = daftar.reduce((s, k) => s + k.sisa, 0);
  return (
    <div lang={bahasa}>
      <h1 className="text-2xl font-semibold">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>
      {daftar.length === 0 ? (
        <p className="mt-6 text-tinta-2" data-testid="kasbon-kosong">{t.kosong}</p>
      ) : (
        <>
          <p className="mt-6 font-semibold" data-testid="sisa-kasbon">{t.sisaTotal} <Rupiah nilai={sisa} bahasa={bahasa} /></p>
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-kasbon">
            {daftar.map((k) => (
              <li key={k.id} className="py-3" data-orang={k.orang?.nama}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold" data-pengguna>{k.orang?.nama}</span>
                  <span>{t.sisa} <Rupiah nilai={k.sisa} className="font-semibold" bahasa={bahasa} /></span>
                </div>
                <p className="mt-1 text-tinta-2">
                  {isiTeks(t.rincian, { tanggal: formatTanggalKalender(k.tanggal, bahasa) })} <Rupiah nilai={k.jumlah} bahasa={bahasa} />, {t.cicilanPer} <Rupiah nilai={k.cicilan} bahasa={bahasa} />
                  {k.kasbon_bayar.length > 0 && <>, {isiTeks(t.terbayar, { n: k.kasbon_bayar.length })}</>}
                </p>
                <p className="mt-1 text-tinta-2" data-pengguna>{k.alasan}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      {sesi.peran === "pemilik" ? (
        <section className="mt-8" aria-labelledby="judul-beri-kasbon">
          <h2 id="judul-beri-kasbon" className="text-lg font-semibold">{t.beriJudul}</h2>
          <p className="mt-1 text-sm text-tinta-2">{t.beriKet}</p>
          <FormKasbon orang={(org ?? []) as { id: string; nama: string }[]} kunci={randomUUID()} teks={t} />
        </section>
      ) : (
        <p className="mt-8 text-sm text-tinta-2">{t.hanyaPemilikBeri}</p>
      )}
    </div>
  );
}

export default function HalamanKasbon() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
