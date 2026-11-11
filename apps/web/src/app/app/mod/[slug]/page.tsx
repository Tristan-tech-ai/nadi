import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { KepalaHalaman } from "@/components/app/kepala-halaman";
import { FormCatatan, TombolArsip, TombolStatus, type IsianAwal, type Opsi, type TransisiTampil } from "@/components/app/mod";
import { formatJam, formatTanggal } from "@/lib/format";
import { hariIni } from "@/lib/izin";
import { periksaManifest } from "@/lib/mod/pengawas";
import type { Bidang, Koleksi, Manifest, Pilihan } from "@/lib/mod/skema";
import {
  aksesPeran, aturDaftar, bacaParam, bidangDari, bidangFormulir, bidangRincian, bolehBuat, bolehUbah, bulanKalender, isoKeLokal, koleksiDari,
  kolomUrut, labelStatus, labelTransisi, PER_HALAMAN, tampilanLihat, tanggalCatatan, teksNilai, transisiUntuk, type Catatan, type Label, type Lihat,
} from "@/lib/mod/tafsir";
import { wajibPerusahaan } from "@/lib/sesi";
import { createClient } from "@/lib/supabase/server";
import { zonaUsahaIni } from "@/lib/zona-usaha";

// X-05 penafsir tampilan Nadi Mod: satu halaman tetap yang menampilkan koleksi mod mana pun (daftar dengan cari, saring, urut,
// dan halaman di server; papan per status; kalender; formulir; rincian + riwayat). Tidak ada markup dari manifest; semua
// nilai dirender sebagai teks. Hak baca lewat RLS mod_record_baca, hak tulis dan transisi lewat RPC mod_catatan_*.
export const metadata: Metadata = { title: "Fitur tambahan" };

type SP = Record<string, string | string[] | undefined>;
const KOLOM = "id, data, status, ditugaskan, dibuat_oleh, dibuat_at, diubah_at";
const REF = ["orang", "pelanggan", "produk", "proyek", "rujukan"] as const;
const WARNA: Record<NonNullable<Pilihan["warna"]>, string> = {
  abu: "border-garis-kuat text-tinta-2", kunyit: "border-kunyit bg-kunyit/25 text-tinta", daun: "border-daun text-daun", laut: "border-laut text-laut", cap: "border-cap text-cap",
};
const NAMA_LIHAT: Record<Lihat, string> = { daftar: "Daftar", papan: "Papan", kalender: "Kalender" };
const PILIH = "h-10 rounded-[var(--radius-isian)] border border-garis-kuat bg-kertas px-2 text-base";
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

type Ctx = Awaited<ReturnType<typeof siapkan>>;

function tautan(slug: string, isi: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(isi)) if (v !== undefined && v !== "") p.set(k, String(v));
  return `/app/mod/${slug}?${p.toString()}`;
}

