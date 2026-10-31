// Feed Keputusan tanpa usulan tersembunyi (D-05, docs/design/feed-penuh.md): halaman 20 per tampilan lewat ?lagi=<offset>,
// saringan jenis lewat ?jenis=, urutan "Terbaru" lewat ?urut=terbaru, dan penanda "Baru" untuk usulan berumur < 24 jam.

export const PER_HALAMAN = 20;
/** Batas atas offset agar ?lagi= yang aneh tidak menjadi kueri mahal. Usulan menunggu per usaha jarang ribuan. */
export const LAGI_MAKS = 100_000;
export const SATU_HARI_MS = 24 * 60 * 60 * 1000;

export const JENIS = ["uang", "orang", "izin", "rekrut", "dokumen", "lainnya"] as const;
export type Jenis = (typeof JENIS)[number];
export type JenisDikenal = Exclude<Jenis, "lainnya">;
export const JENIS_DIKENAL: readonly JenisDikenal[] = ["uang", "orang", "izin", "rekrut", "dokumen"];
export const LABEL_JENIS: Record<Jenis, string> = { uang: "Uang", orang: "Orang", izin: "Izin", rekrut: "Rekrut", dokumen: "Dokumen", lainnya: "Lainnya" };

export type Urut = "mendesak" | "terbaru";
export type Tampilan = { jenis: Jenis | null; urut: Urut; lagi: number };

/** Jenis usulan dari awalan `aksi` sebelum titik pertama: "uang.keluar" -> uang, "catatan" atau "berkas.tinjau" -> lainnya. */
export function jenisDariAksi(aksi: string): Jenis {
  const awalan = aksi.split(".", 1)[0];
  return (JENIS_DIKENAL as readonly string[]).includes(awalan) ? (awalan as JenisDikenal) : "lainnya";
}

const pertama = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Membaca searchParams Feed. Nilai yang tidak dikenal jatuh ke bawaan. Offset tidak dibulatkan: setelah memutuskan usulan,
 *  tautan halaman berikut mundur sebanyak usulan yang diputuskan (offsetBerikut), jadi bisa bukan kelipatan 20. */
export function bacaTampilan(sp: Record<string, string | string[] | undefined>): Tampilan {
  const j = pertama(sp.jenis);
  const jenis = j && (JENIS as readonly string[]).includes(j) ? (j as Jenis) : null;
  const urut: Urut = pertama(sp.urut) === "terbaru" ? "terbaru" : "mendesak";
  const l = pertama(sp.lagi) ?? "";
  const angka = /^\d{1,9}$/.test(l) ? Number(l) : 0;
  const lagi = Math.min(angka, LAGI_MAKS);
  return { jenis, urut, lagi };
}

/** Tautan Feed dengan urutan parameter tetap; nilai bawaan tidak ditulis agar /app tetap /app. */
export function hrefFeed(t: Partial<Tampilan>): string {
  const q = new URLSearchParams();
  if (t.jenis) q.set("jenis", t.jenis);
  if (t.urut === "terbaru") q.set("urut", "terbaru");
  if (t.lagi && t.lagi > 0) q.set("lagi", String(t.lagi));
  const s = q.toString();
  return s ? `/app?${s}` : "/app";
}

export type Halaman = {
  /** Nomor urut usulan pertama dan terakhir di halaman ini (mulai 1); 0 bila halaman kosong. */
  dari: number;
  sampai: number;
  /** Usulan setelah halaman ini. */
  sisa: number;
  /** Offset halaman berikut dan sebelumnya, null bila tidak ada. */
  berikut: number | null;
  sebelum: number | null;
  /** Banyak usulan yang muncul bila tautan berikut dibuka. */
  ukuranBerikut: number;
  /** Offset melewati jumlah usulan (tautan lama setelah usulan diputuskan). */
  lewat: boolean;
};

export function halaman(total: number, lagi: number, per = PER_HALAMAN): Halaman {
  const n = Math.max(0, total);
  const o = Math.max(0, lagi);
  const sampai = Math.min(o + per, n);
  const sisa = Math.max(0, n - o - per);
  return {
    dari: o < n ? o + 1 : 0,
    sampai: o < n ? sampai : 0,
    sisa,
    berikut: sisa > 0 ? o + per : null,
    sebelum: o > 0 ? Math.max(0, o - per) : null,
    ukuranBerikut: Math.min(per, sisa),
    lewat: o > 0 && o >= n,
  };
}

/** Jumlah per jenis untuk pil saringan. "Lainnya" adalah sisa dari total, sehingga jumlah semua pil sama dengan total. */
export function hitungJenis(total: number, dikenal: Record<JenisDikenal, number>): Record<Jenis, number> {
  const jumlah = JENIS_DIKENAL.reduce((s, j) => s + dikenal[j], 0);
  return { ...dikenal, lainnya: Math.max(0, total - jumlah) };
}

/** Usulan berumur kurang dari 24 jam diberi penanda "Baru". Jam server sedikit di belakang database tetap dihitung baru. */
export function usulanBaru(dibuatAt: string, sekarang: number): boolean {
  const t = Date.parse(dibuatAt);
  return Number.isFinite(t) && sekarang - t < SATU_HARI_MS;
}

/** Offset halaman berikut setelah `diputuskan` usulan di halaman ini disetujui/ditolak. Usulan itu tidak lagi menunggu, sehingga
 *  daftar saat tautan dibuka lebih pendek sebanyak itu; tanpa pengurangan, usulan sebanyak itu terlewat (docs/research/feed-urutan.md). */
export function offsetBerikut(berikut: number, diputuskan: number): number {
  return Math.max(0, berikut - Math.max(0, diputuskan));
}
