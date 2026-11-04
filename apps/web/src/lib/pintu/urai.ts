// W-08: urai kiriman pintu data (JSON atau CSV) menjadi jenis + baris. Hanya bentuk yang diurai di sini; isi diperiksa ulang
// database (app.rapikan_baris_pintu), yang menjadi satu-satunya penjaga. Kolom CSV memakai nama bidang JSON yang sama
// (tanpa peka huruf besar) dengan beberapa nama lain yang umum di ekspor aplikasi.
import { createHash } from "node:crypto";

export const JENIS_PINTU = ["penjualan", "pesanan", "mutasi"] as const;
export type JenisPintu = (typeof JENIS_PINTU)[number];
export type Kiriman = { jenis: JenisPintu; baris: Record<string, string | number>[] };
export type HasilUrai = { ok: true; kiriman: Kiriman } | { ok: false; galat: string };

const BIDANG: Record<JenisPintu, string[]> = {
  penjualan: ["tanggal", "nomor", "keterangan", "jumlah", "metode"],
  pesanan: ["nomor", "tanggal", "pelanggan", "uraian", "jumlah", "harga"],
  mutasi: ["tanggal", "keterangan", "cabang", "jumlah", "arah", "saldo"],
};
const ALIAS: Record<string, string> = {
  date: "tanggal", tgl: "tanggal", no: "nomor", number: "nomor", order_id: "nomor", invoice: "nomor", deskripsi: "keterangan",
  description: "keterangan", total: "jumlah", amount: "jumlah", nominal: "jumlah", payment: "metode", pembayaran: "metode",
  customer: "pelanggan", item: "uraian", barang: "uraian", produk: "uraian", qty: "jumlah", kuantitas: "jumlah", price: "harga",
  balance: "saldo", type: "arah", branch: "cabang",
};

function sel(baris: string, pisah: string): string[] {
  const out: string[] = [];
  let kini = "", kutip = false;
  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (c === '"') {
      if (kutip && baris[i + 1] === '"') { kini += '"'; i++; } else kutip = !kutip;
    } else if (c === pisah && !kutip) { out.push(kini.trim()); kini = ""; } else kini += c;
  }
  out.push(kini.trim());
  return out;
}

/** CSV berjudul (koma, titik koma, atau tab) menjadi objek per baris dengan nama bidang pintu data. */
export function csvKeBaris(teks: string, jenis: JenisPintu): Record<string, string>[] | string {
  const garis = teks.replace(/^﻿/, "").split(/\r?\n/).filter((g) => g.trim());
  if (garis.length < 2) return "CSV butuh baris judul dan minimal satu baris data.";
  const j = garis[0];
  const pisah = j.includes("\t") ? "\t" : (j.match(/;/g)?.length ?? 0) > (j.match(/,/g)?.length ?? 0) ? ";" : ",";
  const judul = sel(j, pisah).map((x) => { const k = x.toLowerCase().replace(/\s+/g, "_"); return ALIAS[k] ?? k; });
  const kenal = new Set(BIDANG[jenis]);
  if (!judul.some((x) => kenal.has(x))) return `Judul kolom tidak dikenali. Untuk ${jenis} pakai: ${BIDANG[jenis].join(", ")}.`;
  return garis.slice(1).map((g) => {
    const s = sel(g, pisah);
    return Object.fromEntries(judul.map((k, i) => [k, s[i] ?? ""]).filter(([k]) => kenal.has(k)));
  });
}

const jenisSah = (x: unknown): x is JenisPintu => typeof x === "string" && (JENIS_PINTU as readonly string[]).includes(x);

/**
 * Bentuk yang diterima:
 * - JSON {"jenis": "penjualan", "baris": [...]} (jenis boleh juga lewat ?jenis=), atau JSON larik baris dengan ?jenis=;
 * - CSV (Content-Type text/csv) dengan ?jenis=.
 */
export function uraiKiriman(contentType: string, isi: string, jenisQuery: string | null): HasilUrai {
  const ct = contentType.toLowerCase();
  if (ct.includes("csv") || ct.startsWith("text/plain")) {
    if (!jenisSah(jenisQuery)) return { ok: false, galat: "Untuk CSV, tulis jenis di alamat: ?jenis=penjualan, pesanan, atau mutasi." };
    const b = csvKeBaris(isi, jenisQuery);
    return typeof b === "string" ? { ok: false, galat: b } : { ok: true, kiriman: { jenis: jenisQuery, baris: b } };
  }
  let data: unknown;
  try {
    data = JSON.parse(isi);
  } catch {
    return { ok: false, galat: "Isi bukan JSON yang sah. Kirim JSON, atau CSV dengan Content-Type text/csv." };
  }
  const objek = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const jenis = objek?.jenis ?? jenisQuery;
  const baris = Array.isArray(data) ? data : objek?.baris;
  if (!jenisSah(jenis)) return { ok: false, galat: "Jenis wajib: penjualan, pesanan, atau mutasi." };
  if (!Array.isArray(baris)) return { ok: false, galat: "Kirim larik baris di bidang \"baris\"." };
  return { ok: true, kiriman: { jenis, baris: baris as Record<string, string | number>[] } };
}

/** Kunci kiriman: dari Idempotency-Key bila ada, selain itu dari isi kiriman. Kiriman sama = usulan sama. */
export function kunciKiriman(kunciHeader: string | null, k: Kiriman): string {
  const dasar = kunciHeader?.trim() ? `kunci:${kunciHeader.trim()}` : `isi:${k.jenis}:${JSON.stringify(k.baris)}`;
  const h = createHash("sha256").update(dasar).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
