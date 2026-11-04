import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormGudang, FormLokasi, FormMasuk, FormOpname, FormPindah, FormProduk } from "@/components/app/barang";
import { Rupiah } from "@/components/ui/rupiah";
import { formatAngka, formatTanggalKalender } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { hariIni } from "@/lib/izin";
import { wajibPerusahaan } from "@/lib/sesi";
import { teksAtribut, type Tingkat } from "@/lib/stok/harga";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

export const metadata: Metadata = { title: "Barang dan stok" };

type Produk = { id: string; kode: string; nama: string; jenis: string; satuan: string; harga_jual: number; barcode: string | null; aktif: boolean;
  induk_id: string | null; atribut: Record<string, string> | null; harga_tingkat: Tingkat[] | null };
type Stok = { produk_id: string; gudang_id: string; jumlah: number; nilai: number; lokasi: string | null };
type Gerak = { id: string; tanggal: string; jenis: string; jumlah: number; nilai: number; saldo_jumlah: number; saldo_nilai: number; keterangan: string | null; gudang_id: string };

async function Isi({ searchParams }: { searchParams: PageProps<"/app/barang">["searchParams"] }) {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).barang;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) {
    return <div lang={bahasa}><h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1><p className="mt-2 text-tinta-2">{t.hanyaPengelola}</p></div>;
  }
  const sp = await searchParams;
  const pilih = typeof sp.produk === "string" && /^[0-9a-f-]{36}$/.test(sp.produk) ? sp.produk : null;
  const supabase = await createClient();
  const [produk, gudang, stok, zona, gerak] = await Promise.all([
    supabase.from("produk").select("id, kode, nama, jenis, satuan, harga_jual, barcode, aktif, induk_id, atribut, harga_tingkat").order("nama").limit(1000),
    supabase.from("gudang").select("id, kode, nama, utama").eq("aktif", true).order("utama", { ascending: false }).order("nama"),
    supabase.from("stok").select("produk_id, gudang_id, jumlah, nilai, lokasi").limit(5000),
    zonaUsahaIni(sesi.perusahaanId),
    pilih ? supabase.from("gerak_stok").select("id, tanggal, jenis, jumlah, nilai, saldo_jumlah, saldo_nilai, keterangan, gudang_id").eq("produk_id", pilih)
      .order("dibuat_at", { ascending: false }).limit(100) : Promise.resolve({ data: null }),
  ]);
  const laporan = ((await supabase.rpc("laporan_stok")).data ?? []) as { gudang_id: string; gudang: string; nilai: number; produk: { produk_id: string; kode: string; nama: string; jumlah: number; nilai: number; lokasi: string | null }[] }[];
  const daftar = (produk.data ?? []) as Produk[];
  const gudangDaftar = (gudang.data ?? []) as { id: string; kode: string; nama: string; utama: boolean }[];
  const stokDaftar = (stok.data ?? []) as Stok[];
  const hari = hariIni(new Date(), zona);
  const kelola = sesi.peran === "pemilik" || sesi.peran === "admin";
  const barang = daftar.filter((p) => p.jenis === "barang" && p.aktif).map((p) => ({ id: p.id, nama: `${p.kode} ${p.nama}` }));
  const namaGudang = new Map(gudangDaftar.map((g) => [g.id, g.nama]));
  const perProduk = (id: string) => stokDaftar.filter((s) => s.produk_id === id);
  const totalNilai = stokDaftar.reduce((s, x) => s + Number(x.nilai), 0);
  const p = pilih ? daftar.find((x) => x.id === pilih) : null;
  const angka = (n: number) => formatAngka(Number(n), bahasa);

  return (
    <div lang={bahasa}>
      <h1 className="font-judul text-3xl font-extrabold tracking-tight">{t.judul}</h1>
      <p className="mt-1 text-sm text-tinta-2">{t.ket}</p>
      <p className="mt-3 text-sm" data-testid="nilai-persediaan">{t.nilaiPersediaan} <span className="font-semibold"><Rupiah nilai={totalNilai} bahasa={bahasa} /></span></p>

      <section className="mt-6" aria-labelledby="judul-produk">
        <h2 id="judul-produk" className="text-lg font-semibold">{t.daftarProduk}</h2>
        {daftar.length === 0 ? <p className="mt-2 rounded-[var(--radius-kartu)] bg-kertas-2 p-4 text-tinta-2" data-testid="produk-kosong">{t.kosong}</p> : (
          <ul className="mt-2 divide-y divide-garis border-y border-garis" data-testid="daftar-produk">
            {daftar.map((x) => {
              const s = perProduk(x.id);
              const jumlah = s.reduce((a, b) => a + Number(b.jumlah), 0);
              return (
                <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm" data-testid="baris-produk" data-kode={x.kode}>
                  <div className="min-w-0">
                    <Link href={`/app/barang?produk=${x.id}`} className="font-semibold underline-offset-4 hover:underline"><span data-pengguna>{x.nama}</span></Link>
                    <p className="text-tinta-2"><span className="font-mono">{x.kode}</span> · {t.jenisNama[x.jenis as keyof typeof t.jenisNama] ?? x.jenis} · <Rupiah nilai={x.harga_jual} bahasa={bahasa} /></p>
                    {x.induk_id && <p className="text-tinta-2" data-testid="varian">{isiTeks(t.varianDari, { nama: daftar.find((y) => y.id === x.induk_id)?.nama ?? "" })}: <span data-pengguna>{teksAtribut(x.atribut)}</span></p>}
                    {(x.harga_tingkat ?? []).length > 0 && <p className="text-tinta-2" data-testid="grosir">{t.grosir} {(x.harga_tingkat ?? []).map((g, i) => <span key={g.min}>{i > 0 ? ", " : ""}{isiTeks(t.grosirMulai, { min: angka(g.min) })} <Rupiah nilai={g.harga} bahasa={bahasa} /></span>)}</p>}
                    {x.jenis === "barang" && s.length > 1 && <p className="text-xs text-tinta-2">{s.map((g) => `${namaGudang.get(g.gudang_id) ?? ""} ${angka(g.jumlah)}`).join(", ")}</p>}
                  </div>
                  {x.jenis === "barang" ? <p className={`angka font-semibold ${jumlah <= 0 ? "text-cap" : ""}`} data-testid="stok-produk">{angka(jumlah)} <span className="font-normal text-tinta-2" data-pengguna>{x.satuan}</span></p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {p && (
        <section className="mt-8" aria-labelledby="judul-kartu" data-testid="kartu-stok">
          <h2 id="judul-kartu" className="text-lg font-semibold">{t.kartuStok}: <span data-pengguna>{p.nama}</span></h2>
          {kelola && p.jenis === "barang" && gudangDaftar.length > 0 && (
            <div className="mt-3 grid gap-3">
              {gudangDaftar.map((g) => <FormLokasi key={g.id} produk={p.id} gudang={g.id} namaGudang={g.nama} lokasi={stokDaftar.find((s) => s.produk_id === p.id && s.gudang_id === g.id)?.lokasi ?? ""} teks={t} />)}
            </div>
          )}
          <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={t.kartuStok}>
            <table className="w-full border-y border-garis text-sm">
              <thead><tr className="border-b border-garis text-left text-tinta-2"><th scope="col" className="py-2 pr-3 font-medium">{t.tanggal}</th><th scope="col" className="py-2 pr-3 font-medium">{t.keterangan}</th>
                <th scope="col" className="py-2 text-right font-medium">{t.jumlah}</th><th scope="col" className="py-2 text-right font-medium">{t.saldo}</th><th scope="col" className="py-2 text-right font-medium">{t.nilai}</th></tr></thead>
              <tbody className="divide-y divide-garis">
                {((gerak.data ?? []) as Gerak[]).map((g) => (
                  <tr key={g.id}><td className="whitespace-nowrap py-2 pr-3">{formatTanggalKalender(g.tanggal, bahasa)}</td>
                    <td className="py-2 pr-3">{t.gerakNama[g.jenis as keyof typeof t.gerakNama] ?? g.jenis} <span className="text-tinta-2" lang={bahasa === "id" ? undefined : "id"}>{g.keterangan ?? ""}</span> <span className="text-xs text-tinta-2" data-pengguna>{namaGudang.get(g.gudang_id)}</span></td>
                    <td className={`angka py-2 text-right ${g.jumlah < 0 ? "text-cap" : ""}`}>{g.jumlah > 0 ? "+" : ""}{angka(g.jumlah)}</td>
                    <td className="angka py-2 text-right">{angka(g.saldo_jumlah)}</td><td className="py-2 text-right"><Rupiah nilai={g.saldo_nilai} bahasa={bahasa} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {laporan.some((g) => g.produk.length > 0) && (
        <section className="mt-8" aria-labelledby="judul-laporan">
          <h2 id="judul-laporan" className="text-lg font-semibold">{t.laporanJudul}</h2>
          {laporan.filter((g) => g.produk.length > 0).map((g) => (
            <div key={g.gudang_id} className="mt-3" data-testid="laporan-gudang" data-gudang={g.gudang}>
              <p className="flex flex-wrap justify-between gap-2 text-sm font-semibold"><span data-pengguna>{g.gudang}</span><Rupiah nilai={g.nilai} bahasa={bahasa} /></p>
              <div className="mt-1 overflow-x-auto" tabIndex={0} role="region" aria-label={`${t.laporanJudul} ${g.gudang}`}>
                <table className="w-full border-y border-garis text-sm">
                  <thead><tr className="border-b border-garis text-left text-tinta-2"><th scope="col" className="py-2 pr-3 font-medium">{t.produk}</th><th scope="col" className="py-2 pr-3 font-medium">{t.lokasiLabel}</th>
                    <th scope="col" className="py-2 text-right font-medium">{t.jumlah}</th><th scope="col" className="py-2 text-right font-medium">{t.nilai}</th></tr></thead>
                  <tbody className="divide-y divide-garis">
                    {g.produk.map((x) => <tr key={x.produk_id}><td className="py-2 pr-3"><span className="font-mono">{x.kode}</span> <span data-pengguna>{x.nama}</span></td><td className="py-2 pr-3" data-pengguna>{x.lokasi ?? ""}</td>
                      <td className="angka py-2 text-right">{angka(x.jumlah)}</td><td className="py-2 text-right"><Rupiah nilai={x.nilai} bahasa={bahasa} /></td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}

      {kelola && (
        <div className="mt-10 grid gap-8">
          <section aria-labelledby="judul-tambah"><h2 id="judul-tambah" className="text-lg font-semibold">{t.tambahProduk}</h2>
            <FormProduk teks={t} induk={daftar.filter((x) => !x.induk_id && x.aktif).map((x) => ({ id: x.id, nama: `${x.kode} ${x.nama}` }))} /></section>
          {barang.length > 0 && gudangDaftar.length === 0 && <p className="text-sm text-tinta-2">{t.gudangOtomatis}</p>}
          {barang.length > 0 && (
            <>
              <section aria-labelledby="judul-masuk"><h2 id="judul-masuk" className="text-lg font-semibold">{t.stokMasuk}</h2>
                <FormMasuk produk={barang} gudang={gudangDaftar} kunci={randomUUID()} hariIni={hari} teks={t} /></section>
              <section aria-labelledby="judul-opname"><h2 id="judul-opname" className="text-lg font-semibold">{t.opname}</h2><p className="mt-1 text-sm text-tinta-2">{t.opnameKet}</p>
                <FormOpname produk={barang} gudang={gudangDaftar} kunci={randomUUID()} teks={t} /></section>
              {gudangDaftar.length > 1 && <section aria-labelledby="judul-pindah"><h2 id="judul-pindah" className="text-lg font-semibold">{t.pindah}</h2>
                <FormPindah produk={barang} gudang={gudangDaftar} kunci={randomUUID()} teks={t} /></section>}
            </>
          )}
          <section aria-labelledby="judul-gudang"><h2 id="judul-gudang" className="text-lg font-semibold">{t.gudangJudul}</h2>
            {gudangDaftar.length > 0 && <p className="mt-1 text-sm text-tinta-2">{gudangDaftar.map((g) => `${g.nama}${g.utama ? ` (${t.utama})` : ""}`).join(", ")}</p>}
            <FormGudang teks={t} /></section>
        </div>
      )}
    </div>
  );
}

export default function Barang(props: PageProps<"/app/barang">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-48 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
