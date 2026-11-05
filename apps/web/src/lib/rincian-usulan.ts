// U-13 rincian usulan: hasil RPC preview_proposal menjadi bagian yang dibaca manusia: yang akan ditambah, yang akan diubah
// (sebelum -> sesudah), yang dilewati karena sudah ada, dan isi lainnya. Tanpa JSON mentah; id teknis tidak ditampilkan.
import type { Bahasa } from "@/lib/i18n/bahasa";
import { formatRupiah } from "@/lib/format";

export type Pratinjau = {
  aksi: string; bidang: Record<string, unknown> | null; baris: unknown; atas: Record<string, unknown> | null;
  sebelum: Record<string, unknown> | null; lewati: string[] | null; nama: Record<string, string> | null;
};
export type Pasangan = [string, string];
export type Rincian = { tambah: { judul: string; isi: Pasangan[] }[]; ubah: { label: string; sebelum: string; sesudah: string }[]; lewati: string[]; isi: Pasangan[] };

const LABEL: Record<string, [string, string]> = {
  nama: ["Nama", "Name"], jabatan: ["Topi", "Hat"], mulai: ["Mulai", "Start"], tanggal: ["Tanggal", "Date"], pemasok: ["Pemasok", "Supplier"],
  penjual: ["Penjual", "Seller"], pembeli: ["Pembeli", "Buyer"], nomor: ["Nomor", "Number"], total: ["Total", "Total"], jatuh_tempo: ["Jatuh tempo", "Due"],
  jumlah: ["Jumlah", "Amount"], kategori: ["Kategori", "Category"], keterangan: ["Keterangan", "Description"], masuk: ["Masuk", "In"], pulang: ["Pulang", "Out"],
  arah: ["Arah", "Direction"], saldo: ["Saldo", "Balance"], kode: ["Kode", "Code"], stok: ["Stok", "Stock"], satuan: ["Satuan", "Unit"],
  harga_jual: ["Harga jual", "Price"], qty: ["Banyak", "Qty"], harga: ["Harga", "Price"], periode: ["Periode", "Period"], bruto: ["Bruto", "Gross"],
  neto: ["Diterima", "Net"], gaji_pokok: ["Gaji pokok", "Base pay"], posisi: ["Posisi", "Position"], keahlian: ["Keahlian", "Skills"],
  pengalaman: ["Pengalaman", "Experience"], alasan: ["Alasan", "Reason"], jenis: ["Jenis", "Type"], otomatis: ["Disetujui otomatis", "Automatic"],
  maks_hari: ["Otomatis sampai (hari)", "Automatic up to (days)"], butuh_bukti: ["Wajib bukti", "Proof required"], jatah_tahunan: ["Jatah setahun (hari)", "Yearly quota (days)"],
  skala: ["Jumlah orang", "Headcount"], cabang: ["Cabang", "Branches"], kota: ["Kota", "City"], negara: ["Negara", "Country"], isi: ["Isi berkas", "File content"],
  hari: ["Lama (hari)", "Days"], selesai: ["Selesai", "End"], telepon: ["Telepon", "Phone"], tunjangan: ["Tunjangan", "Allowances"], potongan: ["Potongan", "Deductions"],
  lembur: ["Lembur", "Overtime"], persen: ["Porsi", "Share"], minggu: ["Minggu", "Weeks"], berkas: ["Berkas", "File"], format: ["Format", "Format"],
  nik: ["NIK", "ID number"], jenis_kelamin: ["Jenis kelamin", "Sex"], tanggal_lahir: ["Tanggal lahir", "Birth date"],
};
const UANG = new Set(["total", "jumlah", "harga", "saldo", "bruto", "neto", "gaji_pokok", "harga_jual", "pokok", "lembur"]);
const SEMBUNYI = /^(id|.*_id|kunci|uji|ringkasan|jenis_berkas)$/;
// Kolom jumlah barang (bukan uang) di baris stok dan produk.
const BUKAN_UANG: Record<string, string[]> = { "stok.opname": ["jumlah"], "pindah.produk": ["stok"], "produk.impor": ["stok"] };

const label = (k: string, b: Bahasa) => LABEL[k]?.[b === "en" ? 1 : 0] ?? k.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

