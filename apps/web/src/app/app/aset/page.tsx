import type { Metadata } from "next";
import { Suspense } from "react";
import { FormAset, FormLepas, FormPenyusutan, FormPinjam } from "@/components/app/aset";
import { Cap } from "@/components/ui/cap";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks, type Kamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Aset tetap" };

type Aset = { id: string; nama: string; kelompok: keyof Kamus["aset"]["kelompokNama"]; metode: string; tanggal_perolehan: string; harga: number; status: string; harga_jual: number | null;
  dipinjam_orang: string | null; penyusutan_aset: { nilai: number }[] };

// M-06: aset tetap dengan penyusutan Pasal 11 UU PPh. Staf melihat aset yang sedang ia pinjam.
async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).aset;
  const kelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const akhirBulanLalu = new Date(Date.UTC(Number(hari.slice(0, 4)), Number(hari.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
  const supabase = await createClient();
  const [{ data }, { data: org }] = await Promise.all([
    supabase.from("aset_tetap").select("id, nama, kelompok, metode, tanggal_perolehan, harga, status, harga_jual, dipinjam_orang, penyusutan_aset(nilai)").order("tanggal_perolehan", { ascending: false }),
    kelola ? supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(500) : Promise.resolve({ data: [] }),
  ]);
  const aset = (data ?? []) as unknown as Aset[];
  const orang = (org ?? []) as { id: string; nama: string }[];
  const namaOrang = new Map(orang.map((o) => [o.id, o.nama]));
  const aktif = aset.filter((a) => a.status === "aktif");
  const total = aktif.reduce((s, a) => s + a.harga - a.penyusutan_aset.reduce((x, p) => x + p.nilai, 0), 0);
  return (
    <div lang={bahasa}>
      <h1 className="text-2xl font-semibold">{sesi.peran === "staf" ? t.judulStaf : t.judul}</h1>
      <p className="mt-2 text-tinta-2">{sesi.peran === "staf" ? t.ketStaf : t.ket}</p>
      {aset.length === 0 ? <p className="mt-6 text-tinta-2" data-testid="aset-kosong">{sesi.peran === "staf" ? t.kosongStaf : t.kosong}</p> : (
        <>
          {sesi.peran !== "staf" && <p className="mt-6 font-semibold" data-testid="total-nilai-buku">{t.totalNilaiBuku} <Rupiah nilai={total} bahasa={bahasa} /></p>}
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-aset">
            {aset.map((a) => {
              const akum = a.penyusutan_aset.reduce((s, p) => s + p.nilai, 0);
              return (
                <li key={a.id} className="py-3" data-nama={a.nama}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold" data-pengguna>{a.nama}</span>
                    <Cap jenis={a.status === "aktif" ? "diterima" : "ditolak"} label={t.status[a.status as keyof Kamus["aset"]["status"]] ?? a.status} />
                  </div>
                  <p className="mt-1 text-tinta-2">{t.kelompokNama[a.kelompok]}, {a.metode === "saldo_menurun" ? t.saldoMenurun : t.garisLurus}, {isiTeks(t.sejak, { t: formatTanggalKalender(a.tanggal_perolehan, bahasa) })}</p>
                  {sesi.peran !== "staf" && (
                    <dl className="mt-1 grid grid-cols-3 gap-2" data-testid="angka-aset">
                      <div><dt className="text-xs text-tinta-2">{t.harga}</dt><dd><Rupiah nilai={a.harga} bahasa={bahasa} /></dd></div>
                      <div><dt className="text-xs text-tinta-2">{t.akumulasi}</dt><dd><Rupiah nilai={akum} bahasa={bahasa} /></dd></div>
                      <div><dt className="text-xs text-tinta-2">{t.nilaiBuku}</dt><dd className="font-semibold" data-testid="nilai-buku"><Rupiah nilai={a.harga - akum} bahasa={bahasa} /></dd></div>
                    </dl>
                  )}
                  {a.dipinjam_orang && sesi.peran !== "staf" && <p className="mt-1">{isiTeks(t.dipinjam, { nama: namaOrang.get(a.dipinjam_orang) ?? "-" })}</p>}
                  {kelola && a.status === "aktif" && (
                    <>
                      <FormPinjam aset={a.id} nama={a.nama} orang={orang} dipinjam={Boolean(a.dipinjam_orang)} teks={t} />
                      <FormLepas aset={a.id} nama={a.nama} hari={hari} teks={t} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {kelola && (
        <>
          <section className="mt-6" aria-labelledby="judul-susut">
            <h2 id="judul-susut" className="text-lg font-semibold">{t.susutJudul}</h2>
            <p className="mt-1 text-sm text-tinta-2">{isiTeks(t.susutKet, { t: formatTanggalKalender(akhirBulanLalu, bahasa) })}</p>
            <FormPenyusutan sampai={akhirBulanLalu} teks={t} />
          </section>
          <section className="mt-8 border-t border-garis pt-6" aria-labelledby="judul-catat-aset">
            <h2 id="judul-catat-aset" className="text-lg font-semibold">{t.catatJudul}</h2>
            <p className="mt-1 text-sm text-tinta-2">{t.dasar}</p>
            <FormAset hari={hari} teks={t} />
          </section>
        </>
      )}
    </div>
  );
}

export default function HalamanAset() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
