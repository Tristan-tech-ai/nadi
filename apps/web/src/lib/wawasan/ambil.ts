import type { SupabaseClient } from "@supabase/supabase-js";
import { BATAS_BARIS, SUMBER, type Pilihan, type Sumber, type SumberMod } from "@/lib/wawasan/laporan";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KODE = /^[a-z][a-z0-9_]{1,29}$/;
type Baris = Record<string, unknown>;

/** Baris laporan untuk layar dan CSV: kolom dari daftar putih, saring ilike pada kolom cari sumber, dibaca lewat RLS. */
export async function ambilBaris(supabase: SupabaseClient, p: Pilihan, batas = BATAS_BARIS): Promise<{ baris: Baris[]; galat: unknown }> {
  if (p.mod) return ambilMod(supabase, p, p.mod, batas);
  const s = SUMBER[p.sumber as Sumber];
  const pilih = p.kolom.map((k) => (p.sumber === "proyek" && k === "nama" ? "dimension(nama)" : k)).join(",");
  let q = supabase.from(s.tabel).select(pilih);
  if (p.cari) q = q.ilike(s.cari, `%${p.cari}%`);
  const { data, error } = await q.order(s.urut, { ascending: s.urut === "nama" }).limit(batas);
  let baris = (data ?? []) as unknown as Baris[];
  if (p.sumber === "proyek") baris = baris.map(({ dimension, ...r }) => ({ ...r, nama: (dimension as { nama?: string } | null)?.nama ?? "" }));
  return { baris, galat: error };
}

/** X-18 catatan fitur tambahan: data diratakan menjadi kolom; orang, pelanggan, dan rujukan diganti nama atau judul. */
async function ambilMod(supabase: SupabaseClient, p: Pilihan, m: SumberMod, batas: number): Promise<{ baris: Baris[]; galat: unknown }> {
  let q = supabase.from("mod_record").select("data, status, dibuat_at").eq("mod_id", m.modId).eq("koleksi", m.koleksi).eq("arsip", false);
  if (p.cari && KODE.test(m.judul)) q = q.ilike(`data->>${m.judul}`, `%${p.cari}%`);
  const { data, error } = await q.order("dibuat_at", { ascending: false }).limit(batas);
  const baris: Baris[] = ((data ?? []) as { data: Baris; status: string | null; dibuat_at: string }[]).map((r) => ({ ...r.data, status: r.status, dibuat_at: r.dibuat_at }));
  const ids = (tipe: string[]) => [...new Set(baris.flatMap((b) => p.kolom.filter((k) => tipe.includes(m.tipe[k] ?? "")).flatMap((k) => [b[k]].flat()))
    .filter((v): v is string => typeof v === "string" && UUID.test(v)))].slice(0, 1000);
  const [orang, pelanggan, ruj] = await Promise.all([
    ids(["orang"]).length ? supabase.from("orang").select("id, nama").in("id", ids(["orang"])) : { data: [] },
    ids(["pelanggan"]).length ? supabase.from("customer").select("id, nama").in("id", ids(["pelanggan"])) : { data: [] },
    ids(["rujukan"]).length ? supabase.from("mod_record").select("id, data").in("id", ids(["rujukan"])) : { data: [] },
  ]);
  const nama = new Map<string, string>([
    ...((orang.data ?? []) as { id: string; nama: string }[]).map((o) => [o.id, o.nama] as [string, string]),
    ...((pelanggan.data ?? []) as { id: string; nama: string }[]).map((o) => [o.id, o.nama] as [string, string]),
  ]);
  const catatan = new Map(((ruj.data ?? []) as { id: string; data: Baris }[]).map((r) => [r.id, r.data]));
  const ganti = (k: string, v: unknown): unknown => {
    const t = m.tipe[k];
    if (Array.isArray(v)) return v.map((x) => ganti(k, x)).join(", ");
    if (typeof v !== "string" || !UUID.test(v)) return v;
    if (t === "orang" || t === "pelanggan") return nama.get(v) ?? "";
    if (t === "rujukan") return String(catatan.get(v)?.[m.ruj[k]] ?? "");
    return v;
  };
  return { baris: baris.map((b) => Object.fromEntries(p.kolom.map((k) => [k, ganti(k, b[k])]))), galat: error };
}
