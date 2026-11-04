import type { Metadata } from "next";
import { KunciAturan, negaraUsaha } from "@/components/app/aturan-indonesia";
import { Suspense } from "react";
import { FormProfilPajak, SimulatorPajak } from "@/components/app/pajak";
import { Rupiah } from "@/components/ui/rupiah";
import { formatTanggalKalender } from "@/lib/format";
import type { LapisanP17, Ptkp } from "@/lib/gaji/pph21";
import { cekBatas, DASAR, hitungFinal, NAMA_BENTUK, type AturanFinal, type Bentuk } from "@/lib/pajak/kompas";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { sisip } from "@/lib/i18n/sisip";
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

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).pajak;
  const BULAN = t.bulan;
  const isiLang = bahasa === "id" ? undefined : "id";
  // Kutipan pasal dan kalimat hitungan dari lib/pajak tetap bahasa Indonesia (teks hukum Indonesia).
  const id = (teks: string) => <span lang={isiLang}>{teks}</span>;
  const kepala = (
    <>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      {bahasa !== "id" && <p className="mt-2 text-sm font-semibold" data-testid="khusus-indonesia">{t.khususId}</p>}
      <p className="mt-2 text-sm"><a href="/app/mitra" className="underline underline-offset-4" data-testid="tautan-mitra">{ambilKamus(bahasa).mitra.judul}</a></p>
    </>
  );
  const bungkus = (isi: React.ReactNode) => <div lang={bahasa}>{kepala}{isi}</div>;
  const negara = await negaraUsaha(sesi.perusahaanId, bahasa);
  if (negara.kode !== "ID") return bungkus(<KunciAturan negara={negara.nama} bahasa={bahasa} />);
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) return bungkus(<p className="mt-6 text-tinta-2">{t.hanyaPeran}</p>);
  const supabase = await createClient();
  const tahun = new Date().getFullYear();
  const [ini, lalu, at] = await Promise.all([
    supabase.rpc("posisi_pajak", { p_tahun: tahun }),
    supabase.rpc("posisi_pajak", { p_tahun: tahun - 1 }),
    supabase.from("aturan_bertanggal").select("kunci, nilai, berlaku_dari").in("kunci", ["pph21.pasal17", "pph21.ptkp"]).eq("terverifikasi", true).order("berlaku_dari", { ascending: false }),
  ]);
  if (ini.error || lalu.error) return bungkus(<p role="alert" className="mt-6 text-cap">{t.gagalMuat}</p>);
  const p = ini.data as Posisi;
  if (!p.aturan) return bungkus(<p className="mt-6 text-tinta-2">{t.belumAturan}</p>);
  const a = p.aturan.nilai;
  const berlaku = formatTanggalKalender(p.aturan.berlaku_dari, bahasa);
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

  return bungkus(
    <>
      <section className="mt-6" aria-labelledby="judul-posisi" data-testid="posisi-pajak">
        <h2 id="judul-posisi" className="text-lg font-semibold">{sisip(t.posisiJudul, { tahun: p.tahun })}</h2>
        {!bentuk ? (
          <p className="mt-1 text-sm" data-testid="profil-belum">{t.profilBelum}</p>
        ) : !final?.berlaku ? (
          <p className="mt-1 text-sm">{sisip(t.tarifUmum, { bentuk: id(NAMA_BENTUK[bentuk]), dasar: id(DASAR.peralihan) })}</p>
        ) : (
          <>
            <p className="mt-2 text-base font-semibold" data-testid="kalimat-posisi">
              {sisip(t.kalimatPosisi, { tahun: p.tahun, rp: <Rupiah nilai={final.total} /> })}
            </p>
            <p className="mt-1 text-xs text-tinta-2">
              {sisip(t.tarifKet, { bebas: bentuk === "op" ? t.bebasOp : "", dasar: id(`${DASAR.tarif}${bentuk === "op" ? `; ${DASAR.bebas}` : ""}`), berlaku })}
            </p>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">{t.caption}</caption>
              <thead><tr className="border-b border-garis-kuat text-left text-tinta-2"><th scope="col" className="py-1 font-semibold">{t.kBulan}</th><th scope="col" className="py-1 text-right font-semibold">{t.kBruto}</th><th scope="col" className="py-1 text-right font-semibold">{t.kDikenai}</th><th scope="col" className="py-1 text-right font-semibold">{t.kPph}</th></tr></thead>
              <tbody>
                {final.perBulan.filter((b) => b.bulan <= bulanIni).map((b) => (
                  <tr key={b.bulan} className="border-b border-garis"><td className="py-1">{BULAN[b.bulan - 1]}</td><td className="py-1 text-right"><Rupiah nilai={b.bruto} /></td>
                    <td className="py-1 text-right"><Rupiah nilai={b.dpp} /></td><td className="py-1 text-right"><Rupiah nilai={b.pajak} /></td></tr>
                ))}
              </tbody>
            </table>
            {final.lewatBulan && <p className="mt-2 text-sm">{sisip(t.lewat, { bulan: BULAN[final.lewatBulan - 1], dasar: id(DASAR.lewat) })}</p>}
          </>
        )}
      </section>

      <section className="mt-8" aria-labelledby="judul-batas" data-testid="batas-gabungan">
        <h2 id="judul-batas" className="text-lg font-semibold">{t.batasJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.batasKet}</p>
        {batas && (
          <div className="mt-3 rounded-[var(--radius-isian)] border border-garis-kuat p-3 text-sm" data-testid="hasil-batas" data-status={batas.status}>
            <p className="font-semibold" lang={isiLang}>{batas.kalimat}</p>
            <p className="mt-1 text-xs text-tinta-2">{sisip(t.dasarBatas, { dasar: id(batas.dasar), rp: <Rupiah nilai={brutoLaluNadi} /> })}</p>
          </div>
        )}
        {sesi.peran === "pemilik" ? <FormProfilPajak awal={p.profil} teks={t} /> : <p className="mt-2 text-sm text-tinta-2">{t.profilPemilik}</p>}
      </section>

      <p className="mt-8 text-sm"><a href="/app/pajak/faktur" className="font-semibold text-laut underline underline-offset-4" data-testid="tautan-faktur">{ambilKamus(bahasa).faktur.judul}</a> <a href="/app/kepatuhan" className="ml-4 font-semibold text-laut underline underline-offset-4" data-testid="tautan-kepatuhan">{ambilKamus(bahasa).kepatuhan.judul}</a> <a href="/app/aset" className="ml-4 font-semibold text-laut underline underline-offset-4" data-testid="tautan-aset">{ambilKamus(bahasa).aset.judul}</a></p>

      <section className="mt-8" aria-labelledby="judul-simulasi">
        <h2 id="judul-simulasi" className="text-lg font-semibold">{t.simJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.simKet}</p>
        {lapisan && ptkp ? <SimulatorPajak aturan={a} lapisan={lapisan} ptkp={ptkp} teks={t} isiLang={isiLang} /> : <p className="mt-2 text-sm text-tinta-2">{t.p17Belum}</p>}
      </section>
    </>
  );
}

export default function HalamanPajak() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10">
      <Suspense fallback={<div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" aria-hidden />}>
        <Isi />
      </Suspense>
    </main>
  );
}
