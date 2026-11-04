import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormAturan, FormBatal, FormCocok, FormImpor, FormPindah, FormRekening, FormUang, TombolNonaktif, TombolSemua, type Pilihan } from "@/components/app/kas";
import { Rupiah } from "@/components/ui/rupiah";
import { formatRupiah, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import type { InvoiceTerbuka } from "@/lib/invoice/cocok";
import { hariIni } from "@/lib/izin";
import { usulkanRekon, type AturanRekon, type JurnalKas, type TagihanTerbuka } from "@/lib/kas/rekon";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Kas dan bank" };

type Rek = { id: string; nama: string; jenis: "kas" | "bank" | "dompet"; akun: string; nomor_akhir: string | null; saldo: number; belum: number };
type Mut = { id: string; tanggal: string; keterangan: string; jumlah: number; arah: "CR" | "DB"; status: string; cocok_jenis: string | null; cocok_id: string | null; alasan: string | null };
const geser = (hari: string, n: number) => new Date(Date.parse(`${hari}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

async function Isi({ searchParams }: { searchParams: PageProps<"/app/kas">["searchParams"] }) {
  const [sesi, sp] = await Promise.all([wajibPerusahaan(), searchParams]);
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).kas;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}><h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1><p className="mt-2 text-tinta-2">{t.hanya}</p></div>;
  }
  const ubah = sesi.peran !== "akuntan";
  const supabase = await createClient();
  const [rekRes, zona] = await Promise.all([supabase.rpc("daftar_rekening"), zonaUsahaIni(sesi.perusahaanId)]);
  const rekening = (rekRes.data ?? []) as Rek[];
  const hari = hariIni(new Date(), zona);
  const pilihRek = rekening.find((r) => r.id === sp.rek) ?? rekening.find((r) => r.jenis === "bank") ?? rekening[0];
  const kodeRek = new Set(rekening.map((r) => r.akun));

  const [mutRes, cocokRes, invRes, tagRes, aturanRes, akunRes] = pilihRek ? await Promise.all([
    supabase.from("mutasi_bank").select("id, tanggal, keterangan, jumlah, arah, status, cocok_jenis, cocok_id, alasan").eq("rekening_id", pilihRek.id).eq("status", "belum")
      .order("tanggal").limit(200),
    supabase.from("mutasi_bank").select("id, tanggal, keterangan, jumlah, arah, status, cocok_jenis, cocok_id, alasan").eq("rekening_id", pilihRek.id).neq("status", "belum")
      .order("diputuskan_at", { ascending: false }).limit(20),
    supabase.from("invoice").select("id, nomor, pelanggan, total, potong_piutang, tanggal, jatuh_tempo").eq("status", "terbit").limit(500),
    supabase.from("tagihan_beli").select("id, pemasok, nomor_pemasok, total, terbayar, dikurangi, tanggal, jatuh_tempo").eq("status", "terbuka").limit(500),
    supabase.from("aturan_rekon").select("id, kata, arah, akun_kode").eq("aktif", true).order("dibuat_at"),
    supabase.from("akun").select("kode, nama").eq("aktif", true).order("kode"),
  ]) : [];
  const belum = (mutRes?.data ?? []) as Mut[];
  const tanggalMut = belum.map((m) => m.tanggal).sort();
  const jurnalRes = pilihRek && belum.length
    ? await supabase.rpc("jurnal_kas_terbuka", { p_rekening: pilihRek.id, p_dari: geser(tanggalMut[0], -7), p_sampai: geser(tanggalMut[tanggalMut.length - 1], 7) })
    : { data: [] };
  const invoice: InvoiceTerbuka[] = ((invRes?.data ?? []) as (InvoiceTerbuka & { potong_piutang: number })[]).map((v) => ({ ...v, total: v.total - v.potong_piutang }));
  const tagihan: TagihanTerbuka[] = ((tagRes?.data ?? []) as { id: string; pemasok: string; nomor_pemasok: string | null; total: number; terbayar: number; dikurangi: number; tanggal: string; jatuh_tempo: string }[])
    .map((x) => ({ id: x.id, pemasok: x.pemasok, nomor_pemasok: x.nomor_pemasok, sisa: x.total - x.terbayar - x.dikurangi, tanggal: x.tanggal, jatuh_tempo: x.jatuh_tempo }));
  const jurnal = (jurnalRes.data ?? []) as JurnalKas[];
  const aturan = (aturanRes?.data ?? []) as AturanRekon[];
  const akun = ((akunRes?.data ?? []) as { kode: string; nama: string }[]).filter((a) => !kodeRek.has(a.kode));
  const usulan = usulkanRekon(belum, { invoice, tagihan, jurnal, aturan });

  const rp = (n: number) => formatRupiah(n, { bahasa });
  const labelTarget = (jenis: string, target: string): string => {
    if (jenis === "invoice") { const v = invoice.find((x) => x.id === target); return v ? isiTeks(t.labelInvoice, { nomor: v.nomor, nama: v.pelanggan, jumlah: rp(v.total) }) : target; }
    if (jenis === "tagihan_beli") { const x = tagihan.find((y) => y.id === target); return x ? isiTeks(t.labelTagihan, { nama: x.pemasok, nomor: x.nomor_pemasok ?? "", jumlah: rp(x.sisa) }) : target; }
    if (jenis === "jurnal") { const j = jurnal.find((y) => y.id === target); return j ? isiTeks(t.labelJurnal, { ket: j.keterangan, tanggal: formatTanggalKalender(j.tanggal, bahasa) }) : target; }
    if (jenis === "akun") { const a = akun.find((y) => y.kode === target); return isiTeks(t.labelAkun, { akun: a ? `${a.kode} ${a.nama}` : target }); }
    return t.abaikan;
  };
  const semua = usulan.filter((u) => u.usulan).map((u) => `${belum[u.indeks].id}|${u.usulan!.jenis}|${u.usulan!.target}|${t.alasan[u.usulan!.alasan]}`);

  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>

      <section className="mt-6" aria-labelledby="judul-rek">
        <h2 id="judul-rek" className="text-lg font-semibold">{t.rekeningJudul}</h2>
        <ul className="mt-2 divide-y divide-garis border-y border-garis">
          {rekening.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm" data-testid="baris-rekening" data-nama={r.nama}>
              <p><a href={`/app/kas?rek=${r.id}`} className={`underline-offset-4 ${r.id === pilihRek?.id ? "font-semibold" : "underline"}`} aria-current={r.id === pilihRek?.id ? "true" : undefined}
                data-pengguna>{r.nama}</a> <span className="text-tinta-2">{t.jenisNama[r.jenis]}{r.nomor_akhir ? ` ··${r.nomor_akhir}` : ""} · {r.akun}</span>
                {r.belum > 0 ? <span className="ml-2 rounded-full bg-kunyit px-2 py-0.5 text-tinta">{isiTeks(t.belumCocok, { n: r.belum })}</span> : null}</p>
              <p className="font-semibold"><Rupiah nilai={r.saldo} bahasa={bahasa} /></p>
            </li>
          ))}
        </ul>
        {ubah && <FormRekening teks={t} />}
      </section>

      {ubah && rekening.length > 0 && (
        <section className="mt-8" aria-labelledby="judul-catat">
          <h2 id="judul-catat" className="text-lg font-semibold">{t.catatJudul}</h2>
          <FormUang rekening={rekening} akun={akun} hari={hari} kunci={randomUUID()} teks={t} />
          {rekening.length > 1 && <FormPindah rekening={rekening} hari={hari} kunci={randomUUID()} teks={t} />}
        </section>
      )}

      {pilihRek && (
        <section className="mt-8" aria-labelledby="judul-rekon">
          <h2 id="judul-rekon" className="text-lg font-semibold">{isiTeks(t.rekonJudul, { nama: pilihRek.nama })}</h2>
          <p className="mt-1 text-sm text-tinta-2">{t.rekonKet}</p>
          {ubah && <FormImpor rekening={pilihRek.id} teks={t} />}
          {belum.length === 0 ? <p className="mt-3 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2">{t.mutasiKosong}</p> : (
            <>
              {ubah && <TombolSemua butir={semua} teks={t} label={isiTeks(t.cocokkanSemua, { n: semua.length })} />}
              <ul className="mt-3 divide-y divide-garis border-y border-garis">
                {belum.map((m, i) => {
                  const u = usulan[i];
                  const pilihan: Pilihan[] = [
                    ...(u.usulan ? [{ nilai: `${u.usulan.jenis}|${u.usulan.target}`, label: labelTarget(u.usulan.jenis, u.usulan.target) }] : []),
                    ...u.kandidat.filter((c) => !(u.usulan && c.jenis === u.usulan.jenis && c.target === u.usulan.target)).map((c) => ({ nilai: `${c.jenis}|${c.target}`, label: labelTarget(c.jenis, c.target) })),
                    ...akun.map((a) => ({ nilai: `akun|${a.kode}`, label: labelTarget("akun", a.kode) })),
                    { nilai: "abaikan|", label: t.abaikan },
                  ].filter((p, j, s) => s.findIndex((q) => q.nilai === p.nilai) === j);
                  return (
                    <li key={m.id} className="grid gap-2 py-3 text-sm" data-testid="baris-mutasi" data-keterangan={m.keterangan}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p><span className="text-tinta-2">{formatTanggalKalender(m.tanggal, bahasa)}</span> · <span className="font-mono" data-pengguna>{m.keterangan || "-"}</span></p>
                        <p className={`font-semibold ${m.arah === "CR" ? "text-daun" : ""}`}>{m.arah === "CR" ? t.masukSingkat : t.keluarSingkat} <Rupiah nilai={m.jumlah} bahasa={bahasa} /></p>
                      </div>
                      <p className="text-tinta-2">{u.usulan ? isiTeks(t.usulanNadi, { pasangan: labelTarget(u.usulan.jenis, u.usulan.target), alasan: t.alasan[u.usulan.alasan] })
                        : u.kandidat.length > 1 ? isiTeks(t.ragu, { n: u.kandidat.length }) : t.tanpaUsulan}</p>
                      {ubah && <FormCocok mutasi={m.id} pilihan={pilihan} bawaan={u.usulan ? `${u.usulan.jenis}|${u.usulan.target}` : ""} teks={t} />}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {(cocokRes?.data ?? []).length > 0 && (
            <>
              <h3 className="mt-6 font-semibold">{t.sudahJudul}</h3>
              <ul className="mt-2 divide-y divide-garis border-y border-garis">
                {((cocokRes?.data ?? []) as Mut[]).map((m) => (
                  <li key={m.id} className="grid gap-1 py-2 text-sm" data-testid="baris-mutasi-cocok" data-keterangan={m.keterangan}>
                    <p><span className="text-tinta-2">{formatTanggalKalender(m.tanggal, bahasa)}</span> · <span className="font-mono" data-pengguna>{m.keterangan || "-"}</span> · <Rupiah nilai={m.jumlah} bahasa={bahasa} /></p>
                    <p className="text-tinta-2">{m.status === "abaikan" ? t.diabaikan : t.cocokJenis[m.cocok_jenis as keyof typeof t.cocokJenis] ?? m.cocok_jenis}{m.alasan && m.alasan !== "diabaikan" ? <> · <span lang="id">{m.alasan}</span></> : null}</p>
                    {ubah && (m.status === "abaikan" || m.cocok_jenis === "akun" || m.cocok_jenis === "jurnal") && <FormBatal mutasi={m.id} teks={t} />}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="mt-8" aria-labelledby="judul-aturan">
        <h2 id="judul-aturan" className="text-lg font-semibold">{t.aturanJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.aturanKet}</p>
        {aturan.length > 0 && (
          <ul className="mt-2 divide-y divide-garis border-y border-garis">
            {aturan.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="baris-aturan" data-kata={a.kata}>
                <p><span className="font-mono" data-pengguna>{a.kata}</span> · {a.arah === "CR" ? t.masuk : a.arah === "DB" ? t.keluar : t.keduanya} · {labelTarget("akun", a.akun_kode)}</p>
                {ubah && <TombolNonaktif aturan={a.id} kata={a.kata} arah={a.arah} akun={a.akun_kode} teks={t} />}
              </li>
            ))}
          </ul>
        )}
        {ubah && <FormAturan akun={akun} teks={t} />}
      </section>
    </div>
  );
}

export default function Kas(props: PageProps<"/app/kas">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
