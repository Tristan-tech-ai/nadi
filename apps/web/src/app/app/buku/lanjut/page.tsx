import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Suspense, type ReactNode } from "react";
import {
  FormAnggaran, FormAntarusaha, FormAturan, FormBerulang, FormDimensi, FormKurs, FormLunasEkspor, FormRevaluasi, KalkulatorKurs, TombolAktif, TombolJalankan,
} from "@/components/app/buku-lanjut";
import { Rupiah } from "@/components/ui/rupiah";
import { bacaGrup, kursBerlaku, type Konsolidasi, type Kurs, type LaporanAnggaran, type LaporanDimensi } from "@/lib/buku/lanjut";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus, isiTeks } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Anggaran, cabang, dan konsolidasi" };

type T = ReturnType<typeof ambilKamus>["bukuLanjut"];
const TGL = /^\d{4}-\d{2}-\d{2}$/;
const sel = "py-2 pr-3 align-top";
const angka = "py-2 pl-2 text-right align-top whitespace-nowrap";
const judul = "text-lg font-semibold";

function Tabel({ kepala, label, children, kanan = 1 }: { kepala: string[]; label: string; children: ReactNode; kanan?: number }) {
  return (
    <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full border-y border-garis text-sm">
        <thead><tr className="border-b border-garis text-left text-tinta-2">{kepala.map((k, i) => <th key={k} scope="col" className={`py-2 font-medium ${i >= kepala.length - kanan ? "pl-2 text-right" : "pr-3"}`}>{k}</th>)}</tr></thead>
        <tbody className="divide-y divide-garis">{children}</tbody>
      </table>
    </div>
  );
}

function Anggaran({ L, t, b }: { L: LaporanAnggaran; t: T; b: Bahasa }) {
  if (!L.baris.length) return <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-sm text-tinta-2" data-testid="anggaran-kosong">{t.anggaranKosong}</p>;
  const ringkas: [string, { anggaran: number; realisasi: number }][] = [[t.pendapatan, L.pendapatan], [t.beban, L.beban], [t.laba, L.laba]];
  return (
    <div data-testid="laporan-anggaran">
      <Tabel kepala={[t.akun, t.kolomAnggaran, t.kolomRealisasi, t.kolomSelisih, t.kolomPersen]} label={t.anggaranJudul} kanan={4}>
        {L.baris.map((x) => (
          <tr key={x.kode} data-kode={x.kode}>
            <td className={sel}><span className="angka text-tinta-2">{x.kode}</span> <span data-pengguna>{x.nama}</span></td>
            <td className={angka}><Rupiah nilai={x.anggaran} bahasa={b} /></td><td className={angka}><Rupiah nilai={x.realisasi} bahasa={b} /></td>
            <td className={angka}><Rupiah nilai={x.selisih} bahasa={b} /></td><td className={`${angka} angka`}>{x.persen === null ? "-" : `${x.persen}%`}</td>
          </tr>
        ))}
        {ringkas.map(([k, v]) => (
          <tr key={k} className="font-semibold"><td className={sel}>{k}</td><td className={angka}><Rupiah nilai={v.anggaran} bahasa={b} /></td>
            <td className={angka}><Rupiah nilai={v.realisasi} bahasa={b} /></td><td className={angka}><Rupiah nilai={v.realisasi - v.anggaran} bahasa={b} /></td><td className={angka} /></tr>
        ))}
      </Tabel>
    </div>
  );
}

function LabaDimensi({ L, t, b }: { L: LaporanDimensi; t: T; b: Bahasa }) {
  return (
    <section className="mt-5" aria-labelledby={`lr-${L.jenis}`} data-testid={`lr-${L.jenis}`}>
      <h3 id={`lr-${L.jenis}`} className="font-semibold">{isiTeks(t.lrDimensi, { jenis: t.jenisNama[L.jenis].toLowerCase() })}</h3>
      <Tabel kepala={[t.namaDimensi, t.pendapatan, t.beban, t.laba]} label={isiTeks(t.lrDimensi, { jenis: t.jenisNama[L.jenis].toLowerCase() })} kanan={3}>
        {L.baris.map((x) => (
          <tr key={x.dimensi ?? "tanpa"} data-dimensi={x.nama ?? ""}>
            <td className={sel}>{x.nama ? <span data-pengguna>{x.nama}</span> : <span className="text-tinta-2">{t.tanpaTag}</span>}</td>
            <td className={angka}><Rupiah nilai={x.pendapatan} bahasa={b} /></td><td className={angka}><Rupiah nilai={x.beban} bahasa={b} /></td>
            <td className={`${angka} font-semibold`}><Rupiah nilai={x.laba} bahasa={b} /></td>
          </tr>
        ))}
      </Tabel>
    </section>
  );
}

