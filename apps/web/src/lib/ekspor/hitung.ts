// B-EKSIM1: hitungan invoice ekspor USD yang sama dengan public.buat_invoice_ekspor (nilai baris = jumlah x harga dibulatkan sen,
// rupiah = total USD x kurs dibulatkan). Dipakai pratinjau formulir; angka akhir tetap dari database.

/** "7.35", "7,35", "1,224.50", "1.224,50" -> angka. Bila ada titik dan koma, pemisah terakhir adalah desimal. */
export function angkaDesimal(s: string): number {
  const t = s.replace(/\s/g, "");
  if (!t || !/^[0-9.,]+$/.test(t)) return Number.NaN;
  const titik = t.lastIndexOf(".");
  const koma = t.lastIndexOf(",");
  if (titik >= 0 && koma >= 0) {
    const desimal = titik > koma ? "." : ",";
    const ribuan = desimal === "." ? "," : ".";
    return Number(t.split(ribuan).join("").replace(desimal, "."));
  }
  return Number(t.replace(",", "."));
}

/** Kurs rupiah gaya Indonesia: "16.287,50" -> 16287.5 (titik ribuan, koma desimal, awalan Rp boleh). */
export function angkaKurs(s: string): number {
  const t = s.replace(/\s/g, "").replace(/^Rp/i, "");
  if (!t || !/^[0-9.,]+$/.test(t)) return Number.NaN;
  return Number(t.split(".").join("").replace(",", "."));
}

export type BarisHitung = { jumlah: number; harga: number; bersih: number; kotor: number; koli: number };

const ok = (n: number) => Number.isFinite(n) && n >= 0;

/** Total dalam sen USD (bilangan bulat, bebas galat pecahan) dan isi packing list. */
export function totalEkspor(baris: BarisHitung[]) {
  let sen = 0;
  let bersih = 0;
  let kotor = 0;
  let koli = 0;
  for (const b of baris) {
    if (ok(b.jumlah) && ok(b.harga)) sen += Math.round(b.jumlah * Math.round(b.harga * 100));
    if (ok(b.bersih)) bersih += Math.round(b.bersih * 1000);
    if (ok(b.kotor)) kotor += Math.round(b.kotor * 1000);
    if (ok(b.koli)) koli += Math.trunc(b.koli);
  }
  return { sen, bersih: bersih / 1000, kotor: kotor / 1000, koli };
}

export const rupiahDariSen = (sen: number, kurs: number) => Math.round((sen * kurs) / 100);

const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const bulat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const biasa = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });

export const formatUsd = (sen: number) => `USD ${usd.format(sen / 100)}`;
export const formatUsdAngka = (nilai: number) => usd.format(nilai);
export const formatIdrEn = (rupiah: number) => `IDR ${bulat.format(rupiah)}`;
/** Berat kg tiga angka di belakang koma; dokumen Inggris "1,227.700", layar Indonesia "1.227,700". */
export const formatBerat = (kg: number, bahasa: string = "en") =>
  new Intl.NumberFormat(bahasa === "id" ? "id-ID" : "en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(kg);
export const formatAngkaEn = (n: number) => biasa.format(n);

/** Kurs rupiah per USD apa adanya (sampai 4 angka di belakang koma): "Rp16.287,5" (id), "Rp16,287.5" (en). */
export const formatKurs = (kurs: number, bahasa: string = "id") =>
  `Rp${new Intl.NumberFormat(bahasa === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 4 }).format(kurs)}`;

/** Incoterms 2020 (ICC, berlaku 1 Jan 2020; DAT diganti DPU). */
export const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"] as const;