function Status({ k, status }: { k: Koleksi; status: string | null }) {
  if (!k.status || !status) return null;
  const s = k.status.daftar.find((x) => x.kode === status);
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${WARNA[s?.warna ?? "abu"]}`} data-status={status}>{labelStatus(k, status)}</span>;
}

async function siapkan(slug: string, sp: SP) {
  const sesi = await wajibPerusahaan();
  const supabase = await createClient();
  const [{ data: m }, zona, { data: saya }] = await Promise.all([
    supabase.from("mod").select("id, kode, nama, manifest").eq("kode", slug).eq("status", "aktif").maybeSingle(),
    zonaUsahaIni(sesi.perusahaanId),
    supabase.from("orang").select("id").eq("user_id", sesi.userId).eq("status", "aktif").maybeSingle(),
  ]);
  if (!m) return null;
  const manifest = m.manifest as Manifest;
  // Manifest aktif sudah diperiksa saat diterapkan; diperiksa ulang di sini supaya penafsir tidak pernah menampilkan bentuk asing.
  const alasan = periksaManifest(manifest);
  const ambil = (n: string) => { const v = sp[n]; return (Array.isArray(v) ? v[0] : v) ?? ""; };
  const k = koleksiDari(manifest, ambil("k") || null) ?? manifest.koleksi[0];
  const akses = k ? aksesPeran(k, sesi.peran) : "tidak";
  const lihatAda = k ? tampilanLihat(k) : [];
  const lihat = (lihatAda as string[]).includes(ambil("v")) ? (ambil("v") as Lihat) : lihatAda[0] ?? "daftar";
  return { sesi, supabase, m: { id: m.id as string, kode: m.kode as string }, manifest, alasan, k, akses, lihat, lihatAda, zona, orangSaya: (saya?.id as string | undefined) ?? null, ambil };
}

/** Pilihan dan label untuk bidang rujukan koleksi ini (dibaca lewat RLS; data usaha lain tidak pernah terbaca). */
async function rujukan(c: NonNullable<Ctx>, k: Koleksi): Promise<{ opsi: Record<string, Opsi>; label: Label }> {
  const label: Label = { orang: new Map(), pelanggan: new Map(), produk: new Map(), proyek: new Map(), rujukan: new Map() };
  const opsi: Record<string, Opsi> = {};
  const butuh = new Set(k.bidang.map((b) => b.tipe));
  const [o, p, pr, d] = await Promise.all([
    butuh.has("orang") ? c.supabase.from("orang").select("id, nama").eq("status", "aktif").order("nama").limit(500) : null,
    butuh.has("pelanggan") ? c.supabase.from("customer").select("id, nama").eq("aktif", true).order("nama").limit(500) : null,
    butuh.has("produk") ? c.supabase.from("produk").select("id, nama").eq("aktif", true).order("nama").limit(500) : null,
    butuh.has("proyek") ? c.supabase.from("dimension").select("id, nama").eq("jenis", "proyek").eq("aktif", true).order("nama").limit(500) : null,
  ]);
  const isi = (tipe: (typeof REF)[number], rows: { id: string; nama: string }[] | null | undefined) => { for (const r of rows ?? []) label[tipe].set(r.id, r.nama); };
  isi("orang", o?.data); isi("pelanggan", p?.data); isi("produk", pr?.data); isi("proyek", d?.data);
  for (const b of k.bidang) {
    if (b.tipe === "rujukan" && b.koleksi) {
      const target = koleksiDari(c.manifest, b.koleksi);
      if (!target) continue;
      const { data } = await c.supabase.from("mod_record").select("id, data").eq("mod_id", c.m.id).eq("koleksi", target.kode).eq("arsip", false).order("diubah_at", { ascending: false }).limit(500);
      const daftar = (data ?? []).map((r) => ({ v: r.id as string, l: String((r.data as Record<string, unknown>)?.[target.judul] ?? "(tanpa judul)") }));
      for (const x of daftar) label.rujukan.set(x.v, x.l);
      opsi[b.kode] = daftar;
    } else if ((REF as readonly string[]).includes(b.tipe)) {
      opsi[b.kode] = [...label[b.tipe as (typeof REF)[number]].entries()].map(([v, l]) => ({ v, l }));
    }
  }
  return { opsi, label };
}

function awalDari(bidang: Bidang[], data: Record<string, unknown>, zona: string): IsianAwal {
  const awal: IsianAwal = {};
  for (const b of bidang) {
    const v = data[b.kode];
    if (v === undefined || v === null) continue;
    awal[b.kode] = b.tipe === "tanggal_jam" ? isoKeLokal(v, zona) : typeof v === "boolean" ? v : Array.isArray(v) ? v.map(String) : String(v);
  }
  return awal;
}

function transisiTampil(k: Koleksi, c: Catatan, peran: string, uid: string, orang: string | null): TransisiTampil[] {
  return transisiUntuk(k, c, peran, { uid, orang }).map((t) => ({ ke: t.ke, label: labelTransisi(k, t), wajib: (t.wajib_isi ?? []).map((w) => bidangDari(k, w)).filter((b): b is Bidang => !!b) }));
}

async function Daftar({ c, sp, rj }: { c: NonNullable<Ctx>; sp: SP; rj: Awaited<ReturnType<typeof rujukan>> }) {
  const k = c.k!;
  const p = bacaParam(k, sp);
  const d = aturDaftar(k);
  const kueri = (dari: number) => {
    let x = c.supabase.from("mod_record").select(KOLOM, { count: "exact" }).eq("mod_id", c.m.id).eq("koleksi", k.kode).eq("arsip", false);
    if (p.q) x = x.ilike(`data->>${k.judul}`, `%${p.q}%`);
    if (p.status) x = x.eq("status", p.status);
    for (const [kode, v] of Object.entries(p.saring)) {
      const b = bidangDari(k, kode)!;
      x = b.tipe === "pilihan_banyak" || (b.tipe === "orang" && b.banyak) ? x.filter(`data->${kode}`, "cs", JSON.stringify([v])) : x.eq(`data->>${kode}`, v);
    }
    return x.order(kolomUrut(k, p.urut), { ascending: p.arah === "naik", nullsFirst: false }).order("id", { ascending: true }).range(dari, dari + PER_HALAMAN - 1);
  };
  let hal = p.hal;
  let hasil = await kueri((hal - 1) * PER_HALAMAN);
  // Halaman di luar jumlah hasil: PostgREST menjawab 416 (PGRST103). Ambil jumlahnya, lalu tampilkan halaman terakhir yang ada.
  if (hasil.error?.code === "PGRST103" && hal > 1) {
    const awal = await kueri(0);
    hal = Math.max(1, Math.ceil((awal.count ?? 0) / PER_HALAMAN));
    hasil = hal === 1 ? awal : await kueri((hal - 1) * PER_HALAMAN);
  }
  const total = hasil.count ?? 0;
  const halMaks = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const data = hasil.data;
  const baris = (data ?? []) as Catatan[];
  const dasarUrl = { k: k.kode, v: "daftar", q: p.q, status: p.status, ...Object.fromEntries(Object.entries(p.saring).map(([a, b]) => [`s_${a}`, b])) };
  const kolom = d.kolom.map((kode) => bidangDari(k, kode)!).filter(Boolean);
  return (
    <section aria-labelledby="judul-daftar" className="mt-6">
      <h2 id="judul-daftar" className="sr-only">Daftar {k.nama}</h2>
      <form method="get" className="flex flex-wrap items-end gap-3 text-sm" aria-label={`Cari dan saring ${k.nama}`}>
        <input type="hidden" name="k" value={k.kode} /><input type="hidden" name="v" value="daftar" />
        <div className="flex min-w-48 flex-1 flex-col gap-1"><label htmlFor="saring-q" className="text-tinta-2">Cari {bidangDari(k, k.judul)?.label.toLowerCase()}</label>
          <input id="saring-q" name="q" defaultValue={p.q} maxLength={60} className={PILIH} /></div>
        {k.status && (
          <div className="flex flex-col gap-1"><label htmlFor="saring-status" className="text-tinta-2">Status</label>
            <select id="saring-status" name="status" defaultValue={p.status} className={PILIH}>
              <option value="">Semua</option>{k.status.daftar.map((s) => <option key={s.kode} value={s.kode}>{s.label}</option>)}
            </select></div>
        )}
        {d.saring.map((kode) => {
          const b = bidangDari(k, kode)!;
          const pil = b.tipe === "pilihan" || b.tipe === "pilihan_banyak" ? (b.pilihan ?? []).map((x) => ({ v: x.kode, l: x.label })) : rj.opsi[kode] ?? [];
          return (
            <div key={kode} className="flex flex-col gap-1"><label htmlFor={`saring-${kode}`} className="text-tinta-2">{b.label}</label>
              <select id={`saring-${kode}`} name={`s_${kode}`} defaultValue={p.saring[kode] ?? ""} className={`${PILIH} max-w-56`}>
                <option value="">Semua</option>{pil.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
              </select></div>
          );
        })}
        <div className="flex flex-col gap-1"><label htmlFor="saring-urut" className="text-tinta-2">Urutkan</label>
          <select id="saring-urut" name="urut" defaultValue={p.urut} className={PILIH}>
            <option value="dibuat_at">Waktu dibuat</option><option value="diubah_at">Terakhir diubah</option>
            {k.bidang.filter((b) => b.tipe !== "rumus" && b.tipe !== "pilihan_banyak" && !(b.tipe === "orang" && b.banyak)).map((b) => <option key={b.kode} value={b.kode}>{b.label}</option>)}
          </select></div>
        <div className="flex flex-col gap-1"><label htmlFor="saring-arah" className="text-tinta-2">Arah</label>
          <select id="saring-arah" name="arah" defaultValue={p.arah} className={PILIH}>
            <option value="naik">Naik</option><option value="turun">Turun</option></select></div>
        <button type="submit" className="h-10 rounded-[var(--radius-isian)] border border-garis-kuat px-4 font-semibold hover:bg-kertas-2">Terapkan</button>
      </form>
      <p className="mt-4 text-sm text-tinta-2" data-testid="jumlah-catatan">{total} catatan{total > PER_HALAMAN ? `, halaman ${hal} dari ${halMaks}` : ""}</p>
      {baris.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-2">{p.q || p.status || Object.keys(p.saring).length ? "Tidak ada yang cocok. Ubah kata cari atau saringan." : `Belum ada ${k.nama.toLowerCase()}. Tambah yang pertama lewat tombol di atas.`}</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-[var(--radius-kartu)] border border-garis">
          <table className="w-full min-w-[36rem] text-left text-sm" data-testid="daftar-catatan">
            <thead className="border-b border-garis bg-kertas-2 text-tinta-2"><tr>
              {kolom.map((b) => <th key={b.kode} scope="col" className="px-3 py-2 font-semibold">{b.label}</th>)}
              {k.status && <th scope="col" className="px-3 py-2 font-semibold">Status</th>}
            </tr></thead>
            <tbody className="divide-y divide-garis">
              {baris.map((r) => (
                <tr key={r.id} data-catatan={r.id}>
                  {kolom.map((b, i) => (
                    <td key={b.kode} className={`px-3 py-2 ${b.tipe === "angka" || b.tipe === "rupiah" || b.tipe === "rumus" ? "angka" : ""}`}>
                      {i === 0 ? <Link href={tautan(c.m.kode, { k: k.kode, id: r.id })} className="font-semibold underline-offset-4 hover:underline" data-pengguna>{teksNilai(b, r.data, rj.label, c.zona) || "(tanpa judul)"}</Link>
                        : <span data-pengguna>{teksNilai(b, r.data, rj.label, c.zona)}</span>}
                    </td>
                  ))}
                  {k.status && <td className="px-3 py-2"><Status k={k} status={r.status} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {halMaks > 1 && (
        <nav aria-label="Halaman" className="mt-3 flex items-center gap-3 text-sm">
          {hal > 1 ? <Link href={tautan(c.m.kode, { ...dasarUrl, urut: p.urut, arah: p.arah, hal: hal - 1 })} className="underline underline-offset-4">Sebelumnya</Link> : <span className="text-tinta-2">Sebelumnya</span>}
          <span className="angka text-tinta-2">{hal} / {halMaks}</span>
          {hal < halMaks ? <Link href={tautan(c.m.kode, { ...dasarUrl, urut: p.urut, arah: p.arah, hal: hal + 1 })} className="underline underline-offset-4">Berikutnya</Link> : <span className="text-tinta-2">Berikutnya</span>}
        </nav>
      )}
    </section>
  );
}

async function Papan({ c, rj }: { c: NonNullable<Ctx>; rj: Awaited<ReturnType<typeof rujukan>> }) {
  const k = c.k!;
  const t = k.tampilan.find((x) => x.jenis === "papan");
  const kartu = (t && t.jenis === "papan" ? t.kolom_kartu : []).map((kode) => bidangDari(k, kode)).filter((b): b is Bidang => !!b);
  const { data } = await c.supabase.from("mod_record").select(KOLOM).eq("mod_id", c.m.id).eq("koleksi", k.kode).eq("arsip", false).order("diubah_at", { ascending: false }).limit(300);
  const semua = (data ?? []) as Catatan[];
  const dasar = { modId: c.m.id, koleksi: k.kode, slug: c.m.kode };
  return (
    <section aria-labelledby="judul-papan" className="mt-6">
      <h2 id="judul-papan" className="sr-only">Papan {k.nama}</h2>
      <div className="grid gap-4 md:auto-cols-[minmax(15rem,1fr)] md:grid-flow-col md:overflow-x-auto md:pb-2">
        {k.status!.daftar.map((s) => {
          const isi = semua.filter((r) => r.status === s.kode);
          return (
            <section key={s.kode} aria-label={`${s.label}, ${isi.length} catatan`} className="min-w-0 rounded-[var(--radius-kartu)] border border-garis bg-kertas-2 p-3" data-kolom={s.kode}>
              <h3 className="flex items-center justify-between gap-2 text-sm font-semibold"><Status k={k} status={s.kode} /><span className="angka text-tinta-2">{isi.length}</span></h3>
              {isi.length === 0 ? <p className="mt-2 text-sm text-tinta-2">Kosong</p> : (
                <ul className="mt-2 grid gap-2">
                  {isi.slice(0, 50).map((r) => (
                    <li key={r.id} className="rounded-[var(--radius-kartu)] border border-garis bg-kertas p-3 text-sm" data-catatan={r.id}>
                      <Link href={tautan(c.m.kode, { k: k.kode, id: r.id })} className="font-semibold underline-offset-4 hover:underline" data-pengguna>{String(r.data[k.judul] ?? "(tanpa judul)")}</Link>
                      {kartu.map((b) => { const v = teksNilai(b, r.data, rj.label, c.zona); return v ? <p key={b.kode} className="mt-1 text-tinta-2"><span className="sr-only">{b.label}: </span><span data-pengguna>{v}</span></p> : null; })}
                      <div className="mt-2"><TombolStatus dasar={dasar} id={r.id} transisi={transisiTampil(k, r, c.sesi.peran, c.sesi.userId, c.orangSaya).filter((x) => x.wajib.length === 0)} /></div>
                    </li>
                  ))}
                </ul>
              )}
              {isi.length > 50 && <p className="mt-2 text-sm"><Link href={tautan(c.m.kode, { k: k.kode, v: "daftar", status: s.kode })} className="underline underline-offset-4">Lihat semua {isi.length} di daftar</Link></p>}
            </section>
          );
        })}
      </div>
    </section>
  );
}

async function Kalender({ c, rj }: { c: NonNullable<Ctx>; rj: Awaited<ReturnType<typeof rujukan>> }) {
  const k = c.k!;
  const t = k.tampilan.find((x) => x.jenis === "kalender");
  const b = t && t.jenis === "kalender" ? bidangDari(k, t.tanggal) : undefined;
  if (!b || (b.tipe !== "tanggal" && b.tipe !== "tanggal_jam")) return <p className="mt-6 text-sm text-tinta-2">Kalender butuh bidang tanggal.</p>;
  const hari = hariIni(new Date(), c.zona);
  const kal = bulanKalender(c.ambil("bulan") || undefined, hari);
  // tanggal_jam disimpan UTC: ambil sehari lebih lebar lalu dipilah menurut zona usaha
  const kiri = b.tipe === "tanggal" ? kal.mulai : `${new Date(Date.parse(`${kal.mulai}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)}`;
  const kanan = b.tipe === "tanggal" ? kal.akhir : `${new Date(Date.parse(`${kal.akhir}T00:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10)}`;
  const { data } = await c.supabase.from("mod_record").select(KOLOM).eq("mod_id", c.m.id).eq("koleksi", k.kode).eq("arsip", false)
    .gte(`data->>${b.kode}`, kiri).lte(`data->>${b.kode}`, b.tipe === "tanggal" ? kanan : `${kanan}T`).order(`data->>${b.kode}`).limit(500);
  const perHari = new Map<string, Catatan[]>();
  for (const r of (data ?? []) as Catatan[]) {
    const tgl = tanggalCatatan(r.data[b.kode], b.tipe, c.zona);
    if (tgl && tgl >= kal.mulai && tgl <= kal.akhir) perHari.set(tgl, [...(perHari.get(tgl) ?? []), r]);
  }
  const judulBulan = formatTanggal(new Date(`${kal.mulai}T12:00:00Z`), "UTC").split(" ").slice(1).join(" ");
  const isiHari = (tgl: string) => (perHari.get(tgl) ?? []).map((r) => (
    <li key={r.id}><Link href={tautan(c.m.kode, { k: k.kode, id: r.id })} className="block truncate underline-offset-4 hover:underline" data-pengguna>
      {b.tipe === "tanggal_jam" && <span className="angka text-tinta-2">{teksNilai(b, r.data, rj.label, c.zona).split(", ")[1]} </span>}{String(r.data[k.judul] ?? "(tanpa judul)")}</Link></li>
  ));
  return (
    <section aria-labelledby="judul-kalender" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="judul-kalender" className="text-lg font-semibold">{judulBulan} <span className="text-sm font-normal text-tinta-2">menurut {b.label.toLowerCase()}</span></h2>
        <nav aria-label="Bulan" className="flex gap-3 text-sm">
          <Link href={tautan(c.m.kode, { k: k.kode, v: "kalender", bulan: kal.lalu })} className="underline underline-offset-4">Bulan lalu</Link>
          <Link href={tautan(c.m.kode, { k: k.kode, v: "kalender" })} className="underline underline-offset-4">Bulan ini</Link>
          <Link href={tautan(c.m.kode, { k: k.kode, v: "kalender", bulan: kal.depan })} className="underline underline-offset-4">Bulan depan</Link>
        </nav>
      </div>
      <div className="mt-3 hidden grid-cols-7 overflow-hidden rounded-[var(--radius-kartu)] border border-garis text-sm sm:grid" data-testid="kalender-grid">
        {HARI.map((h) => <div key={h} className="border-b border-garis bg-kertas-2 px-2 py-1 font-semibold text-tinta-2">{h}</div>)}
        {kal.sel.map((tgl, i) => (
          <div key={tgl ?? `x${i}`} className={`min-h-24 border-b border-r border-garis p-1 ${tgl === hari ? "bg-kunyit/15" : ""}`}>
            {tgl && <><p className={`angka text-xs ${tgl === hari ? "font-bold" : "text-tinta-2"}`}>{Number(tgl.slice(8))}</p><ul className="mt-1 grid gap-0.5 text-xs">{isiHari(tgl)}</ul></>}
          </div>
        ))}
      </div>
      <ul className="mt-3 divide-y divide-garis border-y border-garis text-sm sm:hidden" data-testid="kalender-agenda">
        {[...perHari.keys()].sort().map((tgl) => (
          <li key={tgl} className="py-2"><p className="font-semibold">{formatTanggal(new Date(`${tgl}T12:00:00Z`), "UTC")}</p><ul className="mt-1 grid gap-1">{isiHari(tgl)}</ul></li>
        ))}
        {perHari.size === 0 && <li className="py-2 text-tinta-2">Tidak ada catatan di bulan ini.</li>}
      </ul>
    </section>
  );
}

async function Rincian({ c, id, rj }: { c: NonNullable<Ctx>; id: string; rj: Awaited<ReturnType<typeof rujukan>> }) {
  const k = c.k!;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await c.supabase.from("mod_record").select(KOLOM).eq("id", id).eq("mod_id", c.m.id).eq("koleksi", k.kode).eq("arsip", false).maybeSingle();
  if (!data) return <p className="mt-6 text-sm text-tinta-2">Catatan tidak ditemukan atau tidak boleh kamu lihat. <Link href={tautan(c.m.kode, { k: k.kode })} className="underline underline-offset-4">Kembali ke {k.nama.toLowerCase()}</Link></p>;
  const r = data as Catatan;
  const { data: log } = await c.supabase.from("mod_log").select("id, jenis, dari, ke, lewat, at, oleh").eq("record_id", r.id).order("at", { ascending: false }).limit(30);
  const bidang = bidangRincian(k);
  const ubah = bolehUbah(c.akses, r, { uid: c.sesi.userId, orang: c.orangSaya });
  const dasar = { modId: c.m.id, koleksi: k.kode, slug: c.m.kode };
  const isianUbah = bidang.filter((b) => b.tipe !== "rumus");
  const awal = awalDari(k.bidang, r.data, c.zona);
  const JENIS: Record<string, string> = { buat: "Dibuat", ubah: "Diubah", status: "Status", arsip: "Diarsipkan" };
  return (
    <article aria-labelledby="judul-catatan" className="mt-6" data-testid="rincian-catatan">
      <p className="text-sm"><Link href={tautan(c.m.kode, { k: k.kode })} className="underline underline-offset-4">Kembali ke {k.nama.toLowerCase()}</Link></p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h2 id="judul-catatan" className="text-xl font-semibold" data-pengguna>{String(r.data[k.judul] ?? "(tanpa judul)")}</h2>
        <Status k={k} status={r.status} />
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        {bidang.map((b) => (
          <div key={b.kode} className={b.tipe === "teks_panjang" ? "sm:col-span-2" : ""}>
            <dt className="text-tinta-2">{b.label}</dt>
            <dd className={`mt-0.5 whitespace-pre-line ${b.tipe === "angka" || b.tipe === "rupiah" || b.tipe === "rumus" ? "angka" : ""}`} data-bidang={b.kode}>
              {b.tipe === "tautan" && typeof r.data[b.kode] === "string" && /^https:\/\//.test(String(r.data[b.kode]))
                ? <a href={String(r.data[b.kode])} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-4" data-pengguna>{String(r.data[b.kode])}</a>
                : <span data-pengguna>{teksNilai(b, r.data, rj.label, c.zona) || <span className="text-tinta-2">Kosong</span>}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5"><TombolStatus dasar={dasar} id={r.id} transisi={transisiTampil(k, r, c.sesi.peran, c.sesi.userId, c.orangSaya)} awal={awal} opsi={rj.opsi} /></div>
      {ubah && (
        <details className="mt-6 rounded-[var(--radius-kartu)] border border-garis p-4">
          <summary className="cursor-pointer font-semibold">Ubah isian</summary>
          <div className="mt-3"><FormCatatan dasar={dasar} bidang={isianUbah} awal={awal} opsi={rj.opsi} id={r.id} label="Simpan perubahan" /></div>
        </details>
      )}
      {c.akses === "kelola" && <div className="mt-4"><TombolArsip dasar={dasar} id={r.id} /></div>}
      {(log ?? []).length > 0 && (
        <section aria-labelledby="judul-riwayat" className="mt-8">
          <h3 id="judul-riwayat" className="text-base font-semibold">Riwayat</h3>
          <ol className="mt-2 divide-y divide-garis border-y border-garis text-sm" data-testid="riwayat">
            {(log ?? []).map((l) => (
              <li key={l.id as string} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{JENIS[l.jenis as string] ?? l.jenis}{l.jenis === "status" ? `: ${labelStatus(k, l.dari as string | null) || "awal"} ke ${labelStatus(k, l.ke as string | null)}` : ""}{l.lewat === "mcp" ? " (lewat AI milikmu)" : ""}</span>
                <span className="angka text-tinta-2">{formatTanggal(new Date(l.at as string), c.zona)}, {formatJam(new Date(l.at as string), c.zona)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

async function Isi({ params, searchParams }: { params: PageProps<"/app/mod/[slug]">["params"]; searchParams: PageProps<"/app/mod/[slug]">["searchParams"] }) {
  const { slug } = await params;
  const sp = (await searchParams) as SP;
  if (!/^[a-z][a-z0-9-]{2,39}$/.test(slug)) notFound();
  const c = await siapkan(slug, sp);
  if (!c) {
    return (
      <>
        <KepalaHalaman jalur="/app/mod" judul="Fitur tambahan" />
        <p className="mt-6 text-sm text-tinta-2">Fitur ini tidak ditemukan atau sedang dimatikan. <Link href="/app/mod" className="underline underline-offset-4">Lihat fitur tambahan yang aktif</Link></p>
      </>
    );
  }
  const { manifest: mf, k } = c;
  if (c.alasan.length || !k || c.akses === "tidak") {
    return (
      <>
        <KepalaHalaman jalur="/app/mod" judul={<span data-pengguna>{mf.nama}</span>} />
        <p className="mt-6 text-sm text-tinta-2">{c.alasan.length ? "Isi fitur ini tidak lolos pemeriksaan Nadi, jadi tidak ditampilkan. Pemilik bisa memeriksanya di Tambah fitur." : "Kamu belum diberi akses ke bagian ini."}</p>
      </>
    );
  }
  const rj = await rujukan(c, k);
  const id = c.ambil("id");
  const dasar = { modId: c.m.id, koleksi: k.kode, slug: c.m.kode };
  return (
    <div data-mod={c.m.kode}>
      <KepalaHalaman jalur="/app/mod" judul={<span data-pengguna>{mf.nama}</span>} ket={<span data-pengguna>{mf.deskripsi}</span>} labelJejak={<span data-pengguna>{mf.nama}</span>} />
      {mf.koleksi.length > 1 && (
        <nav aria-label="Bagian fitur" className="mt-5 flex flex-wrap gap-2 text-sm">
          {mf.koleksi.filter((x) => aksesPeran(x, c.sesi.peran) !== "tidak").map((x) => (
            <Link key={x.kode} href={tautan(c.m.kode, { k: x.kode })} aria-current={x.kode === k.kode ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 font-semibold ${x.kode === k.kode ? "border-tinta bg-tinta text-kertas" : "border-garis-kuat hover:bg-kertas-2"}`} data-pengguna>{x.nama}</Link>
          ))}
        </nav>
      )}
      {!id && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {c.lihatAda.length > 1 ? (
            <nav aria-label="Tampilan" className="flex gap-1 rounded-[var(--radius-isian)] border border-garis p-1 text-sm">
              {c.lihatAda.map((v) => (
                <Link key={v} href={tautan(c.m.kode, { k: k.kode, v })} aria-current={v === c.lihat ? "page" : undefined}
                  className={`rounded-[calc(var(--radius-isian)-2px)] px-3 py-1.5 ${v === c.lihat ? "bg-kertas-2 font-semibold" : "text-tinta-2 hover:text-tinta"}`}>{NAMA_LIHAT[v]}</Link>
              ))}
            </nav>
          ) : <span />}
        </div>
      )}
      {!id && bolehBuat(c.akses) && (
        <details className="mt-4 rounded-[var(--radius-kartu)] border border-garis p-4" data-testid="tambah-catatan">
          <summary className="cursor-pointer font-semibold">Tambah {k.nama.toLowerCase()}</summary>
          <div className="mt-3"><FormCatatan dasar={dasar} bidang={bidangFormulir(k)} opsi={rj.opsi} label={`Simpan ${k.nama.toLowerCase()}`} tautan={`/app/mod/${c.m.kode}?k=${k.kode}`} /></div>
        </details>
      )}
      {id ? <Rincian c={c} id={id} rj={rj} />
        : c.lihat === "papan" ? <Papan c={c} rj={rj} />
        : c.lihat === "kalender" ? <Kalender c={c} rj={rj} />
        : <Daftar c={c} sp={sp} rj={rj} />}
    </div>
  );
}

export default function HalamanMod(props: PageProps<"/app/mod/[slug]">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <Suspense fallback={<div aria-hidden><div className="h-9 w-56 animate-pulse rounded-[var(--radius-isian)] bg-kertas-2" /><div className="mt-6 h-72 animate-pulse rounded-[var(--radius-kartu)] bg-kertas-2" /></div>}>
        <Isi params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
