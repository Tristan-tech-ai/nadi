// Cadangan pesangon (F4-09) dan kalkulator pesangon, diperbarui ke UU 27/2026 tentang Pelindungan Ketenagakerjaan (R-UUPK2,
// docs/research/uu-27-2026-cocok.md). Tabel uang pesangon dan uang penghargaan masa kerja (UPMK) UU 27/2026 Pasal 232 ayat (2) dan (3),
// dasar upah pokok + tunjangan tetap (Pasal 234). Pengali per alasan PHK (Pasal 236 sampai 249) dan uang pisah paling sedikit
// 1 bulan upah (Pasal 233 ayat (2)) dibaca dari aturan_bertanggal pesangon.uu27 (berlaku 28 Okt 2026); PHK sebelum itu memakai
// pesangon.pp35 (PP 35/2021 Pasal 40, 43, 56). Usaha mikro dan kecil membayar menurut kesepakatan (Pasal 250), jadi angkanya acuan.
// Karyawan kontrak (PKWT, ada orang.data.kontrak_selesai) dihitung uang kompensasi (UU 27/2026 Pasal 88, rinciannya PP 35/2021
// Pasal 15 sampai 17 yang tetap berlaku menurut Pasal 310): masa kerja (bulan penuh) / 12 x 1 bulan upah, minimal 1 bulan masa kerja.
// Iuran program pensiun yang dibayar penuh usaha (Pasal 248) mengurangi kekurangan pesangon + UPMK orang itu, paling banyak sebesar
// kewajibannya, bukan kompensasi PKWT.
import type { PetaAturan } from "@/lib/gaji/susun";

/** Tabel [batas masa kerja dalam tahun penuh, bulan upah], urut naik. */
export type TabelBulan = [number, number][];
/** Pengali satu alasan PHK (UU 27/2026 Pasal 236-249): kali uang pesangon, kali UPMK, dan apakah berhak uang pisah. */
export type AlasanPhk = { kode: string; pasal: string; pesangon: number; upmk: number; pisah: boolean };
export type AturanPesangon = {
  pesangon: TabelBulan; upmk: TabelBulan; pengali: { rugi: number; pensiun: number };
  alasan?: AlasanPhk[]; uang_pisah_min_bulan?: number; mikro_kecil_kesepakatan?: boolean;
};
export type OrangPesangon = {
  id: string;
  nama: string;
  mulai: string | null;
  kontrak_selesai: string | null;
  pokok: number | null;
  tunjangan_tetap: number | null;
  /** Iuran program pensiun yang sudah dibayar usaha untuk orang ini (UU 27/2026 Pasal 248; bukan BPJS JP), isian pemilik. */
  iuran_pensiun?: number | null;
};
/** Aturan kompensasi PKWT (aturan_bertanggal kompensasi.pkwt). */
export type AturanKompensasi = { pembagi_bulan: number; minimal_bulan: number };
export type StatusPesangon = "dihitung" | "kompensasi" | "tanpa_mulai" | "belum_mulai" | "tanpa_gaji" | "kontrak";
export type BarisPesangon = {
  id: string;
  nama: string;
  status: StatusPesangon;
  masaBulan: number | null;
  upah: number;
  bulanPesangon: number;
  bulanUpmk: number;
  dasar: number;
  rugi: number;
  pensiun: number;
  /** Bagian kewajiban yang sudah tertutup iuran program pensiun pengusaha (UU 27/2026 Pasal 248). */
  tertutupPensiun: number;
};

function tanggal(t: string | null): [number, number, number] | null {
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  return u.getUTCFullYear() === y && u.getUTCMonth() === m - 1 && u.getUTCDate() === d ? [y, m, d] : null;
}

/** Masa kerja dalam bulan penuh dari tanggal mulai sampai hari ini (keduanya YYYY-MM-DD di zona usaha); null bila tidak sah. */
export function masaKerjaBulan(mulai: string | null, hari: string): number | null {
  const a = tanggal(mulai);
  const b = tanggal(hari);
  if (!a || !b) return null;
  const bulan = (b[0] - a[0]) * 12 + (b[1] - a[1]) - (b[2] < a[2] ? 1 : 0);
  return bulan < 0 ? null : bulan;
}

/** Bulan upah untuk masa kerja (tahun penuh) menurut tabel: baris terakhir yang batasnya sudah dicapai, 0 bila belum ada. */
export function bulanMenurut(tabel: TabelBulan, tahun: number): number {
  let n = 0;
  for (const [batas, bulan] of tabel) if (tahun >= batas) n = bulan;
  return n;
}

