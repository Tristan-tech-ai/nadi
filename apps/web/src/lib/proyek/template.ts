// X-12 template proyek ditulis seperti daftar: satu kerja per baris "judul | hari ke- | butir 1; butir 2 | poin".
// Hari ke- dihitung dari tanggal mulai proyek atau periode (0 = hari mulai). Database memeriksa ulang (app.cek_isi_template).
export type KerjaTemplate = { judul: string; hari?: number; poin?: number; butir?: string[] };

export function uraiTemplate(teks: string): { isi: KerjaTemplate[]; galat: string[] } {
  const isi: KerjaTemplate[] = [];
  const galat: string[] = [];
  teks.split(/\r?\n/).map((b) => b.trim()).filter(Boolean).forEach((baris, i) => {
    const [judul, hari, butir, poin] = baris.split("|").map((x) => x.trim());
    if (!judul || judul.length < 3 || judul.length > 300) { galat.push(`Baris ${i + 1}: judul 3 sampai 300 huruf.`); return; }
    const k: KerjaTemplate = { judul };
    if (hari) {
      const n = Number(hari);
      if (!Number.isInteger(n) || n < 0 || n > 365) { galat.push(`Baris ${i + 1}: hari ke- harus 0 sampai 365.`); return; }
      k.hari = n;
    }
    if (butir) {
      const daftar = butir.split(";").map((x) => x.trim()).filter(Boolean);
      if (daftar.length > 20 || daftar.some((x) => x.length > 200)) { galat.push(`Baris ${i + 1}: paling banyak 20 butir, masing-masing 200 huruf.`); return; }
      if (daftar.length) k.butir = daftar;
    }
    if (poin) {
      const p = Number(poin.replace(",", "."));
      if (!Number.isFinite(p) || p < 0 || p > 99) { galat.push(`Baris ${i + 1}: poin 0 sampai 99.`); return; }
      k.poin = p;
    }
    isi.push(k);
  });
  if (!isi.length && !galat.length) galat.push("Tulis minimal satu kerja.");
  if (isi.length > 50) galat.push("Paling banyak 50 kerja per template.");
  return { isi, galat };
}
