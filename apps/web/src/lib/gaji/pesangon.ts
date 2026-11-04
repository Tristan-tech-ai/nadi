// Cadangan pesangon (F4-09, docs/research/pesangon-f4-09.md). Perkiraan skenario dasar 1 kali PP 35/2021 Pasal 40 ayat (2)
// (uang pesangon) + ayat (3) (uang penghargaan masa kerja), dengan dasar upah pokok + tunjangan tetap (Pasal 157 UU 6/2023).
// Rentang: pengali alasan PHK (Pasal 41-57) hanya mengenai uang pesangon, UPMK tetap 1 kali. Tabel dan pengali dibaca dari
// aturan_bertanggal kunci pesangon.pp35. Belum final: jumlah sungguhan tergantung alasan berhenti dan aturan yang berlaku saat itu.
// F4-09B: karyawan kontrak (PKWT, ada orang.data.kontrak_selesai) dihitung uang kompensasi PP 35/2021 Pasal 16 ayat (1):
// masa kerja (bulan penuh) / 12 x 1 bulan upah, sampai hari ini (Pasal 17), minimal 1 bulan masa kerja (Pasal 15 ayat (3));
// untuk usaha mikro dan kecil besarnya berdasarkan kesepakatan (Pasal 16 ayat (6)), jadi angka ini acuan. Iuran dana pensiun
// pengusaha (Pasal 58) mengurangi kekurangan pesangon + UPMK orang itu, paling banyak sebesar kewajibannya, bukan kompensasi PKWT.

/** Tabel [batas masa kerja dalam tahun penuh, bulan upah], urut naik. */
export type TabelBulan = [number, number][];
export type AturanPesangon = { pesangon: TabelBulan; upmk: TabelBulan; pengali: { rugi: number; pensiun: number } };
export type OrangPesangon = {
  id: string;
  nama: string;
  mulai: string | null;
  kontrak_selesai: string | null;
  pokok: number | null;
  tunjangan_tetap: number | null;
  /** Iuran dana pensiun yang sudah dibayar usaha untuk orang ini (Pasal 58; bukan BPJS JP), isian pemilik. */
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
  /** Bagian kewajiban yang sudah tertutup iuran dana pensiun pengusaha (Pasal 58). */
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
