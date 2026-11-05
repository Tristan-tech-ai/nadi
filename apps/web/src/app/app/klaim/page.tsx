import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormDinas, FormKategori, FormKlaim, FormUangHarian, TombolBayar, TombolSelesai, TombolUangMuka } from "@/components/app/klaim";
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

export const metadata: Metadata = { title: "Klaim pengeluaran" };

type Klaim = { id: string; tanggal: string; jumlah: number; terbayar: number; keterangan: string; status: string; orang: { nama: string } | null; kategori_klaim: { nama: string } | null };
type Dinas = { id: string; tujuan: string; mulai: string; selesai: string; uang_muka: number; status: string; uang_muka_dibayar: boolean; uang_harian_tarif: number; uang_harian_hari: number; orang: { nama: string } | null };
type Batas = { kategori_id: string; nama: string; batas: number | null; terpakai: number; butuh_struk: boolean };
const CAP: Record<string, "menunggu" | "diterima" | "ditolak"> = { menunggu: "menunggu", disetujui: "menunggu", dibayar: "diterima", ditolak: "ditolak", selesai: "diterima" };

function DaftarKlaim({ daftar, t, bahasa, pemilik }: { daftar: Klaim[]; t: Kamus["klaim"]; bahasa: Bahasa; pemilik: boolean }) {
  if (!daftar.length) return <p className="mt-3 text-sm text-tinta-2" data-testid="klaim-kosong">{t.kosong}</p>;
  return (
    <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-klaim">
      {daftar.map((k) => (
        <li key={k.id} className="py-3" data-keterangan={k.keterangan}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{k.kategori_klaim?.nama}{k.orang ? <>, <span data-pengguna>{k.orang.nama}</span></> : null}</span>
            <span className="flex items-center gap-2"><Cap jenis={CAP[k.status] ?? "menunggu"} label={t.status[k.status as keyof Kamus["klaim"]["status"]] ?? k.status} /><Rupiah nilai={k.jumlah} className="font-semibold" bahasa={bahasa} /></span>
          </div>
          <p className="mt-1 text-tinta-2"><span data-pengguna>{k.keterangan}</span>, {formatTanggalKalender(k.tanggal, bahasa)}</p>
          {k.status === "disetujui" && (
            <p className="mt-1 text-tinta-2">{isiTeks(t.belumDibayar, { n: (k.jumlah - k.terbayar).toLocaleString(bahasa === "en" ? "en-US" : "id-ID") })}</p>
          )}
          {pemilik && k.status === "disetujui" && (
            <div className="mt-2 flex flex-wrap gap-2">
              <TombolBayar klaim={k.id} cara="kas" label={`${t.bayarKas}: ${k.keterangan}`} teks={t.bayarKas} />
              <TombolBayar klaim={k.id} cara="bank" label={`${t.bayarBank}: ${k.keterangan}`} teks={t.bayarBank} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

// M-18: klaim pengeluaran karyawan dan perjalanan dinas.
async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).klaim;
  const pengelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const supabase = await createClient();
  const [{ data: kat }, { data: kl }, { data: dn }, { data: bt }, { data: uh }] = await Promise.all([
    supabase.from("kategori_klaim").select("id, nama, butuh_struk, batas_bulanan, akun").eq("aktif", true).order("nama"),
    supabase.from("klaim").select("id, tanggal, jumlah, terbayar, keterangan, status, orang:orang_id(nama), kategori_klaim(nama)").order("dibuat_at", { ascending: false }).limit(50),
    supabase.from("perjalanan_dinas").select("id, tujuan, mulai, selesai, uang_muka, status, uang_muka_dibayar, uang_harian_tarif, uang_harian_hari, orang:orang_id(nama)").order("mulai", { ascending: false }).limit(20),
    sesi.peran === "staf" ? supabase.rpc("sisa_batas_klaim", { p_tanggal: hari }) : Promise.resolve({ data: [] }),
    supabase.from("uang_harian").select("kota, nominal").eq("aktif", true).order("kota"),
  ]);
  const tarif = (uh ?? []) as { kota: string; nominal: number }[];
  const kategori = (kat ?? []) as { id: string; nama: string; butuh_struk: boolean; batas_bulanan: number | null; akun: string }[];
  const klaim = (kl ?? []) as unknown as Klaim[];
  const dinas = (dn ?? []) as unknown as Dinas[];
  const batas = (bt ?? []) as Batas[];
  const judul = "text-lg font-semibold";
  return (
    <div lang={bahasa}>
      <h1 className="text-2xl font-semibold">{t.judul}</h1>
      <p className="mt-2 text-tinta-2">{t.ket}</p>

      {sesi.peran === "staf" && (
        <>
          {batas.some((b) => b.batas) && (
            <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm" data-testid="sisa-batas">
              {batas.filter((b) => b.batas).map((b) => (
                <div key={b.kategori_id} className="contents"><dt>{b.nama}</dt><dd className="text-right">{isiTeks(t.sisaBatas, { sisa: Math.max(0, (b.batas ?? 0) - b.terpakai).toLocaleString(bahasa === "en" ? "en-US" : "id-ID") })}</dd></div>
              ))}
            </dl>
          )}
          <section className="mt-6" aria-labelledby="judul-ajukan-klaim">
            <h2 id="judul-ajukan-klaim" className={judul}>{t.ajukanJudul}</h2>
            {kategori.length ? <FormKlaim kategori={kategori} perjalanan={dinas.filter((d) => d.status === "disetujui")} hari={hari} kunci={randomUUID()} teks={t} />
              : <p className="mt-2 text-sm text-tinta-2">{t.belumKategori}</p>}
          </section>
        </>
      )}

      <section className="mt-8" aria-labelledby="judul-daftar-klaim">
        <h2 id="judul-daftar-klaim" className={judul}>{sesi.peran === "staf" ? t.klaimku : t.semuaKlaim}</h2>
        <DaftarKlaim daftar={klaim} t={t} bahasa={bahasa} pemilik={sesi.peran === "pemilik"} />
        {pengelola && <p className="mt-2 text-xs text-tinta-2">{t.lewatSlip}</p>}
      </section>

      <section className="mt-8 border-t border-garis pt-6" aria-labelledby="judul-dinas" data-testid="dinas">
        <h2 id="judul-dinas" className={judul}>{t.dinasJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.dinasKet}</p>
        {sesi.peran === "staf" && <FormDinas hari={hari} kunci={randomUUID()} teks={t} />}
        {dinas.length > 0 && (
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-dinas">
            {dinas.map((d) => (
              <li key={d.id} className="py-3" data-tujuan={d.tujuan}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{d.tujuan}{d.orang ? <>, <span data-pengguna>{d.orang.nama}</span></> : null}</span>
                  <Cap jenis={CAP[d.status] ?? "menunggu"} label={t.statusDinas[d.status as keyof Kamus["klaim"]["statusDinas"]] ?? d.status} />
                </div>
                <p className="mt-1 text-tinta-2">{isiTeks(t.rentang, { a: formatTanggalKalender(d.mulai, bahasa), b: formatTanggalKalender(d.selesai, bahasa) })}{d.uang_muka > 0 && <>, {t.uangMuka} <Rupiah nilai={d.uang_muka} bahasa={bahasa} />{d.uang_muka_dibayar ? ` (${t.sudahDibayar})` : ""}</>}{d.uang_harian_tarif > 0 && <span data-testid="uang-harian-dinas">, {isiTeks(t.uangHarianBaris, { hari: d.uang_harian_hari })} <Rupiah nilai={d.uang_harian_tarif * d.uang_harian_hari} bahasa={bahasa} /></span>}</p>
                {d.status === "disetujui" && pengelola && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sesi.peran === "pemilik" && d.uang_muka > 0 && !d.uang_muka_dibayar && <TombolUangMuka dinas={d.id} label={`${t.bayarUangMuka}: ${d.tujuan}`} teks={t.bayarUangMuka} />}
                    <TombolSelesai dinas={d.id} label={`${t.selesaikan}: ${d.tujuan}`} teks={t.selesaikan} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pengelola && (
        <section className="mt-8 border-t border-garis pt-6" aria-labelledby="judul-kategori">
          <h2 id="judul-kategori" className={judul}>{t.kategoriJudul}</h2>
          {kategori.length > 0 && (
            <ul className="mt-2 text-sm" data-testid="daftar-kategori">
              {kategori.map((k) => <li key={k.id}>{k.nama}: {k.batas_bulanan ? isiTeks(t.batasPerBulan, { n: k.batas_bulanan.toLocaleString(bahasa === "en" ? "en-US" : "id-ID") }) : t.tanpaBatas}, {k.butuh_struk ? t.wajibStruk : t.tanpaStruk}, {t.akunLabel} {k.akun}</li>)}
            </ul>
          )}
          <FormKategori teks={t} />
          <h3 className="mt-6 font-semibold">{t.uangHarianJudul}</h3>
          <p className="mt-1 text-sm text-tinta-2">{t.uangHarianKet}</p>
          {tarif.length > 0 && (
            <ul className="mt-2 text-sm" data-testid="daftar-uang-harian">
              {tarif.map((u) => <li key={u.kota}>{u.kota === "*" ? t.uangHarianLain : u.kota.replace(/\b\w/g, (c) => c.toUpperCase())}: <Rupiah nilai={u.nominal} bahasa={bahasa} /> {t.uangHarianPerHari}</li>)}
            </ul>
          )}
          <FormUangHarian teks={t} />
        </section>
      )}
    </div>
  );
}

export default function HalamanKlaim() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