function nilai(k: string, v: unknown, b: Bahasa, aksi = ""): string {
  if (v === null || v === undefined || v === "") return "-";
  if (typeof v === "boolean") return v ? (b === "en" ? "Yes" : "Ya") : (b === "en" ? "No" : "Tidak");
  if (typeof v === "number") return UANG.has(k) && !BUKAN_UANG[aksi]?.includes(k) ? formatRupiah(v) : String(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x ? Object.values(x as Record<string, unknown>).filter(Boolean).join(", ") : String(x))).join("; ");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([a, x]) => `${label(a, b)} ${nilai(a, x, b, aksi)}`).join(", ");
  return String(v);
}

const pasangan = (o: Record<string, unknown>, b: Bahasa, aksi: string, nama: Record<string, string> = {}): Pasangan[] =>
  Object.entries(o).filter(([k]) => !SEMBUNYI.test(k) || k === "orang_id").filter(([k]) => k !== "baris")
    .map(([k, v]) => (k === "orang_id" ? [b === "en" ? "Person" : "Orang", nama[String(v)] ?? "-"] : [label(k, b), nilai(k, v, b, aksi)]) as Pasangan);

export function rincian(p: Pratinjau, b: Bahasa = "id"): Rincian {
  const bidang = p.bidang ?? {};
  const sebelum = p.sebelum ?? {};
  const nama = p.nama ?? {};
  const lewati = (p.lewati ?? []).map(String);
  const hasil: Rincian = { tambah: [], ubah: [], lewati, isi: [] };
  const barisSumber = Array.isArray(bidang.baris) ? bidang.baris : Array.isArray(p.baris) ? p.baris : null;

  if (p.aksi === "onboarding.izin" || p.aksi === "onboarding.usaha") {
    for (const [k, v] of Object.entries(bidang)) {
      if (k === "jenis" && p.aksi === "onboarding.izin") continue;
      hasil.ubah.push({ label: label(k, b), sebelum: Object.keys(sebelum).length ? nilai(k, sebelum[k], b) : (b === "en" ? "not set" : "belum diatur"), sesudah: nilai(k, v, b) });
    }
    if (p.aksi === "onboarding.izin") hasil.isi.push([label("jenis", b), nilai("jenis", bidang.jenis, b)]);
    return hasil;
  }
  if (p.aksi === "stok.opname" && barisSumber) {
    for (const r of barisSumber as Record<string, unknown>[])
      hasil.ubah.push({ label: `${r.nama ?? r.kode} (${r.kode})`, sebelum: String(sebelum[String(r.kode)] ?? 0), sesudah: String(r.jumlah ?? "-") });
    return hasil;
  }
  if (p.aksi === "orang.topi") {
    const atas = p.atas ?? {};
    hasil.isi.push([b === "en" ? "Person" : "Orang", nama[String(atas.orang_id)] ?? "-"]);
    hasil.ubah.push({ label: label("jabatan", b), sebelum: String(sebelum.topi ?? "-"), sesudah: `${nama.topi_baru ?? "-"} ${atas.persen ?? ""}%`.trim() });
    return hasil;
  }
  if (barisSumber) {
    const kunciLewat = (r: Record<string, unknown>) => String(p.aksi.includes("produk") ? r.kode : r.nama ?? "").toLowerCase();
    const lewatSet = new Set(lewati.map((x) => x.toLowerCase()));
    for (const r of barisSumber.slice(0, 50) as Record<string, unknown>[]) {
      if (lewatSet.has(kunciLewat(r))) continue;
      hasil.tambah.push({ judul: String(r.nama ?? r.keterangan ?? r.kode ?? r.tanggal ?? ""), isi: pasangan(r, b, p.aksi, nama) });
    }
  }
  const sisa = { ...(p.atas ?? {}), ...bidang };
  hasil.isi = pasangan(sisa, b, p.aksi, nama);
  if (!barisSumber && /^(orang\.buat|rekrut\.pelamar)$/.test(p.aksi) && !lewati.length) {
    hasil.tambah.push({ judul: String(bidang.nama ?? ""), isi: hasil.isi });
    hasil.isi = [];
  }
  return hasil;
}
