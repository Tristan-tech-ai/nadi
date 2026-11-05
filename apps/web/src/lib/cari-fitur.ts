// U-02 cari fitur: kata sehari-hari (Indonesia atau Inggris) ke halaman di peta ruang, tanpa model. Skor dari kecocokan label,
// kata cari (sinonim), dan kalimat guna; awalan kata ikut dihitung supaya "gaj" sudah menemukan Gaji.
import { SEMUA_HALAMAN, type Halaman } from "@/lib/ruang";

export type HasilCari = Halaman & { ruang: string; skor: number };

const norma = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** boleh: href yang memang tampil untuk sesi ini (mis. staf tanpa rencana magang); tanpa boleh, peran saja yang menyaring. */
export function cariFitur(kata: string, peran: string, bahasa: "id" | "en" = "id", batas = 8, boleh?: ReadonlySet<string>): HasilCari[] {
  const q = norma(kata);
  if (q.length < 2) return [];
  const token = q.split(" ");
  const hasil: HasilCari[] = [];
  for (const h of SEMUA_HALAMAN) {
    if (!(h.peran as readonly string[]).includes(peran) || (boleh && !boleh.has(h.href))) continue;
    const label = norma(`${h.label.id} ${h.label.en}`);
    const sinonim = norma(h.cari ?? "");
    const guna = norma(`${h.guna.id} ${h.guna.en}`);
    const kataLabel = label.split(" "), kataSinonim = sinonim.split(" "), kataGuna = guna.split(" ");
    let skor = 0;
    if (norma(h.label[bahasa]) === q) skor += 100;
    for (const t of token) {
      if (kataLabel.includes(t)) skor += 30; else if (kataLabel.some((w) => w.startsWith(t))) skor += 18;
      if (kataSinonim.includes(t)) skor += 25; else if (t.length >= 3 && kataSinonim.some((w) => w.startsWith(t))) skor += 12;
      if (kataGuna.includes(t)) skor += 6; else if (t.length >= 4 && kataGuna.some((w) => w.startsWith(t))) skor += 3;
    }
    if (skor > 0) hasil.push({ ...h, skor });
  }
  return hasil.sort((a, b) => b.skor - a.skor || a.href.length - b.href.length).slice(0, batas);
}
