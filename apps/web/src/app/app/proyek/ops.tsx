import { FormProyekOps, FormTemplate, StatusProyek, TagihProyek } from "@/components/app/proyek-ops";
import { formatTanggalKalender } from "@/lib/format";
import type { KerjaTemplate } from "@/lib/proyek/template";
import { createClient } from "@/lib/supabase/server";

// X-12 bagian Proyek operasional (pemilik/admin): template dengan pratinjau isinya, buat proyek, daftar proyek dengan status,
// tipe, klien, PIC, periode, jumlah kerja, dan tagihan. Data dibaca lewat RLS.
type Info = { dimension_id: string; status: string; tipe: string; pola: string | null; mulai: string; target: string | null; pic: string | null; klien: string | null };

export async function ProyekOperasional() {
  const supabase = await createClient();
  const [info, dim, orang, klien, tpl, periode, kerja] = await Promise.all([
    supabase.from("proyek_info").select("dimension_id, status, tipe, pola, mulai, target, pic, klien").order("dibuat_at", { ascending: false }).limit(100),
    supabase.from("dimension").select("id, nama").eq("jenis", "proyek"),
    supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(300),
    supabase.from("customer").select("id, nama").eq("aktif", true).order("nama").limit(300),
    supabase.from("proyek_template").select("id, nama, isi").eq("aktif", true).order("nama"),
    supabase.from("proyek_periode").select("dimension_id, label, mulai").order("mulai", { ascending: false }),
    supabase.from("kerja").select("proyek_id, status").not("proyek_id", "is", null).limit(5000),
  ]);
  const nama = new Map((dim.data ?? []).map((d) => [d.id as string, d.nama as string]));
  const namaOrang = new Map((orang.data ?? []).map((o) => [o.id as string, o.nama as string]));
  const namaKlien = new Map((klien.data ?? []).map((o) => [o.id as string, o.nama as string]));
  const daftar = (info.data ?? []) as Info[];
  const TIPE: Record<string, string> = { sekali: "Sekali", berulang: "Berulang", berkelanjutan: "Berkelanjutan" };
  return (
    <section className="mt-8" aria-labelledby="judul-ops" data-testid="proyek-operasional">
      <h2 id="judul-ops" className="text-lg font-semibold">Proyek operasional</h2>
      <p className="mt-1 text-sm text-tinta-2">Proyek dengan PIC, tim, klien, dan kerja dari template. Proyek berulang membuka periode baru dan kerjanya sendiri setiap minggu atau bulan.</p>
      <details className="mt-3 rounded-[var(--radius-kartu)] border border-garis p-4">
        <summary className="cursor-pointer font-semibold">Template proyek ({(tpl.data ?? []).length})</summary>
        <ul className="mt-3 grid gap-3 text-sm" data-testid="daftar-template">
          {(tpl.data ?? []).map((x) => (
            <li key={x.id as string}><p className="font-semibold" data-pengguna>{x.nama as string}</p>
              <ol className="mt-1 list-decimal pl-5 text-tinta-2">{(x.isi as KerjaTemplate[]).map((k, i) => (
                <li key={i}><span data-pengguna>{k.judul}</span>{k.hari !== undefined ? `, hari ke-${k.hari}` : ""}{k.butir?.length ? `, ${k.butir.length} butir` : ""}</li>))}</ol>
            </li>))}
        </ul>
        <div className="mt-4"><FormTemplate /></div>
      </details>
      <details className="mt-3 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="buat-proyek-ops">
        <summary className="cursor-pointer font-semibold">Buat proyek operasional</summary>
        <div className="mt-3"><FormProyekOps orang={(orang.data ?? []) as { id: string; nama: string }[]} klien={(klien.data ?? []) as { id: string; nama: string }[]}
          template={((tpl.data ?? []) as { id: string; nama: string }[]).map((x) => ({ id: x.id, nama: x.nama }))} /></div>
      </details>
      {daftar.length === 0 ? <p className="mt-3 text-sm text-tinta-2">Belum ada proyek operasional. Buat template, lalu buat proyek dari template itu.</p> : (
        <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm" data-testid="daftar-proyek-ops">
          {daftar.map((p) => {
            const per = (periode.data ?? []).filter((x) => x.dimension_id === p.dimension_id);
            const k = (kerja.data ?? []).filter((x) => x.proyek_id === p.dimension_id);
            return (
              <li key={p.dimension_id} className="grid gap-2 py-3" data-proyek={nama.get(p.dimension_id)}>
                <p><span className="font-semibold" data-pengguna>{nama.get(p.dimension_id)}</span> <span className="text-tinta-2">{TIPE[p.tipe]}{p.pola ? ` ${p.pola}` : ""}, mulai {formatTanggalKalender(p.mulai)}{p.target ? `, target ${formatTanggalKalender(p.target)}` : ""}</span></p>
                <p className="text-tinta-2">PIC <span data-pengguna>{p.pic ? namaOrang.get(p.pic) ?? "-" : "belum ada"}</span>{p.klien ? <>, klien <span data-pengguna>{namaKlien.get(p.klien)}</span></> : ""}, {k.length} kerja ({k.filter((x) => x.status === "selesai").length} selesai){per.length ? `, periode ${per[0].label} (${per.length} periode)` : ""}</p>
                <StatusProyek proyek={p.dimension_id} status={p.status} />
                {p.klien && <TagihProyek proyek={p.dimension_id} nama={nama.get(p.dimension_id) ?? ""} />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
