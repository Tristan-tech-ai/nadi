import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { FormPerintahKerja, FormRakit, FormResep, LangkahPK, type ProdukPilih } from "@/components/app/produksi";
import { formatRupiah } from "@/lib/format";
import type { Bahasa } from "@/lib/i18n/bahasa";
import { isiTeks } from "@/lib/i18n/isi-teks";
import { ambilKamus } from "@/lib/i18n/kamus";
import { bahasaAplikasi } from "@/lib/i18n/server";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { KepalaHalaman } from "@/components/app/kepala-halaman";

export const metadata: Metadata = { title: "Produksi" };

type Bom = { id: string; product_id: string; output_qty: number; conversion_cost: number; materials: { produk: string; jumlah: number }[];
  other_outputs: { produk: string; jumlah: number; jenis: "bersama" | "sampingan" }[] };
type Wo = { id: string; kind: "produce" | "assemble" | "disassemble"; nomor: string; product_id: string; planned_qty: number; status: "planned" | "running" | "done" | "cancelled";
  standard_unit_cost: number; material_cost: number; conversion_cost: number; variance: number | null; outputs: { produk: string; jumlah: number; nilai: number }[]; tanggal: string };
type Butuh = { produk: string; nama: string; satuan: string; jumlah: number; stok: number };

