import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { FormSaldoAwal, FormTutupBuku, TombolCetak } from "@/components/app/buku";
import { Rupiah } from "@/components/ui/rupiah";
import { bacaJenis, bacaRentang, JENIS_LAPORAN, type BukuBesar, type Laporan, type UmurPiutang } from "@/lib/buku/laporan";
import { formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Laporan keuangan" };

type Teks = ReturnType<typeof ambilKamus>["buku"];
const sel = "py-2 pr-3 align-top";
const angka = "py-2 text-right align-top";

function Tabel({ kepala, children, label }: { kepala: string[]; children: ReactNode; label: string }) {
  return (
    // Tabel lebar bisa digeser di HP; wadah geser bisa difokus papan ketik (axe scrollable-region-focusable).
    <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
      <table className="w-full border-y border-garis text-sm">
        <thead><tr className="border-b border-garis text-left text-tinta-2">{kepala.map((k, i) => <th key={k} scope="col" className={`py-2 font-medium ${i >= kepala.length - 1 || /^(Debit|Kredit|Credit|Awal|Akhir|Opening|Closing|Saldo|Balance|Nilai|Amount|Hari|Days)/.test(k) ? "text-right" : "pr-3"}`}>{k}</th>)}</tr></thead>
        <tbody className="divide-y divide-garis">{children}</tbody>
      </table>
    </div>
  );
}

function Neraca({ L, t, b }: { L: Laporan; t: Teks; b: Bahasa }) {
  const n = L.neraca;
  const per = (g: string) => n.baris.filter((x) => x.golongan === g);
  const blok = (g: "aset" | "kewajiban" | "modal", tambahan?: ReactNode) => (
    <section aria-labelledby={`nr-${g}`} className="mt-5">
      <h3 id={`nr-${g}`} className="font-semibold">{t.golonganNama[g]}</h3>
      <Tabel kepala={[t.kode, t.akun, t.saldo]} label={t.golonganNama[g]}>
        {per(g).map((x) => <tr key={x.kode}><td className={`${sel} angka whitespace-nowrap text-tinta-2`}>{x.kode}</td><td className={sel} data-pengguna>{x.nama}</td><td className={angka}><Rupiah nilai={x.saldo} bahasa={b} /></td></tr>)}
        {tambahan}
      </Tabel>
    </section>
  );
  return (
    <div data-testid="lap-neraca">
      {blok("aset")}
      <p className="mt-2 flex justify-between border-b-2 border-tinta py-2 font-semibold"><span>{t.totalAset}</span><Rupiah nilai={n.aset} bahasa={b} /></p>
      {blok("kewajiban")}
      {blok("modal", <tr><td className={sel} /><td className={sel}>{t.labaBelumDitutup}</td><td className={angka}><Rupiah nilai={n.laba_belum_ditutup} bahasa={b} /></td></tr>)}
      <p className="mt-2 flex justify-between border-b-2 border-tinta py-2 font-semibold"><span>{t.totalKewajibanModal}</span><Rupiah nilai={n.kewajiban + n.modal + n.laba_belum_ditutup} bahasa={b} /></p>
      <p className={`mt-3 text-sm ${n.seimbang ? "text-daun" : "text-cap"}`} data-testid="neraca-seimbang" data-seimbang={n.seimbang ? "ya" : "tidak"}>{n.seimbang ? t.seimbang : t.tidakSeimbang}</p>
    </div>
  );
}

function LabaRugi({ L, t, b }: { L: Laporan; t: Teks; b: Bahasa }) {
  const r = L.laba_rugi;
  const blok = (g: "pendapatan" | "beban", jumlah: number) => (
    <section className="mt-5" aria-labelledby={`lr-${g}`}>
      <h3 id={`lr-${g}`} className="font-semibold">{t.golonganNama[g]}</h3>
      <Tabel kepala={[t.kode, t.akun, t.nilai]} label={t.golonganNama[g]}>
        {r.baris.filter((x) => x.golongan === g).map((x) => <tr key={x.kode}><td className={`${sel} angka whitespace-nowrap text-tinta-2`}>{x.kode}</td><td className={sel} data-pengguna>{x.nama}</td><td className={angka}><Rupiah nilai={x.nilai} bahasa={b} /></td></tr>)}
      </Tabel>
      <p className="mt-1 flex justify-between py-1 text-sm font-semibold"><span>{g === "pendapatan" ? t.pendapatan : t.beban}</span><Rupiah nilai={jumlah} bahasa={b} /></p>
    </section>
  );
  return (
    <div data-testid="lap-laba-rugi">
      {blok("pendapatan", r.pendapatan)}
      {blok("beban", r.beban)}
      <p className="mt-3 flex justify-between border-y-2 border-tinta py-2 text-lg font-semibold" data-testid="laba-bersih"><span>{r.laba >= 0 ? t.laba : t.rugi}</span><Rupiah nilai={r.laba} bahasa={b} /></p>
    </div>
  );
}

function ArusKas({ L, t, b }: { L: Laporan; t: Teks; b: Bahasa }) {
  const a = L.arus_kas;
  const baris: [string, number, boolean?][] = [[t.kasAwal, a.kas_awal], [t.operasi, a.operasi], [t.investasi, a.investasi], [t.pendanaan, a.pendanaan], [t.kasAkhir, a.kas_akhir, true]];
  return (
    <div data-testid="lap-arus-kas">
      <dl className="mt-4 divide-y divide-garis border-y border-garis text-sm">
        {baris.map(([k, v, tebal]) => <div key={k} className={`flex justify-between py-2 ${tebal ? "font-semibold" : ""}`}><dt>{k}</dt><dd><Rupiah nilai={v} bahasa={b} /></dd></div>)}
      </dl>
      <p className={`mt-3 text-sm ${a.cocok ? "text-daun" : "text-cap"}`} data-testid="arus-cocok">{a.cocok ? t.cocok : t.tidakCocok}</p>
    </div>
  );
}

function NeracaSaldo({ L, t, b }: { L: Laporan; t: Teks; b: Bahasa }) {
  const jd = L.neraca_saldo.reduce((s, x) => s + x.debit, 0);
  const jk = L.neraca_saldo.reduce((s, x) => s + x.kredit, 0);
  return (
    <div data-testid="lap-neraca-saldo">
      <Tabel kepala={[t.kode, t.akun, t.awal, t.debit, t.kredit, t.akhir]} label={t.tab.neraca_saldo}>
        {L.neraca_saldo.map((x) => (
          <tr key={x.kode}><td className={`${sel} angka whitespace-nowrap text-tinta-2`}>{x.kode}</td><td className={sel} data-pengguna>{x.nama}</td>
            <td className={angka}><Rupiah nilai={x.awal} bahasa={b} /></td><td className={angka}><Rupiah nilai={x.debit} bahasa={b} /></td>
            <td className={angka}><Rupiah nilai={x.kredit} bahasa={b} /></td><td className={angka}><Rupiah nilai={x.akhir} bahasa={b} /></td></tr>
        ))}
        <tr className="font-semibold"><td className={sel} /><td className={sel} /><td className={angka} /><td className={angka}><Rupiah nilai={jd} bahasa={b} /></td><td className={angka}><Rupiah nilai={jk} bahasa={b} /></td><td className={angka} /></tr>
      </Tabel>
    </div>
  );
}

async function Isi({ searchParams }: { searchParams: PageProps<"/app/buku">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).buku;
  const sp = await searchParams;
  const zona = await zonaUsahaIni(sesi.perusahaanId);
  const hari = hariIni(new Date(), zona);
  const { dari, sampai } = bacaRentang(sp.dari, sp.sampai, hari);
  const jenis = bacaJenis(sp.jenis);
  const kodeAkun = typeof sp.akun === "string" ? sp.akun.slice(0, 20) : "";
  const supabase = await createClient();
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}><KepalaHalaman jalur="/app/buku" judul={t.judul} ket={ambilKamus(bahasa).buku.hanyaPemilikAkuntan} /></div>;
  }
  const [lap, akun, saldoAwal, buku, umur] = await Promise.all([
    supabase.rpc("laporan_keuangan", { p_dari: dari, p_sampai: sampai }),
    supabase.from("akun").select("kode, nama, golongan, saldo_normal").eq("aktif", true).order("kode"),
    supabase.from("jurnal").select("id").eq("sumber", "saldo_awal").is("dibalik_oleh", null).limit(1),
    jenis === "buku_besar" && kodeAkun ? supabase.rpc("buku_besar", { p_kode: kodeAkun, p_dari: dari, p_sampai: sampai }) : Promise.resolve({ data: null }),
    jenis === "umur_piutang" ? supabase.rpc("umur_piutang", { p_per: sampai }) : Promise.resolve({ data: null }),
  ]);
  const L = lap.data as Laporan | null;
  const daftarAkun = (akun.data ?? []) as { kode: string; nama: string; golongan: string; saldo_normal: string }[];
  const B = buku.data as BukuBesar | null;
  const U = umur.data as UmurPiutang | null;
  const bolehTulis = sesi.peran === "pemilik" || sesi.peran === "akuntan";
  const q = (j: string) => `/app/buku?jenis=${j}&dari=${dari}&sampai=${sampai}`;
  const kosong = !L || L.neraca_saldo.length === 0;
  const tahunLalu = Number(hari.slice(0, 4)) - 1;

  return (
    <div lang={bahasa}>
      <KepalaHalaman jalur="/app/buku" judul={t.judul} ket={t.ket} />
      <nav aria-label={t.judul} className="mt-5 flex flex-wrap gap-2 print:hidden">
        {JENIS_LAPORAN.map((j) => (
          <Link key={j} href={q(j)} aria-current={j === jenis ? "page" : undefined}
            className={`rounded-[var(--radius-isian)] border px-3 py-2 text-sm ${j === jenis ? "border-tinta bg-tinta font-semibold text-kertas" : "border-garis-kuat"}`}>{t.tab[j]}</Link>
        ))}
      </nav>
      <form method="get" action="/app/buku" className="mt-4 flex flex-wrap items-end gap-3 text-sm print:hidden" aria-label={t.tampilkan}>
        <input type="hidden" name="jenis" value={jenis} />
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.dari}</span><input type="date" name="dari" defaultValue={dari} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2" /></label>
        <label className="flex flex-col gap-1"><span className="text-tinta-2">{jenis === "neraca" || jenis === "umur_piutang" ? t.per : t.sampai}</span><input type="date" name="sampai" defaultValue={sampai} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2" /></label>
        {jenis === "buku_besar" && (
          <label className="flex flex-col gap-1"><span className="text-tinta-2">{t.akun}</span>
            <select name="akun" defaultValue={kodeAkun} className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2" required>
              <option value="">{t.pilihAkun}</option>
              {daftarAkun.map((a) => <option key={a.kode} value={a.kode} data-pengguna>{a.kode} {a.nama}</option>)}
            </select></label>
        )}
        <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-4 font-semibold hover:bg-kertas-2">{t.tampilkan}</button>
      </form>
      <p className="mt-3 text-sm text-tinta-2">{formatTanggalKalender(dari, bahasa)} - {formatTanggalKalender(sampai, bahasa)}</p>

      <section className="mt-2" aria-label={t.tab[jenis]} data-testid="laporan" data-jenis={jenis}>
        {jenis === "umur_piutang" ? (U && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              {(["belum", "h1_30", "h31_60", "h61_90", "lebih_90", "total"] as const).map((k) => (
                <div key={k} className="rounded-[var(--radius-kartu)] bg-kertas-2 p-3"><dt className="text-tinta-2">{t.kel[k]}</dt><dd className="mt-1 font-semibold"><Rupiah nilai={U.kelompok[k]} bahasa={bahasa} /></dd></div>
              ))}
            </dl>
            <Tabel kepala={[t.nomor, t.pelanggan, t.jatuhTempo, t.hari, t.nilai]} label={t.tab.umur_piutang}>
              {U.baris.map((x) => <tr key={x.nomor}><td className={`${sel} angka`}>{x.nomor}</td><td className={sel} data-pengguna>{x.pelanggan}</td><td className={sel}>{formatTanggalKalender(x.jatuh_tempo, bahasa)}</td><td className={angka}>{Math.max(0, x.hari)}</td><td className={angka}><Rupiah nilai={x.total} bahasa={bahasa} /></td></tr>)}
            </Tabel>
          </>
        )) : kosong ? (
          <p className="mt-4 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2" data-testid="laporan-kosong">{t.kosong}</p>
        ) : jenis === "neraca" ? <Neraca L={L!} t={t} b={bahasa} />
          : jenis === "laba_rugi" ? <LabaRugi L={L!} t={t} b={bahasa} />
          : jenis === "arus_kas" ? <ArusKas L={L!} t={t} b={bahasa} />
          : jenis === "neraca_saldo" ? <NeracaSaldo L={L!} t={t} b={bahasa} />
          : B ? (
            <div data-testid="lap-buku-besar">
              <p className="mt-4 font-semibold"><span className="angka">{B.kode}</span> <span data-pengguna>{B.nama}</span></p>
              <Tabel kepala={[t.tanggal, t.keterangan, t.debit, t.kredit, t.saldo]} label={t.tab.buku_besar}>
                <tr><td className={sel} /><td className={sel}>{t.saldoAwal}</td><td className={angka} /><td className={angka} /><td className={angka}><Rupiah nilai={B.awal} bahasa={bahasa} /></td></tr>
                {B.baris.map((x, i) => <tr key={i}><td className={`${sel} whitespace-nowrap`}>{formatTanggalKalender(x.tanggal, bahasa)}</td><td className={sel} lang={bahasa === "id" ? undefined : "id"}>{x.keterangan}</td><td className={angka}>{x.debit ? <Rupiah nilai={x.debit} bahasa={bahasa} /> : null}</td><td className={angka}>{x.kredit ? <Rupiah nilai={x.kredit} bahasa={bahasa} /> : null}</td><td className={angka}><Rupiah nilai={x.saldo} bahasa={bahasa} /></td></tr>)}
              </Tabel>
            </div>
          ) : <p className="mt-4 text-tinta-2">{t.pilihAkun}</p>}
      </section>

      <div className="mt-5 flex flex-wrap gap-3 print:hidden">
        {!(jenis === "buku_besar" && !kodeAkun) && (
          <a href={`/app/buku/ekspor?jenis=${jenis}&dari=${dari}&sampai=${sampai}${kodeAkun ? `&akun=${encodeURIComponent(kodeAkun)}` : ""}`} download
            className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-4 text-sm font-semibold hover:bg-kertas-2" data-testid="unduh-csv">{t.unduhCsv}</a>
        )}
        <TombolCetak label={t.cetak} />
        <Link href={`/app/buku/lanjut?dari=${dari}&sampai=${sampai}`} className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-4 text-sm font-semibold hover:bg-kertas-2" data-testid="tautan-lanjut">{ambilKamus(bahasa).bukuLanjut.tautan}</Link>
        <Link href="/app/buku/pembiayaan" className="inline-flex h-10 items-center rounded-[var(--radius-isian)] border border-garis-kuat px-4 text-sm font-semibold hover:bg-kertas-2" data-testid="tautan-pembiayaan">{ambilKamus(bahasa).pembiayaan.tautan}</Link>
      </div>

      {bolehTulis && (
        <div className="mt-10 grid gap-8 print:hidden">
          <section aria-labelledby="judul-saldo-awal">
            <h2 id="judul-saldo-awal" className="text-lg font-semibold">{t.saldoAwalJudul}</h2>
            {(saldoAwal.data ?? []).length > 0 ? <p className="mt-1 text-sm text-tinta-2" data-testid="saldo-awal-sudah">{t.saldoAwalSudah}</p> : (
              <>
                <p className="mt-1 text-sm text-tinta-2">{t.saldoAwalKet}</p>
                <FormSaldoAwal akun={daftarAkun.filter((a) => ["aset", "kewajiban", "modal"].includes(a.golongan) && a.kode !== "3-900")} hariIni={hari} teks={t} />
              </>
            )}
          </section>
          <section aria-labelledby="judul-tutup">
            <h2 id="judul-tutup" className="text-lg font-semibold">{t.tutupJudul}</h2>
            <p className="mt-1 text-sm text-tinta-2">{t.tutupKet}</p>
            <FormTutupBuku tahun={tahunLalu} teks={t} />
          </section>
        </div>
      )}
    </div>
  );
}

export default function Buku(props: PageProps<"/app/buku">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

