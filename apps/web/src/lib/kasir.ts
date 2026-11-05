// M-19: keranjang dan antrean luring kasir. Setiap penjualan memakai kunci uuid dari perangkat; database (pos_record_sale) idempoten
// per kunci, jadi antrean aman dikirim ulang setelah sinyal putus di tengah pengiriman.
export type Produk = { id: string; kode: string; nama: string; harga: number; satuan: string; barcode: string | null; jenis: string; stok: number | null };
export type Baris = { produk: string; nama: string; harga: number; jumlah: number };
export type Antre = { kunci: string; shift: string; waktu: string; baris: { produk: string; jumlah: number }[]; bayar: "tunai" | "qris" | "transfer"; diterima: number | null; total: number; galat?: string };

export function tambah(k: Baris[], p: Pick<Produk, "id" | "nama" | "harga">, n = 1): Baris[] {
  const ada = k.find((b) => b.produk === p.id);
  if (ada) return k.map((b) => (b.produk === p.id ? { ...b, jumlah: b.jumlah + n } : b));
  return [...k, { produk: p.id, nama: p.nama, harga: p.harga, jumlah: n }];
}

export function kurangi(k: Baris[], id: string): Baris[] {
  return k.flatMap((b) => (b.produk !== id ? [b] : b.jumlah > 1 ? [{ ...b, jumlah: b.jumlah - 1 }] : []));
}

export const totalKeranjang = (k: Baris[]) => k.reduce((s, b) => s + Math.round(b.harga * b.jumlah), 0);

/** Cari produk: barcode atau kode persis dulu (pemindai menulis kode lalu Enter), lalu nama mengandung kata. */
export function cari(daftar: Produk[], q: string): Produk[] {
  const t = q.trim().toLowerCase();
  if (!t) return daftar;
  const persis = daftar.filter((p) => p.barcode === q.trim() || p.kode.toLowerCase() === t);
  return persis.length ? persis : daftar.filter((p) => p.nama.toLowerCase().includes(t));
}

const KUNCI = "nadi-kasir-antrean";
export function bacaAntrean(s: Pick<Storage, "getItem"> | null): Antre[] {
  try { return JSON.parse(s?.getItem(KUNCI) ?? "[]") as Antre[]; } catch { return []; }
}
export function simpanAntrean(s: Pick<Storage, "setItem"> | null, a: Antre[]) {
  try { s?.setItem(KUNCI, JSON.stringify(a)); } catch { /* penyimpanan diblokir: antrean hanya di memori tab */ }
}