const kosong = (o: OrangPesangon, status: StatusPesangon, masaBulan: number | null, upah: number): BarisPesangon => ({
  id: o.id, nama: o.nama, status, masaBulan, upah, bulanPesangon: 0, bulanUpmk: 0, dasar: 0, rugi: 0, pensiun: 0, tertutupPensiun: 0,
});

export function hitungPesangon(o: OrangPesangon, aturan: AturanPesangon, hari: string, kompensasi: AturanKompensasi | null = null): BarisPesangon {
  const masa = masaKerjaBulan(o.mulai, hari);
  const upah = (o.pokok ?? 0) + (o.tunjangan_tetap ?? 0);
  // Karyawan kontrak tanpa aturan kompensasi terverifikasi tidak dihitung (tabel Pasal 40 bukan untuk PKWT).
  if (o.kontrak_selesai && !kompensasi) return kosong(o, "kontrak", masa, upah);
  if (masa === null) return kosong(o, tanggal(o.mulai) ? "belum_mulai" : "tanpa_mulai", null, upah);
  if (!o.pokok || o.pokok <= 0) return kosong(o, "tanpa_gaji", masa, upah);
  if (o.kontrak_selesai && kompensasi) {
    const nilai = masa < kompensasi.minimal_bulan ? 0 : Math.floor((upah * masa) / kompensasi.pembagi_bulan);
    return { ...kosong(o, "kompensasi", masa, upah), dasar: nilai, rugi: nilai, pensiun: nilai };
  }
  const tahun = Math.floor(masa / 12);
  const p = bulanMenurut(aturan.pesangon, tahun);
  const u = bulanMenurut(aturan.upmk, tahun);
  const upmk = upah * u;
  return {
    id: o.id, nama: o.nama, status: "dihitung", masaBulan: masa, upah, bulanPesangon: p, bulanUpmk: u,
    dasar: upah * p + upmk,
    rugi: Math.floor(upah * p * aturan.pengali.rugi) + upmk,
    pensiun: Math.floor(upah * p * aturan.pengali.pensiun) + upmk,
    tertutupPensiun: Math.min(Math.max(0, Math.floor(o.iuran_pensiun ?? 0)), upah * p + upmk),
  };
}

/** Aturan pesangon yang berlaku: pesangon.uu27 (UU 27/2026) bila terverifikasi, selain itu pesangon.pp35. */
export function pilihAturanPesangon(peta: PetaAturan): AturanPesangon | null {
  for (const k of ["pesangon.uu27", "pesangon.pp35"]) if (peta[k]?.terverifikasi) return peta[k]!.nilai as AturanPesangon;
  return null;
}

/** Hak satu orang untuk satu alasan PHK; null bila alasan itu tidak ada di aturan (mis. efisiensi, yang tidak ada di UU 27/2026). */
export function hitungAlasan(b: BarisPesangon, aturan: AturanPesangon, kode: string) {
  const a = aturan.alasan?.find((x) => x.kode === kode);
  if (!a || b.status !== "dihitung") return null;
  const pesangon = Math.floor(b.upah * b.bulanPesangon * a.pesangon);
  const upmk = Math.floor(b.upah * b.bulanUpmk * a.upmk);
  const pisah = a.pisah ? Math.floor(b.upah * (aturan.uang_pisah_min_bulan ?? 0)) : 0;
  return { alasan: a, pesangon, upmk, pisah, total: pesangon + upmk + pisah };
}

export function ringkasCadangan(baris: BarisPesangon[], saldo: number) {
  const ada = baris.filter((b) => b.status === "dihitung" || b.status === "kompensasi");
  const jumlah = (k: "dasar" | "rugi" | "pensiun") => ada.reduce((n, b) => n + b[k], 0);
  const dasar = jumlah("dasar");
  const tertutupPensiun = ada.reduce((n, b) => n + b.tertutupPensiun, 0);
  const kekurangan = Math.max(0, dasar - tertutupPensiun - Math.max(0, saldo));
  return {
    dasar, rugi: jumlah("rugi"), pensiun: jumlah("pensiun"), dihitung: ada.length, belumDihitung: baris.length - ada.length,
    tertutupPensiun, kekurangan, sisihanSebulan: Math.ceil(kekurangan / 12),
  };
}

export function teksMasaKerja(bulan: number): string {
  const t = Math.floor(bulan / 12);
  const b = bulan % 12;
  if (!t && !b) return "kurang dari 1 bulan";
  return [t ? `${t} tahun` : "", b ? `${b} bulan` : ""].filter(Boolean).join(" ");
}
