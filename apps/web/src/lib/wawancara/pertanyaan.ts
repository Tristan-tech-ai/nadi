// Pertanyaan wawancara dari topi dan ringkasan jawaban (F2-03, docs/research/wawancara.md).
// Pertanyaan selalu lolos penjaga bias F2-02; penilaian memakai rubrik topi yang sama dengan CV, hanya dari isi jawaban.
import { cekLowongan } from "../rekrut/bias";
import { nilaiPelamar, rubrikDariTopi, saringCv, type NilaiPelamar } from "../rekrut/rubrik";

type Topi = { nama: string; keahlian?: unknown; tanggung_jawab?: unknown };
const teks = (x: unknown) => (typeof x === "string" ? x : x && typeof x === "object" ? String((x as Record<string, unknown>).nama ?? (x as Record<string, unknown>).tugas ?? "") : "").trim();
const daftar = (v: unknown) => (Array.isArray(v) ? v.map(teks).filter(Boolean) : []);
const kecil = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** 3 sampai 5 pertanyaan terbuka dari topi: pengalaman, keahlian, tugas, lalu kesediaan waktu. */
export function pertanyaanDariTopi(topi: Topi, maks = 5): string[] {
  const calon = [
    `Ceritakan pengalamanmu sebagai ${topi.nama.toLowerCase()}.`,
    ...daftar(topi.keahlian).map((k) => `Ceritakan pengalamanmu dalam ${kecil(k)}.`),
    ...daftar(topi.tanggung_jawab).map((t) => `Bagaimana caramu ${kecil(t)}?`),
    "Kapan kamu bisa mulai bekerja, dan shift apa saja yang kamu sanggupi?",
  ];
  const unik = [...new Set(calon)].filter((p) => cekLowongan(p).length === 0);
  const akhir = unik[unik.length - 1];
  const isi = unik.slice(0, Math.max(1, maks - 1));
  return isi.includes(akhir) ? isi : [...isi, akhir].slice(0, maks);
}

export type Kutipan = { kriteria: string; kalimat: string };
export type RingkasanWawancara = { nilai: NilaiPelamar; kutipan: Kutipan[]; jawabanKosong: number };

const sebagaiCv = (s: string) => saringCv({ posisi: "", pengalaman: [{ peran: s }], keahlian: [s] });

/** Nilai rubrik topi dari transkrip jawaban, dengan satu kalimat pendukung per kriteria yang terpenuhi. */
export function ringkasanWawancara(topi: Topi, jawaban: { transkrip: string | null }[]): RingkasanWawancara {
  const isi = jawaban.map((j) => (j.transkrip ?? "").trim()).filter(Boolean);
  const rubrik = rubrikDariTopi(topi);
  const nilai = nilaiPelamar(rubrik, sebagaiCv(isi.join(". ")));
  const kalimat = isi.flatMap((t) => t.split(/(?<=[.!?])\s+/)).map((k) => k.trim()).filter(Boolean);
  const kutipan: Kutipan[] = [];
  for (const k of rubrik.filter((r) => nilai.cocok.includes(r.label))) {
    // Kalimat yang memuat kata kriteria paling banyak (mis. "melayani pelanggan" lebih tepat daripada sekadar "pelayan").
    const kata = (k.jenis === "pengalaman" ? k.label.replace(/^Pernah bekerja sebagai /, "") : k.label).split(/\s+/).filter((w) => w.length >= 4);
    const skor = (s: string) => kata.filter((w) => nilaiPelamar([{ ...k, label: w }], sebagaiCv(s)).cocok.length > 0).length;
    const temu = kalimat.reduce<string | null>((terbaik, s) => (skor(s) > (terbaik ? skor(terbaik) : 0) ? s : terbaik), null);
    if (temu) kutipan.push({ kriteria: k.label, kalimat: temu.length > 160 ? `${temu.slice(0, 157)}...` : temu });
  }
  return { nilai, kutipan, jawabanKosong: jawaban.length - isi.length };
}