async function Isi() {
  const sesi = await wajibPerusahaan();
  const bahasa: Bahasa = await bahasaAplikasi(sesi.bahasa);
  const t = ambilKamus(bahasa).produksi;
  const judul = <KepalaHalaman jalur="/app/produksi" judul={t.judul} ket={false} />;
  if (!["pemilik", "admin", "akuntan"].includes(sesi.peran)) return <div lang={bahasa}>{judul}<p className="mt-2 text-tinta-2">{t.hanya}</p></div>;
  const ubah = sesi.peran !== "akuntan";
  const supabase = await createClient();
  const [pr, bm, wo] = await Promise.all([
    supabase.from("produk").select("id, nama, satuan").eq("aktif", true).eq("jenis", "barang").order("nama").limit(500),
    supabase.from("bom").select("id, product_id, output_qty, conversion_cost, materials, other_outputs").order("diubah_at", { ascending: false }).limit(200),
    supabase.from("work_order").select("id, kind, nomor, product_id, planned_qty, status, standard_unit_cost, material_cost, conversion_cost, variance, outputs, tanggal")
      .order("dibuat_at", { ascending: false }).limit(40),
  ]);
  const produk = (pr.data ?? []) as ProdukPilih[];
  const nama = new Map(produk.map((p) => [p.id, p]));
  const boms = (bm.data ?? []) as Bom[];
  const wos = (wo.data ?? []) as Wo[];
  const angka = new Intl.NumberFormat(bahasa === "en" ? "en-GB" : "id-ID", { maximumFractionDigits: 4 });
  const rp = (n: number) => formatRupiah(n, { bahasa });
  const rencana = wos.filter((w) => w.status === "planned").slice(0, 8);
  const butuh = new Map<string, Butuh[]>(await Promise.all(rencana.map(async (w) =>
    [w.id, ((await supabase.rpc("explode_bom", { p_produk: w.product_id, p_jumlah: w.planned_qty })).data ?? []) as Butuh[]] as const)));
  const berResep = produk.filter((p) => boms.some((b) => b.product_id === p.id));
  const sebut = (id: string, n: number) => `${nama.get(id)?.nama ?? "?"} ${angka.format(n)} ${nama.get(id)?.satuan ?? ""}`.trim();

  return (
    <div lang={bahasa}>
      {judul}
      <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.ket}</p>

      <section className="mt-8" aria-labelledby="pk-judul">
        <h2 id="pk-judul" className="text-lg font-semibold">{t.pkJudul}</h2>
        {ubah && berResep.length > 0 && <FormPerintahKerja produk={berResep} kunci={randomUUID()} teks={t} />}
        {wos.length === 0 ? <p className="mt-3 text-sm text-tinta-2">{t.pkKosong}</p> : (
          <ul className="mt-4 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-pk">
            {wos.map((w) => {
              const s = nama.get(w.product_id)?.satuan ?? "";
              const tot = w.material_cost + w.conversion_cost;
              const jadi = w.outputs.find((o) => o.produk === w.product_id)?.jumlah ?? w.planned_qty;
              return (
                <li key={w.id} className="py-3" data-testid="pk" data-nomor={w.nomor} data-status={w.status}>
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span><span className="angka font-semibold">{w.nomor}</span> <span data-pengguna>{sebut(w.product_id, w.planned_qty)}</span></span>
                    <span className="text-tinta-2">{t.jenisNama[w.kind]} · {t.statusNama[w.status]}</span>
                  </p>
                  {w.status === "planned" && butuh.get(w.id)?.length ? (
                    <p className="mt-1 text-tinta-2">{t.butuh} {butuh.get(w.id)!.map((b) => `${b.nama} ${angka.format(b.jumlah)} ${b.satuan} (${isiTeks(t.stokAda, { n: angka.format(b.stok) })})`).join(", ")}</p>
                  ) : null}
                  {w.status === "done" && w.kind !== "disassemble" && (
                    <p className="mt-1" data-testid="pk-biaya">
                      {isiTeks(t.biaya, { rp: rp(tot), satuanRp: rp(Math.round(tot / Number(jadi || 1))), satuan: s })}. {isiTeks(t.standar, { rp: rp(w.standard_unit_cost), satuan: s })}.{" "}
                      {w.variance !== null && isiTeks(t.selisih, { rp: rp(w.variance) })}
                    </p>
                  )}
                  {w.status === "done" && w.outputs.length > 0 && <p className="mt-1 text-tinta-2">{w.outputs.map((o) => `${sebut(o.produk, o.jumlah)} ${rp(o.nilai)}`).join(", ")}</p>}
                  {ubah && (w.status === "planned" || w.status === "running") && <LangkahPK wo={w.id} status={w.status} rencana={w.planned_qty} nomor={w.nomor} teks={t} />}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 max-w-2xl text-xs text-tinta-2">{t.penilaian}</p>
      </section>

      <section className="mt-10" aria-labelledby="bom-judul">
        <h2 id="bom-judul" className="text-lg font-semibold">{t.bomJudul}</h2>
        <p className="mt-1 text-sm text-tinta-2">{t.bomKet}</p>
        {ubah && produk.length > 1 && <FormResep produk={produk} teks={t} />}
        <h3 className="mt-6 font-semibold">{t.daftarBom}</h3>
        {boms.length === 0 ? <p className="mt-2 text-sm text-tinta-2">{t.bomKosong}</p> : (
          <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2" data-testid="daftar-bom">
            {boms.map((b) => (
              <li key={b.id} className="rounded-[var(--radius-kartu)] border border-garis p-3">
                <p className="font-semibold" data-pengguna>{nama.get(b.product_id)?.nama}</p>
                <p className="text-tinta-2">{isiTeks(t.perResep, { jumlah: angka.format(b.output_qty), satuan: nama.get(b.product_id)?.satuan ?? "" })}, {t.konversi.replace(/ \(Rp\)$/, "")} {rp(b.conversion_cost)}</p>
                <p className="mt-1">{t.bahan}: <span data-pengguna>{b.materials.map((m) => sebut(m.produk, m.jumlah)).join(", ")}</span></p>
                {b.other_outputs.length > 0 && <p>{t.lain.replace(/ \(.*\)$/, "")}: <span data-pengguna>{b.other_outputs.map((m) => `${sebut(m.produk, m.jumlah)} (${m.jenis === "bersama" ? t.bersama : t.sampingan})`).join(", ")}</span></p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ubah && berResep.length > 0 && (
        <section className="mt-10" aria-labelledby="rakit-judul">
          <h2 id="rakit-judul" className="text-lg font-semibold">{t.rakitJudul}</h2>
          <p className="mt-1 max-w-2xl text-sm text-tinta-2">{t.rakitKet}</p>
          <FormRakit produk={berResep} kunci={randomUUID()} teks={t} />
        </section>
      )}
    </div>
  );
}

export default function HalamanProduksi() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10">
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" />}>
        <Isi />
      </Suspense>
    </main>
  );
}
