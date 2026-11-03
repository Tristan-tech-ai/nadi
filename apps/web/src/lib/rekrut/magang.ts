// Jalur Magang dan Dana Rekrutmen (F2-06, docs/research/magang.md). Fungsi murni: uang saku, isian rupiah, biaya buku jam,
// dan rencana mingguan. Database memeriksa ulang semuanya (simpan_rencana_magang, catat_jam_rekrut); ini untuk pesan yang jelas.

export const STATUS_RENCANA = { rencana: "Rencana", jalan: "Berjalan", selesai: "Selesai", batal: "Batal" } as const;
export type StatusRencana = keyof typeof STATUS_RENCANA;
export const statusRencanaSah = (s: unknown): s is StatusRencana => typeof s === "string" && s in STATUS_RENCANA;

export type UangSaku = { transport?: number | null; makan?: number | null; insentif?: number | null };
export type BarisMinggu = { minggu: number; keahlian: string; target: string | null };
export type Peringatan = { kode: string; pesan: string; sumber: string; url: string; status: string };

export const MAKS_MINGGU = 52;

/** Total uang saku per bulan; bagian kosong dihitung 0. */
export function totalUangSaku(u: UangSaku | null | undefined): number {
  return (u?.transport ?? 0) + (u?.makan ?? 0) + (u?.insentif ?? 0);
}

/** Isian rupiah bulat: "30.000", "Rp30.000", "30000". Kosong = null; desimal, minus, atau huruf = galat. */
export function bacaRupiahBulat(isian: string): { nilai: number | null } | { galat: true } {
  const s = isian.trim().replace(/^rp\.?\s*/i, "");
  if (!s) return { nilai: null };
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(s)) return { galat: true };
  const n = Number(s.replace(/\./g, ""));
  return Number.isSafeInteger(n) ? { nilai: n } : { galat: true };
}

/** Biaya waktu dari buku jam: menit x tarif per jam / 60, dibulatkan ke rupiah. Tanpa tarif = 0. */
export function biayaJam(menit: number, tarifPerJam: number | null | undefined): number {
  return tarifPerJam == null ? 0 : Math.round((menit * tarifPerJam) / 60);
}

export const menitSah = (n: number) => Number.isInteger(n) && n >= 1 && n <= 600;

/** 90 -> "1 jam 30 menit", 45 -> "45 menit", 120 -> "2 jam". */
export function formatLamaMenit(menit: number, bahasa: "id" | "en" = "id"): string {
  const [jm, mnt] = bahasa === "en" ? ["h", "min"] : ["jam", "menit"];
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  if (j === 0) return `${m} ${mnt}`;
  return m ? `${j} ${jm} ${m} ${mnt}` : `${j} ${jm}`;
}

/** Baris isian mingguan dari formulir (semua teks). Baris yang seluruhnya kosong dibuang. */
export function rapikanMinggu(isian: { minggu: string; keahlian: string; target: string }[]): { baris: BarisMinggu[] } | { galat: string } {
  const terisi = isian
    .map((b) => ({ minggu: b.minggu.trim(), keahlian: b.keahlian.trim(), target: b.target.trim() }))
    .filter((b) => b.minggu || b.keahlian || b.target);
  if (terisi.length > MAKS_MINGGU) return { galat: `Rencana mingguan paling banyak ${MAKS_MINGGU} baris; sekarang ${terisi.length}.` };
  const baris: BarisMinggu[] = [];
  for (const [i, b] of terisi.entries()) {
    const no = `Baris ${i + 1}`;
    if (!/^[1-9]\d{0,2}$/.test(b.minggu)) return { galat: `${no}: nomor minggu 1 sampai 999.` };
    if (!b.keahlian) return { galat: `${no}: tulis keahlian yang dilatih.` };
    if (b.keahlian.length > 120) return { galat: `${no}: keahlian paling panjang 120 huruf.` };
    if (b.target.length > 300) return { galat: `${no}: target paling panjang 300 huruf.` };
    baris.push({ minggu: Number(b.minggu), keahlian: b.keahlian, target: b.target || null });
  }
  return { baris };
}
