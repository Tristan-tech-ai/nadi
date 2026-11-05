// U-04 draf AI: Teks Nadi (atau baris JSON dari AI lewat MCP) menjadi baris draf per bagian. Database (app.ai_draft_row) merapikan
// dan memeriksa ulang setiap baris; di sini hanya pemetaan bentuk. Fitur lama Teks Nadi dipetakan ke modul menu U-06; fitur inti
// (Feed, gaji, invoice, dan lain-lain) selalu tampil sehingga tidak menjadi baris.
import type { Butir } from "@/lib/onboarding/teks-nadi";

export type Bagian = "usaha" | "fitur" | "izin" | "topi" | "orang" | "gaji";
export const URUT_BAGIAN: Bagian[] = ["orang", "gaji", "topi", "izin", "fitur", "usaha"];
export type BarisMasuk = { bagian: Bagian; nilai: Record<string, unknown>; alasan?: string; keyakinan?: number };
export type BarisDraf = Omit<BarisMasuk, "alasan" | "keyakinan"> & { id: string; ragu: string | null; peka: boolean; centang: boolean; keyakinan: number | null; alasan: string | null };

const MODUL_DARI_FITUR: Record<string, string> = { barang: "stok", mata: "mata", peta: "mata", jual: "crm" };

export function barisDariButir(butir: Butir[], sumber = "Teks Nadi"): BarisMasuk[] {
  const hasil: BarisMasuk[] = [];
  for (const b of butir) {
    const f = b.bidang as Record<string, unknown>;
    if (b.aksi === "orang.impor") {
      const o = ((f.baris as Record<string, unknown>[]) ?? [])[0] ?? {};
      hasil.push({ bagian: "orang", nilai: { nama: o.nama, jabatan: o.jabatan ?? "", mulai: o.mulai ?? "" }, alasan: `Dari ${sumber}` });
    } else if (b.aksi === "onboarding.usaha") {
      hasil.push({ bagian: "usaha", nilai: { skala: f.skala, cabang: f.cabang, kota: f.kota, negara: f.negara }, alasan: `Dari ${sumber}` });
    } else if (b.aksi === "onboarding.izin") {
      hasil.push({ bagian: "izin", nilai: { jenis: f.jenis, otomatis: f.otomatis, maks_hari: f.maks_hari, butuh_bukti: f.butuh_bukti, jatah_tahunan: f.jatah_tahunan }, alasan: `Dari ${sumber}` });
    } else if (b.aksi === "onboarding.fitur") {
      const modul = new Set(((f.fitur as string[]) ?? []).map((x) => MODUL_DARI_FITUR[x]).filter(Boolean));
      for (const m of modul) hasil.push({ bagian: "fitur", nilai: { modul: m, nyala: true }, alasan: `Dari ${sumber}` });
    }
  }
  return hasil;
}

/** Kolom yang bisa diubah per bagian, dengan jenis isian. Urutan = urutan kolom tabel tinjau. */
export const KOLOM: Record<Bagian, { kunci: string; jenis: "teks" | "angka" | "tanggal" | "pilih" | "ya"; pilihan?: string[] }[]> = {
  orang: [{ kunci: "nama", jenis: "teks" }, { kunci: "jabatan", jenis: "teks" }, { kunci: "mulai", jenis: "tanggal" }],
  gaji: [{ kunci: "nama", jenis: "teks" }, { kunci: "pokok", jenis: "angka" }],
  topi: [{ kunci: "nama", jenis: "teks" }],
  izin: [{ kunci: "jenis", jenis: "pilih", pilihan: ["sakit", "izin", "cuti"] }, { kunci: "otomatis", jenis: "ya" }, { kunci: "maks_hari", jenis: "angka" }, { kunci: "butuh_bukti", jenis: "ya" }, { kunci: "jatah_tahunan", jenis: "angka" }],
  fitur: [{ kunci: "modul", jenis: "pilih", pilihan: ["kasir", "stok", "produksi", "dagang_luar", "servis", "janji", "proyek", "mata", "crm", "layanan"] }, { kunci: "nyala", jenis: "ya" }],
  usaha: [{ kunci: "skala", jenis: "pilih", pilihan: ["1", "2-5", "6-15", "16-50", "50+"] }, { kunci: "cabang", jenis: "angka" }, { kunci: "kota", jenis: "teks" }, { kunci: "negara", jenis: "teks" }],
};

/** Ubah teks isian menjadi nilai untuk database (angka, boolean, atau teks). */
export function nilaiIsian(jenis: string, teks: string): unknown {
  if (jenis === "angka") return teks.replace(/[^\d]/g, "") === "" ? null : Number(teks.replace(/[^\d]/g, ""));
  if (jenis === "ya") return teks === "true" || teks === "ya" || teks === "on";
  return teks.trim();
}

/** Urutan tampil: yang perlu dicek di atas, lalu per bagian. */
export function urutkan(baris: BarisDraf[]): BarisDraf[] {
  return [...baris].sort((a, b) => Number(!a.ragu) - Number(!b.ragu) || URUT_BAGIAN.indexOf(a.bagian) - URUT_BAGIAN.indexOf(b.bagian));
}
