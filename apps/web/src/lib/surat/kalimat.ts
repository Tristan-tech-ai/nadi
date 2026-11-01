// Surat dari kalimat (F4-02, docs/research/surat-keluar.md): pengurai aturan tanpa model (0 token) untuk tiga jenis surat, dan
// penyusun isi surat. Yang tidak terbaca dikembalikan di `kurang` untuk diisi pemilik; nama yang ragu tidak ditebak.

export type JenisSurat = "sk_mutasi" | "surat_tugas" | "keterangan_kerja";
export type Isian = "jenis" | "orang" | "tujuan" | "keperluan" | "mulai";
type Orang = { id: string; nama: string };

export const JENIS_SURAT: Record<JenisSurat, { judul: string; kodeNomor: string; wajib: Isian[] }> = {
  sk_mutasi: { judul: "Surat Keputusan Mutasi", kodeNomor: "SK", wajib: ["orang", "tujuan", "mulai"] },
  surat_tugas: { judul: "Surat Tugas", kodeNomor: "ST", wajib: ["orang", "tujuan", "keperluan", "mulai"] },
  keterangan_kerja: { judul: "Surat Keterangan Kerja", kodeNomor: "SKK", wajib: ["orang"] },
};

export type HasilKalimat = {
  jenis: JenisSurat | null;
  orang: Orang | null;
  kandidat: Orang[];
  tujuan: string | null;
  keperluan: string | null;
  mulai: string | null;
  lamaHari: number | null;
  kurang: Isian[];
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BULAN_POLA: [RegExp, number][] = [
  [/^jan(uari)?$/, 1], [/^feb(ruari)?$/, 2], [/^mar(et)?$/, 3], [/^apr(il)?$/, 4], [/^mei$/, 5], [/^jun(i)?$/, 6],
  [/^jul(i)?$/, 7], [/^(agu(stus)?|agt|ags)$/, 8], [/^sep(t(ember)?)?$/, 9], [/^okt(ober)?$/, 10], [/^nov(ember)?$/, 11], [/^des(ember)?$/, 12],
];
const BERHENTI = "mulai|untuk|selama|tanggal|per|pada|besok|lusa|hari ini";

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function sah(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
function tambahHari(tanggal: string, n: number): string {
  const t = new Date(`${tanggal}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Tanggal pertama di teks: { ada: ditemukan bentuk tanggal, tanggal: YYYY-MM-DD atau null bila mustahil }. */
function bacaTanggal(teks: string, hari: string): { ada: boolean; tanggal: string | null } {
  const t = teks.toLowerCase();
  const kata = /\b(hari ini|besok|lusa)\b/.exec(t);
  const isoM = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  const dmy = /\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\b/g;
  let m: RegExpExecArray | null;
  let tanggalBulan: { i: number; d: number; b: number; y: number | null } | null = null;
  while ((m = dmy.exec(t))) {
    const b = BULAN_POLA.find(([p]) => p.test(m![2]))?.[1];
    if (b) {
      tanggalBulan = { i: m.index, d: Number(m[1]), b, y: m[3] ? Number(m[3]) : null };
      break;
    }
  }
  const calon = [
    kata && { i: kata.index, f: () => tambahHari(hari, kata[1] === "besok" ? 1 : kata[1] === "lusa" ? 2 : 0) },
    isoM && { i: isoM.index, f: () => (sah(+isoM[1], +isoM[2], +isoM[3]) ? isoM[0] : null) },
    tanggalBulan && {
      i: tanggalBulan.i,
      f: () => {
        const { d, b, y } = tanggalBulan!;
        const tahunIni = Number(hari.slice(0, 4));
        let th = y ?? tahunIni;
        if (!sah(th, b, d)) return null;
        if (y === null && iso(th, b, d) < hari) th += 1;
        return sah(th, b, d) ? iso(th, b, d) : null;
      },
    },
  ].filter(Boolean) as { i: number; f: () => string | null }[];
  if (!calon.length) return { ada: false, tanggal: null };
  calon.sort((a, b) => a.i - b.i);
  return { ada: true, tanggal: calon[0].f() };
}

const kataDari = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

function cariOrang(kalimat: string, orang: Orang[]): { orang: Orang | null; kandidat: Orang[] } {
  const ada = new Set(kataDari(kalimat));
  const penuh = orang.filter((o) => { const k = kataDari(o.nama); return k.length > 0 && k.every((w) => ada.has(w)); });
  if (penuh.length) {
    const terpanjang = Math.max(...penuh.map((o) => kataDari(o.nama).length));
    const pilih = penuh.filter((o) => kataDari(o.nama).length === terpanjang);
    if (pilih.length === 1 && (terpanjang > 1 || orang.filter((o) => kataDari(o.nama)[0] === kataDari(pilih[0].nama)[0]).length === 1)) {
      return { orang: pilih[0], kandidat: [] };
    }
  }
  const depan = orang.filter((o) => ada.has(kataDari(o.nama)[0] ?? ""));
  if (depan.length === 1) return { orang: depan[0], kandidat: [] };
  return { orang: null, kandidat: depan };
}

export function pahamiKalimat(kalimat: string, orang: Orang[], hari: string): HasilKalimat {
  const k = kalimat.replace(/\s+/g, " ").trim();
  const t = k.toLowerCase();
  const jenis: JenisSurat | null = /\b(sk|surat keputusan)\b.*\bmutasi\b|\bmutasi\b/.test(t) ? "sk_mutasi"
    : /\bsurat tugas\b|\bst\b/.test(t) ? "surat_tugas"
    : /\b(surat )?keterangan (kerja|bekerja)\b/.test(t) ? "keterangan_kerja" : null;
  const { orang: o, kandidat } = cariOrang(k, orang);
  const tujuan = new RegExp(`\\bke\\s+(.+?)(?=\\s+(?:${BERHENTI})\\b|[.,;]|$)`, "i").exec(k)?.[1]?.trim() ?? null;
  const keperluan = jenis === "surat_tugas"
    ? new RegExp(`\\buntuk\\s+(.+?)(?=\\s+(?:mulai|selama|tanggal|pada|besok|lusa|hari ini|ke)\\b|[.,;]|$)`, "i").exec(k)?.[1]?.trim() ?? null
    : null;
  const setelah = /\b(mulai|tanggal|per|pada)\b/i.exec(k);
  const tgl = bacaTanggal(setelah ? k.slice(setelah.index) : k, hari);
  const tgl2 = tgl.ada ? tgl : bacaTanggal(k, hari);
  const lama = /\bselama\s+(\d{1,3})\s+hari\b/i.exec(k);
  const hasil: HasilKalimat = {
    jenis, orang: o, kandidat, tujuan, keperluan, mulai: tgl2.tanggal, lamaHari: lama ? Number(lama[1]) : null, kurang: [],
  };
  if (!jenis) hasil.kurang = ["jenis"];
  else hasil.kurang = JENIS_SURAT[jenis].wajib.filter((i) => (i === "orang" ? !o : !hasil[i]));
  return hasil;
}

export function tanggalPanjang(tanggal: string): string {
  const [y, m, d] = tanggal.split("-").map(Number);
  return `${d} ${BULAN[m - 1]} ${y}`;
}

export type DataSurat = { usaha: string; nama: string; tujuan?: string | null; keperluan?: string | null; mulai?: string | null; lamaHari?: number | null };

/** Judul dan paragraf isi surat (bahasa resmi, sapaan "Saudara"). Nomor, tanggal, dan tanda tangan ada di halaman cetak. */
export function susunSurat(jenis: JenisSurat, d: DataSurat): { judul: string; isi: string[] } {
  const judul = JENIS_SURAT[jenis].judul;
  if (jenis === "sk_mutasi") {
    return { judul, isi: [
      `Pimpinan ${d.usaha} memutuskan memindahkan Saudara ${d.nama} ke ${d.tujuan}, terhitung mulai ${tanggalPanjang(d.mulai!)}.`,
      "Hak dan kewajiban Saudara sebagai karyawan tetap berlaku seperti sebelumnya, kecuali diatur lain secara tertulis.",
      "Keputusan ini berlaku sejak tanggal ditetapkan dan akan dibetulkan bila di kemudian hari ternyata terdapat kekeliruan.",
    ] };
  }
  if (jenis === "surat_tugas") {
    const rentang = d.lamaHari && d.lamaHari > 1
      ? `${tanggalPanjang(d.mulai!)} sampai ${tanggalPanjang(tambahHari(d.mulai!, d.lamaHari - 1))}`
      : `tanggal ${tanggalPanjang(d.mulai!)}`;
    return { judul, isi: [
      `Pimpinan ${d.usaha} menugaskan Saudara ${d.nama} ke ${d.tujuan} untuk ${d.keperluan}, pada ${rentang}.`,
      "Saudara diminta melaporkan hasil tugas kepada pimpinan setelah tugas selesai.",
      "Surat tugas ini dibuat untuk dipergunakan sebagaimana mestinya.",
    ] };
  }
  return { judul, isi: [
    `Yang bertanda tangan di bawah ini, pimpinan ${d.usaha}, menerangkan bahwa Saudara ${d.nama} adalah karyawan ${d.usaha}${d.mulai ? ` sejak ${tanggalPanjang(d.mulai)}` : ""}.`,
    "Surat keterangan ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.",
  ] };
}
