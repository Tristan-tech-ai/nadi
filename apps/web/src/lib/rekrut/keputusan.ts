// Keputusan rekrut, status pelamar, dan Bank Talenta (F2-05, docs/research/keputusan-rekrut.md). Fungsi murni tanpa AI:
// label tahap, tampilan nomor HP, tautan wa.me dengan teks sopan, dan pemilihan pelamar lama yang memberi izin.

export const TAHAP = ["masuk", "ditinjau", "ditawari", "diterima", "ditolak"] as const;
export type Tahap = (typeof TAHAP)[number];
export const tahapSah = (t: unknown): t is Tahap => typeof t === "string" && (TAHAP as readonly string[]).includes(t);

/** Kata untuk pelamar di halaman status. */
export const LABEL_PELAMAR: Record<Tahap, string> = {
  masuk: "Lamaran diterima Nadi, menunggu dibaca",
  ditinjau: "Sedang ditinjau",
  ditawari: "Kamu ditawari pekerjaan",
  diterima: "Kamu diterima",
  ditolak: "Belum cocok kali ini",
};

/** Kata untuk pemilik di layar penilai. */
export const LABEL_PEMILIK: Record<Tahap, string> = {
  masuk: "Belum ditinjau",
  ditinjau: "Sedang ditinjau",
  ditawari: "Sudah ditawari kerja",
  diterima: "Diterima kerja",
  ditolak: "Belum cocok",
};

/** Token tautan status: nml_ + 64 heksa (hanya hash-nya yang disimpan di database). */
export const tokenStatusSah = (t: string) => /^nml_[0-9a-f]{64}$/.test(t);

/** Nomor HP dari data (62812...) ke angka wa.me. null bila bukan nomor Indonesia yang masuk akal. */
export function angkaWa(telepon: string | null | undefined): string | null {
  let d = (telepon ?? "").replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  return /^62\d{8,13}$/.test(d) ? d : null;
}

/** Tampilan VOICE: 0812-3456-7890 (kelompok 4-4-sisa). */
export function tampilHp(telepon: string | null | undefined): string {
  const d = angkaWa(telepon);
  if (!d) return telepon ?? "";
  const lokal = `0${d.slice(2)}`;
  return [lokal.slice(0, 4), lokal.slice(4, 8), lokal.slice(8)].filter(Boolean).join("-");
}

export type JenisPesan = "tawaran" | "penolakan" | "undangan";
type IsiPesan = { nama: string; usaha: string; lowongan: string; pesan?: string | null; simpan?: boolean; tautan?: string };

const sapa = (nama: string) => nama.trim().split(/\s+/)[0] || nama.trim();

/**
 * Teks WhatsApp yang dikirim pemilik sendiri. Penolakan selalu berterima kasih dan tidak menyebut alasan;
 * tidak ada teks yang menyinggung usia, penampilan, agama, suku, status kawin, atau atribut pribadi lain.
 */
export function pesanWa(jenis: JenisPesan, i: IsiPesan): string {
  const tambahan = i.pesan?.trim() ? ` ${i.pesan.trim()}` : "";
  const awal = `Halo ${sapa(i.nama)}, ini dari ${i.usaha}.`;
  if (jenis === "tawaran") {
    return `${awal} Terima kasih sudah melamar sebagai ${i.lowongan}. Kami ingin menawarkan pekerjaan ini kepadamu.${tambahan} Balas pesan ini kalau kamu bersedia, nanti kita atur hari mulai kerjanya.`;
  }
  if (jenis === "penolakan") {
    const simpan = i.simpan ? " Lamaranmu kami simpan, dan kami akan menghubungimu lagi kalau ada lowongan yang cocok." : "";
    return `${awal} Terima kasih sudah melamar sebagai ${i.lowongan} dan meluangkan waktu untuk prosesnya. Untuk kali ini kami memilih pelamar lain.${tambahan}${simpan} Semoga lancar mencari kerja.`;
  }
  return `${awal} Dulu kamu pernah melamar di sini dan mengizinkan kami menghubungimu lagi. Sekarang ada lowongan ${i.lowongan}.${i.tautan ? ` Kalau tertarik, lamar lewat ${i.tautan}` : " Kalau tertarik, balas pesan ini."}`;
}

/** https://wa.me/62812...?text=... atau null bila nomor tidak sah. */
export function tautanWa(telepon: string | null | undefined, teks: string): string | null {
  const d = angkaWa(telepon);
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(teks)}` : null;
}

export type LowonganBank = { id: string; topi_id: string | null; buka: boolean };
export type LamaranBank = { id: string; lowongan_id: string; nama: string; telepon: string | null; tahap: string; boleh_dihubungi: boolean; dibuat_at: string; topi_id: string | null };
export type Talenta = { lamaran: string; nama: string; telepon: string; dibuat_at: string };

const HARI_BANK = 365;

/** Batas awal Bank Talenta (ISO), dipakai untuk menyaring query di server dengan aturan yang sama. */
export const sejakBank = (kini: Date = new Date()) => new Date(kini.getTime() - HARI_BANK * 86_400_000).toISOString();

/**
 * Bank Talenta per lowongan buka bertopi: lamaran usaha yang sama di lowongan LAIN dengan topi sama, memberi izin dihubungi,
 * belum diterima, dalam 365 hari. Satu baris per nomor HP (lamaran terbaru). Nomor yang sudah melamar di lowongan ini tidak ditampilkan.
 */
export function bankTalenta(lowongan: LowonganBank[], lamaran: LamaranBank[], kini: Date = new Date(), batas = 10): Map<string, Talenta[]> {
  const sejak = Date.parse(sejakBank(kini));
  const hasil = new Map<string, Talenta[]>();
  for (const l of lowongan) {
    if (!l.buka || !l.topi_id) continue;
    const sudahDiSini = new Set(lamaran.filter((a) => a.lowongan_id === l.id).map((a) => angkaWa(a.telepon)).filter(Boolean));
    const perHp = new Map<string, LamaranBank>();
    for (const a of lamaran) {
      const hp = angkaWa(a.telepon);
      if (!hp || a.lowongan_id === l.id || a.topi_id !== l.topi_id || !a.boleh_dihubungi || a.tahap === "diterima") continue;
      if (Date.parse(a.dibuat_at) < sejak || sudahDiSini.has(hp)) continue;
      const lama = perHp.get(hp);
      if (!lama || Date.parse(a.dibuat_at) > Date.parse(lama.dibuat_at)) perHp.set(hp, a);
    }
    const daftar = [...perHp.entries()]
      .sort((x, y) => Date.parse(y[1].dibuat_at) - Date.parse(x[1].dibuat_at))
      .slice(0, batas)
      .map(([hp, a]) => ({ lamaran: a.id, nama: a.nama, telepon: hp, dibuat_at: a.dibuat_at }));
    if (daftar.length) hasil.set(l.id, daftar);
  }
  return hasil;
}
