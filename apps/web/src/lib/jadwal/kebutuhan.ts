// F3-06C: dari kebutuhan isian pemilik (data_usulan_jadwal) ke usulan jadwal minggu itu lewat susunJadwal, lalu ringkasan simpan
// per baris. Hanya mengusulkan; setiap baris disimpan lewat simpan_shift yang tetap menegakkan batas PP 35/2021.
import { formatTanggalKalender } from "@/lib/format";
import { susunJadwal, type OrangJadwal, type Slot } from "./susun";

export type Kebutuhan = { id: string; topi: string; topi_nama: string; hari: number; mulai: string; selesai: string; istirahat: number; butuh: number };
export type OrangData = { id: string; nama: string; topi: string[]; malam_lalu: number; hari_terisi: number[] };
export type DataUsulan = { mulai: string; pola: "6_hari" | "5_hari"; kebutuhan: Kebutuhan[]; orang: OrangData[] };
export type BarisUsulan = {
  orang: string; nama: string; tanggal: string; hari: number; mulai: string; selesai: string; istirahat: number; topi: string; topi_nama: string; kunci: string;
};

export const NAMA_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const jam = (j: string) => j.replace(":", ".");
const geser = (t: string, n: number) => { const d = new Date(`${t}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Kunci klien simpan_shift yang sama untuk orang, tanggal, dan jam mulai yang sama: simpan dua kali tidak menggandakan. */
export function kunciBaris(orang: string, tanggal: string, mulai: string): string {
  const teks = `${orang}|${tanggal}|${mulai}`;
  let hex = "";
  for (const benih of [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]) {
    let h = benih >>> 0;
    for (let i = 0; i < teks.length; i++) h = Math.imul(h ^ teks.charCodeAt(i), 0x01000193) >>> 0;
    hex += h.toString(16).padStart(8, "0");
  }
  const varian = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${varian}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function usulkan(d: DataUsulan): { baris: BarisUsulan[]; kurang: string[] } {
  const per = new Map(d.kebutuhan.map((k) => [k.id, k]));
  const slot: Slot[] = d.kebutuhan.map((k) => ({ id: k.id, hari: k.hari, mulai: k.mulai, selesai: k.selesai, topi: k.topi, butuh: k.butuh, istirahat: k.istirahat }));
  const orang: OrangJadwal[] = d.orang.map((o) => ({ id: o.id, topi: o.topi, tidakBisa: o.hari_terisi }));
  const nama = new Map(d.orang.map((o) => [o.id, o.nama]));
  const h = susunJadwal(slot, orang, { pola: d.pola, malamLalu: Object.fromEntries(d.orang.map((o) => [o.id, o.malam_lalu])) });
  const baris = h.penugasan.map((p) => {
    const k = per.get(p.slot)!;
    const tanggal = geser(d.mulai, k.hari);
    return { orang: p.orang, nama: nama.get(p.orang) ?? p.orang, tanggal, hari: k.hari, mulai: k.mulai, selesai: k.selesai, istirahat: k.istirahat,
      topi: k.topi, topi_nama: k.topi_nama, kunci: kunciBaris(p.orang, tanggal, k.mulai) };
  });
  const kurang = h.kosong
    .map((x) => ({ x, k: per.get(x.slot)! }))
    .sort((a, b) => a.k.hari - b.k.hari || a.k.mulai.localeCompare(b.k.mulai))
    .map(({ x, k }) => `${NAMA_HARI[k.hari]} ${jam(k.mulai)}-${jam(k.selesai)}: kurang ${x.kurang} ${k.topi_nama.toLowerCase()}. Semua yang memakai topi ini sudah penuh jam atau hari kerjanya, atau sudah dijadwalkan hari itu.`);
  return { baris, kurang };
}

/** Hasil simpan per baris (galat dari simpan_shift tetap ditampilkan, bukan dipaksa). */
export function ringkasSimpan(hasil: { nama: string; tanggal: string; mulai: string; selesai: string; galat?: string }[]): { pesan: string; gagal: string[] } {
  const ok = hasil.filter((h) => !h.galat).length;
  return {
    pesan: `${ok} shift tersimpan.`,
    gagal: hasil.filter((h) => h.galat).map((h) => `${h.nama} ${formatTanggalKalender(h.tanggal)} ${jam(h.mulai)}-${jam(h.selesai)}: ${h.galat}`),
  };
}
