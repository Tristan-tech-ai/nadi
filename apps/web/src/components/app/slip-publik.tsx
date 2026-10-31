"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Rupiah } from "@/components/ui/rupiah";
import type { Komponen } from "@/lib/gaji/susun";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Slip = {
  usaha: string;
  nama: string;
  id_staf: string | null;
  bulan: string;
  komponen: Komponen[];
  bruto: number;
  potongan: number;
  neto: number;
  peringatan: string[];
};
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const tanpaLangganan = () => () => {};
const bacaToken = () => {
  const t = decodeURIComponent(window.location.hash.slice(1));
  return /^nms_[0-9a-f]{64}$/.test(t) ? t : "";
};

/** Slip gaji yang dibuka lewat tautan (token di fragmen URL, tidak terkirim ke server Nadi kecuali sebagai parameter RPC). */
export function SlipPublik() {
  // undefined saat prerender, "" bila fragmen tidak berisi token yang sah.
  const token = useSyncExternalStore<string | undefined>(tanpaLangganan, bacaToken, () => undefined);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [galatMuat, setGalat] = useState("");
  const galat = token === "" ? "Tautan slip tidak lengkap. Buka lagi tautan yang dikirim pemilik usaha." : galatMuat;

  useEffect(() => {
    if (!token) return;
    createBrowserSupabase()
      .rpc("buka_slip", { p_token: token })
      .then(({ data, error }) => {
        if (error) setGalat(error.code === "28000" ? error.message : "Slip gagal dimuat. Periksa internetmu lalu muat ulang.");
        else setSlip(data as Slip);
      });
  }, [token]);

  if (galat) return <p role="alert" className="mt-8 text-tinta-2" data-testid="slip-galat">{galat}</p>;
  if (!slip) return <div className="mt-8 h-96 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />;
  const per = (jenis: Komponen["jenis"]) => slip.komponen.filter((k) => k.jenis === jenis);
  const Baris = ({ k, negatif = false }: { k: Komponen; negatif?: boolean }) => (
    <div className="flex justify-between gap-4 border-b border-garis py-1.5">
      <dt>{k.label}</dt>
      <dd><Rupiah nilai={negatif ? -k.nilai : k.nilai} /></dd>
    </div>
  );
  return (
    <article className="mt-8 rounded-[var(--radius-kartu)] border border-garis bg-kertas p-5 print:border-0" data-testid="slip">
      <header className="border-b border-garis pb-3">
        <p className="text-sm text-tinta-2">{slip.usaha}</p>
        <h1 className="font-judul text-2xl font-extrabold">Slip gaji {BULAN[Number(slip.bulan.slice(5, 7)) - 1]} {slip.bulan.slice(0, 4)}</h1>
        <p className="mt-1">{slip.nama}{slip.id_staf ? <span className="font-mono text-tinta-2"> · {slip.id_staf}</span> : null}</p>
      </header>
      <section className="mt-4" aria-labelledby="pendapatan">
        <h2 id="pendapatan" className="text-sm font-semibold text-tinta-2">Pendapatan</h2>
        <dl className="mt-1">{per("pendapatan").map((k) => <Baris key={k.kode} k={k} />)}</dl>
      </section>
      <section className="mt-4" aria-labelledby="potongan">
        <h2 id="potongan" className="text-sm font-semibold text-tinta-2">Potongan</h2>
        <dl className="mt-1">{per("potongan").map((k) => <Baris key={k.kode} k={k} negatif />)}</dl>
      </section>
      <p className="mt-4 flex justify-between text-lg font-semibold" data-testid="slip-neto">
        <span>Diterima</span>
        <Rupiah nilai={slip.neto} />
      </p>
      {per("pemberi_kerja").length > 0 && (
        <section className="mt-6 text-sm text-tinta-2" aria-labelledby="ditanggung">
          <h2 id="ditanggung" className="font-semibold">Ditanggung usaha (tidak memotong gaji)</h2>
          <dl className="mt-1">{per("pemberi_kerja").map((k) => <Baris key={k.kode} k={k} />)}</dl>
        </section>
      )}
      {slip.peringatan.length > 0 && (
        <ul className="mt-4 list-disc pl-5 text-sm text-tinta-2">{slip.peringatan.map((p) => <li key={p}>{p}</li>)}</ul>
      )}
      <p className="mt-6 text-xs text-tinta-2">PPh 21 memakai tarif efektif rata-rata (PMK 168/2023). Dibuat dengan Nadi.</p>
    </article>
  );
}
