// X-06 sidebar inti + Fitur tambahan (fungsi murni, diuji di ruang-tambahan.test.ts; dipakai src/lib/ruang-sesi.ts).
import { MODUL } from "@/lib/fitur-usaha";
import { IKON_MOD } from "@/lib/mod/skema";
import type { Halaman, Ruang } from "@/lib/ruang";

export type ModRingkas = { kode: string; nama: string; ikon: string | null; deskripsi: string | null };

const MODUL_HREF = new Set(MODUL.flatMap((m) => m.halaman));
/** Ikon mod yang sama dengan ikon halaman modul (src/components/app/ikon-halaman.tsx); dipakai agar satu daftar tidak berikon ganda (S55). */
const IKON_MODUL: Record<string, string> = { "/app/proyek": "kanban", "/app/janji-temu": "kalender-cek", "/app/servis": "kunci-pas", "/app/barang": "kubus",
  "/app/impor": "jangkar", "/app/ekspor": "pesawat", "/app/mata": "mata", "/app/peta-usaha": "peta", "/app/layanan": "headset" };

/**
 * X-06 sidebar inti + Fitur tambahan: halaman modul opsional yang menyala dipindah dari ruangnya ke ruang "tambahan", lalu
 * setiap mod aktif menjadi halaman /app/mod/<kode>. Halaman indeks /app/mod tidak diulang di sidebar (isinya sudah tampil).
 * Fungsi murni supaya bisa diuji tanpa database.
 */
export function susunTambahan(ruang: Ruang[], mod: ModRingkas[]): Ruang[] {
  const pindah = ruang.flatMap((r) => r.id === "tambahan" ? [] : r.halaman.filter((x) => MODUL_HREF.has(x.href)));
  // ikon yang sudah dipakai halaman modul yang ikut pindah, atau mod sebelumnya, diganti ikon umum fitur tambahan
  const terpakai = new Set(pindah.map((x) => IKON_MODUL[x.href]).filter(Boolean));
  const ikonUnik = (ikon: string | null) => {
    if (!ikon || !(IKON_MOD as readonly string[]).includes(ikon) || terpakai.has(ikon)) return undefined;
    terpakai.add(ikon);
    return ikon;
  };
  const halamanMod: Halaman[] = mod.map((m) => ({
    href: `/app/mod/${m.kode}`, label: { id: m.nama, en: m.nama },
    guna: { id: m.deskripsi ?? "Fitur tambahan usahamu.", en: m.deskripsi ?? "Your business add-on." },
    peran: ["pemilik", "admin", "akuntan", "staf"], cari: `mod fitur tambahan ${m.kode.replace(/-/g, " ")}`,
    ikon: ikonUnik(m.ikon),
  }));
  return ruang
    .map((r) => r.id === "tambahan"
      ? { ...r, halaman: [...pindah, ...halamanMod, ...r.halaman.filter((x) => x.href !== "/app/mod")] }
      : { ...r, halaman: r.halaman.filter((x) => !MODUL_HREF.has(x.href)) })
    .filter((r) => r.halaman.length > 0);
}