function Gabungan({ K, t, b }: { K: Konsolidasi; t: T; b: Bahasa }) {
  const n = K.neraca;
  return (
    <div className="mt-4" data-testid="konsolidasi">
      <p className="text-sm text-tinta-2" data-pengguna>{K.usaha.map((u) => u.nama).join(", ")}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {([[t.pendapatan, K.laba_rugi.pendapatan], [t.beban, K.laba_rugi.beban], [t.laba, K.laba_rugi.laba], [t.aset, n.aset]] as [string, number][]).map(([k, v]) => (
          <div key={k} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-3"><dt className="text-tinta-2">{k}</dt><dd className="mt-1 font-semibold"><Rupiah nilai={v} bahasa={b} /></dd></div>
        ))}
      </dl>
      <Tabel kepala={[t.akun, t.laba]} label={t.konsolJudul}>
        {[...n.baris.map((x) => ({ ...x, nilai: x.saldo })), ...K.laba_rugi.baris].map((x) => (
          <tr key={`${x.golongan}-${x.kode}`} data-kode={x.kode}><td className={sel}><span className="angka text-tinta-2">{x.kode}</span> <span data-pengguna>{x.nama}</span></td><td className={angka}><Rupiah nilai={x.nilai} bahasa={b} /></td></tr>
        ))}
      </Tabel>
      <p className="mt-2 flex justify-between border-b-2 border-tinta py-2 text-sm font-semibold"><span>{t.kewajibanModal}</span><Rupiah nilai={n.kewajiban + n.modal + n.laba_belum_ditutup} bahasa={b} /></p>
      <p className={`mt-2 text-sm ${n.seimbang ? "text-daun" : "text-cap"}`} data-testid="konsolidasi-seimbang" data-seimbang={n.seimbang ? "ya" : "tidak"}>{n.seimbang ? t.seimbang : t.tidakSeimbang}</p>
      <p className="mt-1 text-sm text-tinta-2" data-testid="eliminasi">{isiTeks(t.eliminasi, { n: K.eliminasi.jurnal, rp: formatRupiah(K.eliminasi.nilai, { bahasa: b }) })}</p>
    </div>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/buku/lanjut">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).bukuLanjut;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/buku/lanjut" judul={t.judul} ket={t.hanya} /></div>;
  }
  const sp = await searchParams;
  const hari = hariIni(new Date(), await zonaUsahaIni(sesi.perusahaanId));
  const awalBulan = `${hari.slice(0, 7)}-01`;
  let dari = typeof sp.dari === "string" && TGL.test(sp.dari) ? sp.dari : awalBulan;
  let sampai = typeof sp.sampai === "string" && TGL.test(sp.sampai) ? sp.sampai : hari;
  if (dari > sampai) [dari, sampai] = [sampai, dari];
  const dim = typeof sp.dim === "string" && /^[0-9a-f-]{36}$/i.test(sp.dim) ? sp.dim : null;
  // Kotak centang mengirim ?g=a&g=b; tautan dan isian tersembunyi memakai ?grup=a,b.
  const grup = bacaGrup(Array.isArray(sp.g) ? sp.g.join(",") : sp.g ?? sp.grup);
  const supabase = await createClient();
  // Usaha baru: bagan akun bawaan dipasang dulu agar pilihan akun anggaran dan jurnal berulang tidak kosong.
  await supabase.rpc("ensure_chart");
  const [ang, akun, dimensi, aturan, lrc, lrp, berulang, kurs, ekspor, milik, gabung] = await Promise.all([
    supabase.rpc("budget_report", { p_dari: dari, p_sampai: sampai, p_dimension: dim }),
    supabase.from("akun").select("kode, nama, golongan").eq("aktif", true).order("kode"),
    supabase.from("dimension").select("id, jenis, nama").eq("aktif", true).order("jenis").order("nama"),
    supabase.from("tag_rule").select("id, kata, dimension_id").eq("aktif", true).order("kata"),
    supabase.rpc("dimension_report", { p_jenis: "cabang", p_dari: dari, p_sampai: sampai }),
    supabase.rpc("dimension_report", { p_jenis: "proyek", p_dari: dari, p_sampai: sampai }),
    supabase.from("recurring_journal").select("id, nama, tiap, berikutnya, kali, aktif, galat").order("dibuat_at", { ascending: false }).limit(50),
    supabase.from("fx_rate").select("valuta, kurs, per, sumber, berlaku_dari, berlaku_sampai, perusahaan_id").order("berlaku_dari", { ascending: false }).limit(300),
    supabase.from("invoice_ekspor").select("id, nomor, pembeli, total_usd, nilai_buku, kurs_buku").eq("status", "terbit").order("tanggal").limit(50),
    supabase.rpc("owned_companies"),
    grup.length >= 2 ? supabase.rpc("consolidated_report", { p_perusahaan: grup, p_dari: dari, p_sampai: sampai }) : Promise.resolve({ data: null }),
  ]);
  const daftarAkun = (akun.data ?? []) as { kode: string; nama: string; golongan: string }[];
  const dims = (dimensi.data ?? []) as { id: string; jenis: "cabang" | "proyek"; nama: string }[];
  const kursHari = [...kursBerlaku(((kurs.data ?? []) as (Omit<Kurs, "resmi"> & { perusahaan_id: string | null })[]).map((k) => ({ ...k, kurs: Number(k.kurs), resmi: k.perusahaan_id === null })), hari).values()];
  const usd = kursHari.find((k) => k.valuta === "USD");
  const usaha = (milik.data ?? []) as { id: string; nama: string }[];
  const bolehTulis = sesi.peran === "pemilik" || sesi.peran === "akuntan";
  const L = ang.data as LaporanAnggaran | null;
  const K = gabung.data as Konsolidasi | null;
  const rentang = `dari=${dari}&sampai=${sampai}`;

  return (
    <div lang={bahasa}>
      <p className="text-sm print:hidden"><Link href={`/app/buku?${rentang}`} className="text-laut underline underline-offset-2">{t.kembali}</Link></p>
      <KepalaHalaman jalur="/app/buku/lanjut" judul={t.judul} ket={t.ket} />
      {!bolehTulis && <p className="mt-2 text-sm text-tinta-2">{t.bacaSaja}</p>}
      <form method="get" action="/app/buku/lanjut" className="mt-4 flex flex-wrap items-end gap-3 text-sm" aria-label={t.tampilkan}>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.dari}</span><input type="date" name="dari" defaultValue={dari} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2" /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.sampai}</span><input type="date" name="sampai" defaultValue={sampai} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2" /></label>
        {dims.length > 0 && (
          <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.filterDimensi}</span>
            <select name="dim" defaultValue={dim ?? ""} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2">
              <option value="">{t.semuaDimensi}</option>{dims.map((d) => <option key={d.id} value={d.id} data-pengguna>{t.jenisNama[d.jenis]}: {d.nama}</option>)}
            </select></label>
        )}
        {grup.length >= 2 && <input type="hidden" name="grup" value={grup.join(",")} />}
        <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-4 font-semibold hover:bg-kertas-2">{t.tampilkan}</button>
      </form>
      <p className="mt-2 text-sm text-tinta-2">{formatTanggalKalender(dari, bahasa)} - {formatTanggalKalender(sampai, bahasa)}</p>

      <section className="mt-8" aria-labelledby="judul-anggaran">
        <h2 id="judul-anggaran" className={judul}>{t.anggaranJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.anggaranKet}</p>
        {L && <Anggaran L={L} t={t} b={bahasa} />}
        {bolehTulis && <FormAnggaran akun={daftarAkun.filter((a) => a.golongan === "pendapatan" || a.golongan === "beban")} bulan={hari.slice(0, 7)} teks={t} />}
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-dimensi">
        <h2 id="judul-dimensi" className={judul}>{t.dimensiJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.dimensiKet}</p>
        {dims.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.belumDimensi}</p> : (
          <>
            {lrc.data && <LabaDimensi L={lrc.data as LaporanDimensi} t={t} b={bahasa} />}
            {dims.some((d) => d.jenis === "proyek") && lrp.data && <LabaDimensi L={lrp.data as LaporanDimensi} t={t} b={bahasa} />}
            {(aturan.data ?? []).length > 0 && (
              <ul className="mt-4 text-sm text-tinta-2" data-testid="daftar-aturan">
                {(aturan.data as { id: string; kata: string; dimension_id: string }[]).map((a) => <li key={a.id} data-pengguna>{isiTeks(t.aturanBaris, { kata: a.kata, nama: dims.find((d) => d.id === a.dimension_id)?.nama ?? "" })}</li>)}
              </ul>
            )}
          </>
        )}
        {bolehTulis && <FormDimensi teks={t} />}
        {bolehTulis && dims.length > 0 && <><h3 className="mt-6 font-semibold">{t.aturanJudul}</h3><FormAturan dimensi={dims} dari={dari} sampai={sampai} teks={t} /></>}
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-berulang">
        <h2 id="judul-berulang" className={judul}>{t.berulangJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.berulangKet}</p>
        {(berulang.data ?? []).length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.belumBerulang}</p> : (
          <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-berulang">
            {(berulang.data as { id: string; nama: string; tiap: "bulan" | "minggu"; berikutnya: string; kali: number; aktif: boolean; galat: string | null }[]).map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 py-3" data-nama={r.nama}>
                <div className="min-w-0">
                  <p className="font-semibold" data-pengguna>{r.nama}</p>
                  <p className="text-tinta-2">{t.tiapNama[r.tiap]}, {isiTeks(t.sudahKali, { n: r.kali })}{r.aktif ? `, ${isiTeks(t.berikutnya, { tanggal: formatTanggalKalender(r.berikutnya, bahasa) })}` : `, ${t.berhenti}`}</p>
                  {r.galat && <p className="text-cap" lang="id">{isiTeks(t.tertahan, { pesan: r.galat })}</p>}
                </div>
                {bolehTulis && <TombolAktif id={r.id} aktif={!r.aktif} label={`${r.aktif ? t.hentikan : t.aktifkan}: ${r.nama}`} teks={r.aktif ? t.hentikan : t.aktifkan} />}
              </li>
            ))}
          </ul>
        )}
        {bolehTulis && <><TombolJalankan teks={t} /><FormBerulang akun={daftarAkun} dimensi={dims} hari={hari} teks={t} /></>}
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-kurs">
        <h2 id="judul-kurs" className={judul}>{t.kursJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.kursKet}</p>
        <h3 className="mt-4 font-semibold">{t.kalkulator}</h3>
        <KalkulatorKurs kurs={kursHari} bahasa={bahasa} teks={t} />
        {bolehTulis && <><h3 className="mt-6 font-semibold">{t.kursUsaha}</h3><FormKurs hari={hari} teks={t} /></>}
        <h3 className="mt-6 font-semibold">{t.terbukaJudul}</h3>
        {(ekspor.data ?? []).length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.terbukaKosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis text-sm" data-testid="ekspor-terbuka">
            {(ekspor.data as { id: string; nomor: string; pembeli: string; total_usd: number; nilai_buku: number; kurs_buku: number }[]).map((e) => (
              <li key={e.id} className="py-3" data-nomor={e.nomor}>
                <p><span className="angka font-semibold">{e.nomor}</span> <span data-pengguna>{e.pembeli}</span>, <span className="angka">USD {Number(e.total_usd).toLocaleString(bahasa === "en" ? "en-US" : "id-ID", { minimumFractionDigits: 2 })}</span></p>
                <p className="text-tinta-2">{isiTeks(t.nilaiBuku, { rp: formatRupiah(e.nilai_buku, { bahasa }), kurs: Number(e.kurs_buku).toLocaleString(bahasa === "en" ? "en-US" : "id-ID") })}</p>
                <FormLunasEkspor id={e.id} nomor={e.nomor} hari={hari} kursUsd={usd ? String(usd.kurs) : ""} teks={t} />
              </li>
            ))}
          </ul>
        )}
        {bolehTulis && (ekspor.data ?? []).length > 0 && <><h3 className="mt-6 font-semibold">{t.revaluasiJudul}</h3><p className="mt-1 text-sm text-tinta-2">{t.revaluasiKet}</p><FormRevaluasi hari={hari} kursUsd={usd ? String(usd.kurs) : ""} teks={t} /></>}
      </section>

      <section className="mt-10 border-t border-garis pt-6" aria-labelledby="judul-konsol">
        <h2 id="judul-konsol" className={judul}>{t.konsolJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.konsolKet}</p>
        {usaha.length < 2 ? <p className="mt-3 text-sm text-tinta-2">{t.konsolSatu}</p> : (
          <>
            <form method="get" action="/app/buku/lanjut" className="mt-3 text-sm" aria-label={t.pilihUsaha} data-testid="form-konsolidasi">
              <input type="hidden" name="dari" value={dari} /><input type="hidden" name="sampai" value={sampai} />
              <fieldset><legend className="text-tinta-2">{t.pilihUsaha}</legend>
                <div className="mt-2 flex flex-col gap-2">
                  {usaha.map((u) => (
                    <label key={u.id} className="flex items-center gap-2"><input type="checkbox" name="g" value={u.id} defaultChecked={grup.includes(u.id)} className="h-5 w-5" /><span data-pengguna>{u.nama}</span></label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" className="mt-3 h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-4 font-semibold hover:bg-kertas-2">{t.gabungkan}</button>
            </form>
            {K && <Gabungan K={K} t={t} b={bahasa} />}
            {sesi.peran === "pemilik" && (
              <>
                <h3 className="mt-6 font-semibold">{t.antarJudul}</h3>
                <p className="mt-1 text-sm text-tinta-2">{t.antarKet}</p>
                <FormAntarusaha mitra={usaha.filter((u) => u.id !== sesi.perusahaanId)} hari={hari} kunci={randomUUID()} teks={t} />
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default function BukuLanjut(props: PageProps<"/app/buku/lanjut">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-64 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
