// M-20 formulir kustom: pemilik menulis isian satu per baris, bahasa sehari-hari, lalu diurai menjadi definisi bidang untuk
// RPC save_form. Format baris: "Label", "Label: angka", "Label: tanggal", "Label: pilih a, b, c"; awali dengan * bila wajib.
// Kode isian (kunci) dibuat dari label: huruf kecil, spasi jadi garis bawah, unik dalam satu formulir.

export type Bidang = { kunci: string; label: string; jenis: "teks" | "angka" | "tanggal" | "pilihan"; wajib: boolean; pilihan?: string[] };
export type HasilUrai = { bidang: Bidang[] } | { galat: "kosong" | "terlalu_banyak" | "pilihan_kurang" | "label_panjang"; baris?: number };

const DICADANGKAN = new Set(["formulir", "nama_formulir", "jenis", "nilai"]);

export function kunciDari(label: string, dipakai: Set<string>): string {
  let dasar = label.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  if (!/^[a-z]/.test(dasar)) dasar = `isian_${dasar}`.replace(/_+$/, "").slice(0, 24);
  if (DICADANGKAN.has(dasar)) dasar = `${dasar}_isian`;
  let k = dasar;
  for (let i = 2; dipakai.has(k); i++) k = `${dasar}_${i}`;
  dipakai.add(k);
  return k;
}

export function uraiIsian(teks: string): HasilUrai {
  const baris = teks.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (baris.length === 0) return { galat: "kosong" };
  if (baris.length > 20) return { galat: "terlalu_banyak" };
  const dipakai = new Set<string>();
  const bidang: Bidang[] = [];
  for (const [i, b] of baris.entries()) {
    const wajib = b.startsWith("*");
    const isi = wajib ? b.slice(1).trim() : b;
    const m = /^(.*?)\s*:\s*(angka|tanggal|pilih(?:an)?\b(.*))\s*$/i.exec(isi);
    const label = (m ? m[1] : isi).trim();
    if (!label || label.length > 80) return { galat: "label_panjang", baris: i + 1 };
    const jenisTeks = m?.[2].toLowerCase() ?? "";
    let jenis: Bidang["jenis"] = "teks";
    let pilihan: string[] | undefined;
    if (jenisTeks === "angka") jenis = "angka";
    else if (jenisTeks === "tanggal") jenis = "tanggal";
    else if (jenisTeks.startsWith("pilih")) {
      jenis = "pilihan";
      pilihan = [...new Set((m?.[3] ?? "").split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 10);
      if (pilihan.length < 2) return { galat: "pilihan_kurang", baris: i + 1 };
    }
    bidang.push({ kunci: kunciDari(label, dipakai), label, jenis, wajib, ...(pilihan ? { pilihan } : {}) });
  }
  return { bidang };
}
