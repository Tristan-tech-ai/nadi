// Rubrik pelamar dari topi (F2-02): kriteria diambil dari keahlian, tanggung jawab, dan nama topi;
// CV dinilai HANYA dari posisi, riwayat peran, dan keahlian. Atribut terlindungi tidak pernah dibaca (saringCv).

export type Kriteria = { label: string; jenis: "pengalaman" | "keahlian" | "tugas"; bobot: number };
export type CvAman = { posisi: string; peran: string[]; keahlian: string[] };
export type NilaiPelamar = { skor: number | null; cocok: string[]; kurang: string[] };

/** Bidang CV yang tidak boleh ikut menilai. Dipakai juga untuk tes dan penjelasan di layar. */
export const ATRIBUT_TERLINDUNGI = [
  "nama", "usia", "umur", "tanggal_lahir", "tempat_lahir", "jenis_kelamin", "agama", "status_kawin", "status_perkawinan",
  "suku", "ras", "warna_kulit", "foto", "tinggi_badan", "berat_badan", "alamat", "disabilitas", "politik", "nik",
] as const;

const BOBOT = { pengalaman: 3, keahlian: 2, tugas: 1 } as const;

function teksDari(x: unknown): string {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    return String(o.nama ?? o.tugas ?? o.label ?? "");
  }
  return "";
}

/** Topi -> kriteria. keahlian/tanggung_jawab boleh berupa teks atau objek {nama}/{tugas} (graf usaha). */
export function rubrikDariTopi(topi: { nama: string; keahlian?: unknown; tanggung_jawab?: unknown }): Kriteria[] {
  const daftar = (v: unknown) => (Array.isArray(v) ? v.map(teksDari).map((s) => s.trim()).filter(Boolean) : []);
  const k: Kriteria[] = [{ label: `Pernah bekerja sebagai ${topi.nama.toLowerCase()}`, jenis: "pengalaman", bobot: BOBOT.pengalaman }];
  for (const s of daftar(topi.keahlian)) k.push({ label: s, jenis: "keahlian", bobot: BOBOT.keahlian });
  for (const s of daftar(topi.tanggung_jawab)) k.push({ label: s, jenis: "tugas", bobot: BOBOT.tugas });
  return k;
}

/** Ambil hanya bidang yang boleh dinilai. Apa pun selain posisi, peran pengalaman, dan keahlian dibuang. */
export function saringCv(cv: unknown): CvAman {
  const o = (cv && typeof cv === "object" ? cv : {}) as Record<string, unknown>;
  const pengalaman = Array.isArray(o.pengalaman) ? o.pengalaman : [];
  return {
    posisi: typeof o.posisi === "string" ? o.posisi : "",
    peran: pengalaman.map((p) => (p && typeof p === "object" ? String((p as Record<string, unknown>).peran ?? "") : "")).filter(Boolean),
    keahlian: Array.isArray(o.keahlian) ? o.keahlian.filter((x): x is string => typeof x === "string") : [],
  };
}

const AWALAN = ["meng", "meny", "mem", "men", "me", "peng", "peny", "pem", "pen", "pe", "ber", "ter", "di", "ke"];
const AKHIRAN = ["kan", "an", "i", "nya"];
const ABAI = new Set(["dan", "yang", "untuk", "dengan", "atau", "dari", "pada", "harian"]);

/** Bentuk dasar kasar kata Indonesia: semua kemungkinan setelah awalan/akhiran dibuang (melayani ~ pelayan ~ layan). */
function varian(kata: string): string[] {
  const hasil = new Set([kata]);
  for (const a of AWALAN) {
    if (!kata.startsWith(a) || kata.length - a.length < 4) continue;
    const s = kata.slice(a.length);
    hasil.add(s);
    // meN- meluluhkan huruf awal: memasak = masak, menyapu = sapu, mengirim = kirim.
    if (a === "mem" || a === "pem") hasil.add("p" + s);
    if (a === "men" || a === "pen") hasil.add("t" + s);
    if (a === "meng" || a === "peng") hasil.add("k" + s);
    if (a === "meny" || a === "peny") hasil.add("s" + s);
  }
  for (const v of [...hasil]) for (const z of AKHIRAN) if (v.endsWith(z) && v.length - z.length >= 4) hasil.add(v.slice(0, -z.length));
  return [...hasil];
}

function kunci(teks: string): Set<string> {
  const s = new Set<string>();
  for (const k of teks.toLowerCase().split(/[^a-z0-9]+/)) if (k.length >= 4 && !ABAI.has(k)) for (const v of varian(k)) s.add(v);
  return s;
}

function bertemu(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/** Skor 0-100 = bobot kriteria yang terpenuhi / total bobot. Rubrik kosong -> skor null. */
export function nilaiPelamar(rubrik: Kriteria[], cv: CvAman): NilaiPelamar {
  const pengalaman = kunci([cv.posisi, ...cv.peran].join(" "));
  const semua = kunci([cv.posisi, ...cv.peran, ...cv.keahlian].join(" "));
  let total = 0;
  let dapat = 0;
  const cocok: string[] = [];
  const kurang: string[] = [];
  for (const k of rubrik) {
    total += k.bobot;
    const sasaran = kunci(k.jenis === "pengalaman" ? k.label.replace(/^Pernah bekerja sebagai /, "") : k.label);
    const ya = bertemu(sasaran, k.jenis === "pengalaman" ? pengalaman : semua);
    if (ya) dapat += k.bobot;
    (ya ? cocok : kurang).push(k.label);
  }
  return { skor: total ? Math.round((100 * dapat) / total) : null, cocok, kurang };
}

/** Satu kalimat untuk kartu Feed: angka dulu, lalu yang kurang, lalu apa yang sengaja tidak dinilai. */
export function catatanRubrik(topi: string, n: NilaiPelamar): string | null {
  if (n.skor === null) return null;
  const total = n.cocok.length + n.kurang.length;
  const kurang = n.kurang.length ? ` Belum terlihat di CV: ${n.kurang.join(", ")}.` : "";
  return `Rubrik topi ${topi}: cocok ${n.cocok.length} dari ${total} (skor ${n.skor}).${kurang} Umur, jenis kelamin, agama, foto, dan nama tidak dinilai.`;
}
