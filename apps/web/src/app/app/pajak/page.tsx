import type { Metadata } from "next";
import { Suspense } from "react";
import { FormProfilPajak, SimulatorPajak } from "@/components/app/pajak";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import type { LapisanP17, Ptkp } from "@/lib/gaji/pph21";
import { cekBatas, DASAR, hitungFinal, NAMA_BENTUK, type AturanFinal, type Bentuk } from "@/lib/pajak/kompas";
import { createClient } from "@/lib/supabase/server";
import { wajibPerusahaan } from "@/lib/sesi";

export const metadata: Metadata = { title: "Kompas Pajak" };

// F4-07 (docs/research/kompas-pajak.md): posisi PPh final UMKM dari pembukuan, batas Rp4,8 M gabungan, simulator bentuk usaha.
// Setiap angka menyebut dasar hukum dan tanggal berlakunya; hanya hitungan yang sah.
type Posisi = {
  tahun: number; hari: string; bulanan: number[];
  profil: { bentuk?: Bentuk; bruto_lalu?: number; usaha_lain_lalu?: number; usaha_lain_ini?: number; pasangan_lalu?: number; pasangan_ini?: number };
  aturan: { nilai: AturanFinal; berlaku_dari: string; sumber: string } | null;
};
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

async function Isi() {
  const sesi = await wajibPerusahaan();
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) return <p className="mt-6 text-tinta-2">Kompas Pajak hanya untuk pemilik, admin, dan akuntan.</p>;
  const supabase = await createClient();
  const tahun = new Date().getFullYear();
  const [ini, lalu, at] = await Promise.all([
    supabase.rpc("posisi_pajak", { p_tahun: tahun }),
    supabase.rpc("posisi_pajak", { p_tahun: tahun - 1 }),
    supabase.from("aturan_bertanggal").select("kunci, nilai, berlaku_dari").in("kunci", ["pph21.pasal17", "pph21.ptkp"]).eq("terverifikasi", true).order("berlaku_dari", { ascending: false }),
  ]);
  if (ini.error || lalu.error) return <p role="alert" className="mt-6 text-cap">Posisi pajak belum bisa dimuat. Coba muat ulang.</p>;
  const p = ini.data as Posisi;
  if (!p.aturan) return <p className="mt-6 text-tinta-2">Aturan PPh final untuk tahun ini belum terverifikasi di Nadi, jadi belum dihitung.</p>;
  const a = p.aturan.nilai;
  const berlaku = formatTanggalKalender(p.aturan.berlaku_dari);
  const bentuk = p.profil.bentuk;
  const brutoIni = p.bulanan.reduce((t, b) => t + Math.max(0, Number(b)), 0);
  const brutoLaluNadi = (lalu.data as Posisi).bulanan.reduce((t, b) => t + Math.max(0, Number(b)), 0);
  const final = bentuk ? hitungFinal(p.bulanan.map(Number), bentuk, a) : null;
  const batas = bentuk ? cekBatas({ bentuk, brutoLalu: Math.max(brutoLaluNadi, p.profil.bruto_lalu ?? 0), usahaLainLalu: p.profil.usaha_lain_lalu ?? 0,
    pasanganLalu: p.profil.pasangan_lalu ?? 0, brutoIni, usahaLainIni: p.profil.usaha_lain_ini ?? 0, pasanganIni: p.profil.pasangan_ini ?? 0 }, a) : null;
  const ambil = (k: string) => (at.data ?? []).find((x) => x.kunci === k)?.nilai;
  const lapisan = ambil("pph21.pasal17") as LapisanP17 | undefined;
  const ptkp = ambil("pph21.ptkp") as Ptkp | undefined;
  const bulanIni = Number(p.hari.slice(5, 7));

  return (
    <>
      <section className="mt-6" aria-labelledby="judul-posisi" data-testid="posisi-pajak">
        <h2 id="judul-posisi" className="text-lg font-semibold">Posisi PPh final {p.tahun}</h2>
        {!bentuk ? (
          <p className="mt-1 text-sm" data-testid="profil-belum">Pilih bentuk usahamu di bagian Batas Rp4,8 M supaya Nadi tahu aturan mana yang berlaku.</p>
        ) : !final?.berlaku ? (
          <p className="mt-1 text-sm">{NAMA_BENTUK[bentuk]} memakai tarif umum, bukan PPh final 0,5%. Dasar: {DASAR.peralihan}.</p>
        ) : (
          <>
            <p className="mt-2 text-base font-semibold" data-testid="kalimat-posisi">
              Kalau tutup buku hari ini, PPh final {p.tahun} dari pembukuan Nadi: <Rupiah nilai={final.total} />.
            </p>
            <p className="mt-1 text-xs text-tinta-2">
              Tarif 0,5% dari peredaran bruto sebulan{bentuk === "op" ? ", Rp500 jt pertama setahun tidak dikenai" : ""}; disetor sendiri setiap bulan (PP 55/2022 Pasal 62 ayat (2)).
              Dasar: {DASAR.tarif}{bentuk === "op" ? `; ${DASAR.bebas}` : ""}. Aturan di Nadi berlaku sejak {berlaku}; tarif dan bagian bebas sebelum tanggal itu sama menurut PP 55/2022.
            </p>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">PPh final per bulan</caption>
              <thead><tr className="border-b border-garis-kuat text-left text-tinta-2"><th scope="col" className="py-1 font-semibold">Bulan</th><th scope="col" className="py-1 text-right font-semibold">Bruto</th><th scope="col" className="py-1 text-right font-semibold">Dikenai</th><th scope="col" className="py-1 text-right font-semibold">PPh final</th></tr></thead>
              <tbody>
                {final.perBulan.filter((b) => b.bulan <= bulanIni).map((b) => (
                  <tr key={b.bulan} className="border-b border-garis"><td className="py-1">{BULAN[b.bulan - 1]}</td><td className="py-1 text-right"><Rupiah nilai={b.bruto} /></td>
                    <td className="py-1 text-right"><Rupiah nilai={b.dpp} /></td><td className="py-1 text-right"><Rupiah nilai={b.pajak} /></td></tr>
                ))}
              </tbody>
            </table>
            {final.lewatBulan && <p className="mt-2 text-sm">Bruto melewati Rp4,8 M di bulan {BULAN[final.lewatBulan - 1]}. Dasar: {DASAR.lewat}.</p>}
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="judul-batas" data-testid="batas-gabungan">
        <h2 id="judul-batas" className="text-lg font-semibold">Batas Rp4,8 M gabungan</h2>
        <p className="mt-1 text-sm text-tinta-2">Sejak PP 20/2026, batas dihitung dari semua usaha milikmu, PT perorangan yang kamu dirikan, dan pasangan yang pisah harta. Bruto tahun lalu menentukan boleh tidaknya tahun ini.</p>
        {batas && (
          <div className="mt-3 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="hasil-batas" data-status={batas.status}>
            <p className="font-semibold">{batas.kalimat}</p>
            <p className="mt-1 text-xs text-tinta-2">Dasar: {batas.dasar}. Bruto usaha ini tahun lalu menurut Nadi: <Rupiah nilai={brutoLaluNadi} />.</p>
          </div>
        )}
        {sesi.peran === "pemilik" ? <FormProfilPajak awal={p.profil} /> : <p className="mt-2 text-sm text-tinta-2">Profil pajak diatur pemilik.</p>}
      </section>

      <section className="mt-8" aria-labelledby="judul-simulasi">
        <h2 id="judul-simulasi" className="text-lg font-semibold">Simulator bentuk usaha</h2>
        <p className="mt-1 text-sm text-tinta-2">Perbandingan sah setahun. Hasil ini perkiraan untuk dibicarakan dengan akuntan, bukan nasihat pajak.</p>
        {lapisan && ptkp ? <SimulatorPajak aturan={a} lapisan={lapisan} ptkp={ptkp} /> : <p className="mt-2 text-sm text-tinta-2">Tarif Pasal 17 belum terverifikasi di Nadi.</p>}
      </section>
    </>
  );
}

export default function HalamanPajak() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">Kompas Pajak</h1>
      <p className="mt-1 text-sm text-tinta-2">PPh final UMKM dari pembukuanmu. Belum termasuk PPN, PPh 21 karyawan, dan pajak daerah.</p>
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
