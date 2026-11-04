// Inti pembaca berkas Lempar Saja tanpa dependensi luar: skema keluaran, xlsx ke teks, usulan per jenis, penilai eval.
// Dipakai Edge Function (Deno), tes unit (vitest), dan skrip eval korpus (Node).

export const JENIS = ["nota", "invoice", "slip_gaji", "ktp", "cv", "surat_sakit", "absen", "mutasi", "surat", "excel_karyawan", "pib", "peb", "sppb", "lainnya"] as const;
export type Jenis = (typeof JENIS)[number];

type Skema = Record<string, unknown>;
const teks = (keterangan?: string): Skema => (keterangan ? { type: "string", description: keterangan } : { type: "string" });
const angka = (keterangan?: string): Skema => (keterangan ? { type: "number", description: keterangan } : { type: "number" });
const objek = (properti: Record<string, Skema>): Skema => ({
  type: "object",
  properties: properti,
  required: Object.keys(properti),
  additionalProperties: false,
});
const daftar = (isi: Skema): Skema => ({ type: "array", items: isi });
const TANGGAL = "YYYY-MM-DD, kosong bila tidak ada";
const RP = "rupiah utuh tanpa pemisah, 0 bila tidak ada";
const barisBarang = objek({ nama: teks(), qty: angka(), harga: angka(RP), jumlah: angka(RP) });
const VALUTA = "dalam valuta dokumen, boleh desimal dengan titik, 0 bila tidak ada";
// B-EKSIM3: bidang dokumen pabean mengikuti elemen formulir resmi: PIB BC 2.0 (Lampiran PER-44/BC/2011: nomor pengajuan,
// nomor & tanggal pendaftaran, pemasok, importir, 21 valuta, 22 NDPBM, 23 FOB, 24 freight, 25 asuransi, 26 nilai CIF, 32 pos
// tarif/HS, 37-41 pungutan BM, cukai, PPN, PPnBM, PPh) dan PEB BC 3.0 (Lampiran PER-07/BC/2020: nomor pendaftaran, eksportir,
// 14-16 pembeli, 26 negara tujuan, 34 jenis valuta, 35 nilai ekspor, 51 nilai FOB, 52 nilai tukar, 53 bea keluar).
const barisPabean = objek({ hs: teks("pos tarif/HS persis seperti tertulis"), uraian: teks(), jumlah: angka(), satuan: teks() });

export const BIDANG: Record<Jenis, Skema> = {
  nota: objek({ pemasok: teks("nama toko/pemasok yang menerbitkan nota"), nomor: teks(), tanggal: teks(TANGGAL), baris: daftar(barisBarang), total: angka(RP) }),
  invoice: objek({ penjual: teks(), nomor: teks(), tanggal: teks(TANGGAL), jatuh_tempo: teks(TANGGAL), pembeli: teks(), baris: daftar(barisBarang), total: angka(RP) }),
  slip_gaji: objek({
    nama: teks(), periode: teks("YYYY-MM"), gaji_pokok: angka(RP),
    tunjangan: objek({ transport: angka(RP), makan: angka(RP) }), lembur: angka(RP),
    potongan: objek({ bpjs_kesehatan: angka(RP), jht: angka(RP), jp: angka(RP), pph21: angka(RP), kasbon: angka(RP) }),
    bruto: angka(RP), neto: angka(RP),
  }),
  ktp: objek({ nik: teks("16 angka"), nama: teks(), tanggal_lahir: teks(TANGGAL), jenis_kelamin: { type: "string", enum: ["L", "P", ""] } }),
  cv: objek({ nama: teks(), posisi: teks("posisi yang dilamar"), pengalaman: daftar(objek({ tempat: teks(), peran: teks(), tahun: teks("mis. 2020-2023") })), keahlian: daftar(teks()) }),
  surat_sakit: objek({ nama: teks("nama pasien"), mulai: teks(TANGGAL), lama_hari: angka("jumlah hari istirahat") }),
  absen: objek({ baris: daftar(objek({ nama: teks(), tanggal: teks(TANGGAL), masuk: teks("HH.MM, kosong bila tidak ada"), pulang: teks("HH.MM, kosong bila tidak ada"), keterangan: teks() })) }),
  mutasi: objek({ baris: daftar(objek({ tanggal: teks(TANGGAL), keterangan: teks(), cabang: teks(), jumlah: angka(RP), arah: { type: "string", enum: ["DB", "CR"] }, saldo: angka(RP) })) }),
  surat: objek({ nomor: teks("nomor surat persis seperti tertulis"), jenis: teks("jenis surat, mis. Surat Keputusan Mutasi"), tanggal: teks(TANGGAL), pihak: teks("nama orang yang dituju/diatur surat") }),
  excel_karyawan: objek({ baris: daftar(objek({ id: teks("kode/ID karyawan"), nama: teks(), jabatan: teks(), telepon: teks(), mulai: teks(TANGGAL), gaji_pokok: angka(RP) })) }),
  pib: objek({
    nomor_pengajuan: teks(), nomor_daftar: teks("nomor pendaftaran"), tanggal_daftar: teks(TANGGAL), pemasok: teks("nama pemasok luar negeri"),
    negara_pemasok: teks(), importir: teks(), valuta: teks("kode valuta, mis. USD"), ndpbm: angka("NDPBM: kurs rupiah per 1 valuta, boleh desimal"),
    fob: angka(VALUTA), freight: angka(VALUTA), asuransi: angka(VALUTA), nilai_cif: angka(VALUTA), nilai_pabean_rp: angka(RP + "; nilai CIF dalam rupiah"),
    baris: daftar(barisPabean), bm: angka(RP), cukai: angka(RP), ppn: angka(RP), ppnbm: angka(RP), pph: angka(RP + "; PPh Pasal 22 impor"),
    total: angka(RP + "; total pungutan dibayar"),
  }),
  peb: objek({
    nomor_pengajuan: teks(), nomor_daftar: teks("nomor pendaftaran"), tanggal_daftar: teks(TANGGAL), eksportir: teks(), pembeli: teks(),
    negara_tujuan: teks(), valuta: teks("kode valuta, mis. USD"), nilai_fob: angka(VALUTA), nilai_tukar: angka("rupiah per 1 valuta, boleh desimal"),
    baris: daftar(barisPabean), bea_keluar: angka(RP),
  }),
  sppb: objek({ nomor: teks("nomor SPPB"), tanggal: teks(TANGGAL), nomor_pib: teks("nomor pendaftaran PIB yang disetujui"), tanggal_pib: teks(TANGGAL), importir: teks() }),
  lainnya: objek({ judul: teks(), isi: teks("ringkasan isi penting") }),
};

/** Bentuk bidang per jenis sebagai teks ringkas untuk instruksi, mis. {pemasok, tanggal (YYYY-MM-DD), baris: [{nama, qty}]}. */
export function ringkasSkema(sk: Skema): string {
  if (sk.type === "array") return `[${ringkasSkema(sk.items as Skema)}]`;
  if (sk.type === "object") {
    const p = sk.properties as Record<string, Skema>;
    return `{${Object.entries(p).map(([k, v]) => {
      if (v.type === "object" || v.type === "array") return `${k}: ${ringkasSkema(v)}`;
      const ket = v.enum ? (v.enum as string[]).map((x) => JSON.stringify(x)).join("|") : v.type === "number" ? "angka" : (v.description as string | undefined) ?? "";
      return ket ? `${k} (${ket})` : k;
    }).join(", ")}}`;
  }
  return "";
}

/**
 * Skema keluaran terstruktur. Satu varian per jenis (anyOf) ditolak API karena grammar terlalu besar,
 * jadi bidang dikirim sebagai string JSON lalu dirapikan dengan rapikan() mengikuti BIDANG.
 */
export const SKEMA_HASIL: Skema = objek({
  jenis: { type: "string", enum: [...JENIS] },
  keyakinan: angka("0 sampai 1: seberapa yakin jenis dan isi terbaca benar"),
  ringkasan: teks("satu kalimat bahasa Indonesia untuk pemilik usaha"),
  bidang_json: teks("objek JSON bidang sesuai bentuk untuk jenis itu"),
});

/** Paksa nilai mengikuti skema: bidang hilang diisi kosong/0, angka bertitik ribuan dibersihkan, bidang asing dibuang. */
export function rapikan(sk: Skema, v: unknown): unknown {
  if (sk.type === "object") {
    const p = sk.properties as Record<string, Skema>;
    const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    return Object.fromEntries(Object.entries(p).map(([k, s2]) => [k, rapikan(s2, o[k])]));
  }
  if (sk.type === "array") return Array.isArray(v) ? v.map((x) => rapikan(sk.items as Skema, x)) : [];
  if (sk.type === "number") {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const t = String(v ?? "").trim();
    if (/^-?\d+(\.\d{1,2})?$/.test(t)) return Number(t); // 2503000.00 dari CSV
    const bersih = t.replace(/[^\d,-]/g, "").replace(",", "."); // Rp1.250.000 atau 12.500,50
    const n = Number(bersih);
    return bersih && Number.isFinite(n) ? n : 0;
  }
  const t = v === null || v === undefined ? "" : String(v);
  return sk.enum && !(sk.enum as string[]).includes(t) ? "" : t;
}

/** Keluaran mentah model menjadi Hasil yang rapi. */
export function hasilDari(mentah: { jenis: Jenis; keyakinan: number; ringkasan: string; bidang_json: string }): Hasil {
  let bidang: unknown = {};
  try {
    bidang = JSON.parse(mentah.bidang_json);
  } catch {
    bidang = {};
  }
  const jenis = (JENIS as readonly string[]).includes(mentah.jenis) ? mentah.jenis : "lainnya";
  return { jenis, keyakinan: Math.max(0, Math.min(1, Number(mentah.keyakinan) || 0)), ringkasan: mentah.ringkasan ?? "", bidang: rapikan(BIDANG[jenis], bidang) as Record<string, unknown> };
}

export const INSTRUKSI = `Kamu membaca berkas kerja usaha kecil di Indonesia (foto nota, PDF, isi Excel/CSV) dan mengisinya ke skema.
Aturan:
- Pilih jenis yang paling cocok: nota (nota/struk belanja dari pemasok), invoice (tagihan resmi bernomor dengan jatuh tempo), slip_gaji, ktp, cv (daftar riwayat hidup pelamar), surat_sakit (surat keterangan dokter), absen (rekap jam masuk/pulang), mutasi (mutasi rekening bank), surat (surat resmi bernomor: SK, surat tugas, dll.), excel_karyawan (daftar karyawan), pib (Pemberitahuan Impor Barang BC 2.0), peb (Pemberitahuan Ekspor Barang BC 3.0), sppb (Surat Persetujuan Pengeluaran Barang dari Bea Cukai), lainnya.
- Salin teks persis seperti tertulis (nama, nomor). Jangan menebak isi yang tidak ada: pakai string kosong atau 0.
- Uang ditulis sebagai angka rupiah utuh tanpa titik/koma ribuan (Rp1.250.000 menjadi 1250000).
- Nilai valuta asing dan kurs (FOB, CIF, NDPBM, nilai tukar) ditulis angka dengan titik desimal tanpa pemisah ribuan (USD 8,821.05 menjadi 8821.05; Rp16.287,50 per USD menjadi 16287.5).
- Tanggal ditulis YYYY-MM-DD; tanggal Indonesia dibaca hari/bulan/tahun (07/10/2026 adalah 7 Oktober 2026).
- Untuk tabel (absen, mutasi, excel_karyawan) masukkan semua baris data, tanpa baris judul. Kolom bisa bernama lain atau berurutan acak (mis. "Gapok" berarti gaji pokok, "WA" berarti telepon, "Posisi" berarti jabatan).
- keyakinan jujur: rendah bila berkas buram, terpotong, atau jenisnya meragukan.
- bidang_json berisi objek JSON dengan bentuk persis sesuai jenis:
${JENIS.map((j) => `  ${j}: ${ringkasSkema(BIDANG[j])}`).join("\n")}`;

export type Hasil = { jenis: Jenis; keyakinan: number; ringkasan: string; bidang: Record<string, unknown> };

// ---------- xlsx ke teks ----------

const DEKODE: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const dekode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => DEKODE[m]).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function teksSi(si: string): string {
  return [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => dekode(m[1])).join("");
}

function kolomKeIndeks(ref: string): number {
  const huruf = ref.replace(/\d+/g, "");
  let n = 0;
  for (const h of huruf) n = n * 26 + (h.charCodeAt(0) - 64);
  return n - 1;
}

/** Nomor seri tanggal Excel (sistem 1900) ke YYYY-MM-DD. */
export function seriKeTanggal(seri: number): string {
  const ms = Math.round((seri - 25569) * 86400000);
  return new Date(ms).toISOString().slice(0, 10);
}

function gayaTanggal(styles: string | undefined): Set<number> {
  const hasil = new Set<number>();
  if (!styles) return hasil;
  const kustom = new Map<number, string>();
  for (const m of styles.matchAll(/<numFmt\s+numFmtId="(\d+)"\s+formatCode="([^"]*)"/g)) kustom.set(Number(m[1]), dekode(m[2]));
  const xfs = styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  [...xfs.matchAll(/<xf\b([^>]*)\/?>/g)].forEach((m, i) => {
    const id = Number(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0);
    const kode = kustom.get(id)?.replace(/"[^"]*"|\[[^\]]*\]/g, "") ?? "";
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dy]/i.test(kode)) hasil.add(i);
  });
  return hasil;
}

/** Isi zip xlsx (nama berkas -> byte) menjadi teks bergaya CSV per lembar, siap dibaca model. */
export function xlsxKeTeks(isi: Record<string, Uint8Array>, batasBaris = 2000): string {
  const dek = new TextDecoder();
  const baca = (n: string) => (isi[n] ? dek.decode(isi[n]) : undefined);
  const bersama = [...(baca("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => teksSi(m[1]));
  const tanggal = gayaTanggal(baca("xl/styles.xml"));
  const lembar = Object.keys(isi).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  const keluar: string[] = [];
  for (const nama of lembar) {
    const xml = baca(nama)!;
    const baris: string[] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const sel: string[] = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const atr = c[1];
        const dalam = c[2] ?? "";
        const ref = atr.match(/r="([A-Z]+\d+)"/)?.[1];
        const t = atr.match(/t="(\w+)"/)?.[1];
        const s = Number(atr.match(/s="(\d+)"/)?.[1] ?? -1);
        const v = dalam.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        let nilai = "";
        if (t === "s" && v !== undefined) nilai = bersama[Number(v)] ?? "";
        else if (t === "inlineStr") nilai = teksSi(dalam);
        else if (v !== undefined) nilai = t === "str" ? dekode(v) : tanggal.has(s) && !Number.isNaN(Number(v)) ? seriKeTanggal(Number(v)) : v;
        const i = ref ? kolomKeIndeks(ref) : sel.length;
        while (sel.length < i) sel.push("");
        sel[i] = /[",\n]/.test(nilai) ? `"${nilai.replace(/"/g, '""')}"` : nilai;
      }
      if (sel.some((x) => x !== "")) baris.push(sel.join(","));
      if (baris.length >= batasBaris) break;
    }
    keluar.push(`# ${nama.replace(/^xl\/worksheets\//, "").replace(/\.xml$/, "")}\n${baris.join("\n")}`);
  }
  return keluar.join("\n\n");
}

// ---------- usulan per jenis ----------

const rp = (n: unknown) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const panjang = (x: unknown) => (Array.isArray(x) ? x.length : 0);
const valuta = (n: unknown) => (Number(n) || 0).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kurs = (n: unknown) => "Rp" + (Number(n) || 0).toLocaleString("id-ID", { maximumFractionDigits: 4 });

export type Usulan = { aksi: string; judul: string; penjelasan: string; dampak_rp: number | null };

/** Satu usulan yang bisa disetujui pemilik, dari hasil bacaan. */
export function usulanDari(h: Hasil): Usulan {
  const b = h.bidang as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const yakin = `Dibaca dari berkas, yakin ${Math.round(h.keyakinan * 100)}%.`;
  switch (h.jenis) {
    case "nota":
      return { aksi: "uang.keluar", judul: `Catat belanja ${rp(b.total)} di ${b.pemasok || "pemasok"}`, penjelasan: `${panjang(b.baris)} barang, nota ${b.nomor || "tanpa nomor"}. ${yakin}`, dampak_rp: Number(b.total) || null };
    case "invoice":
      return { aksi: "uang.tagihan", judul: `Catat tagihan ${b.nomor || ""} ${rp(b.total)}`.replace(/\s+/g, " "), penjelasan: `${b.penjual} ke ${b.pembeli}, jatuh tempo ${b.jatuh_tempo || "tidak tertulis"}. ${yakin}`, dampak_rp: Number(b.total) || null };
    case "slip_gaji":
      return { aksi: "dokumen.slip_gaji", judul: `Simpan slip gaji ${b.nama} ${b.periode}`, penjelasan: `Gaji bersih ${rp(b.neto)}. ${yakin}`, dampak_rp: Number(b.neto) || null };
    case "ktp":
      return { aksi: "orang.buat", judul: `Tambah ${b.nama} ke daftar orang`, penjelasan: `Dari KTP; NIK disimpan terpisah dan hanya terlihat pemilik/admin. ${yakin}`, dampak_rp: null };
    case "cv":
      return { aksi: "rekrut.pelamar", judul: `Catat ${b.nama} sebagai pelamar ${b.posisi || ""}`.trim(), penjelasan: `${panjang(b.pengalaman)} pengalaman kerja. ${yakin}`, dampak_rp: null };
    case "surat_sakit":
      return { aksi: "izin.sakit", judul: `Catat izin sakit ${b.nama} ${b.lama_hari} hari`, penjelasan: `Mulai ${b.mulai}. ${yakin}`, dampak_rp: null };
    case "absen":
      return { aksi: "absen.impor", judul: `Masukkan ${panjang(b.baris)} baris absen`, penjelasan: yakin, dampak_rp: null };
    case "mutasi":
      return { aksi: "uang.mutasi", judul: `Cocokkan ${panjang(b.baris)} transaksi rekening`, penjelasan: `Nadi akan mencocokkan dengan nota dan tagihan yang sudah tercatat. ${yakin}`, dampak_rp: null };
    case "surat":
      return { aksi: "dokumen.surat", judul: `Arsipkan ${b.jenis || "surat"} ${b.nomor}`.trim(), penjelasan: `Untuk ${b.pihak || "-"}. ${yakin}`, dampak_rp: null };
    case "excel_karyawan":
      return { aksi: "orang.impor", judul: `Tambah ${panjang(b.baris)} orang dari Excel`, penjelasan: yakin, dampak_rp: null };
    case "pib": {
      const j = jurnalPib(b);
      return {
        aksi: "uang.impor",
        judul: `Catat impor PIB ${b.nomor_daftar || b.nomor_pengajuan || ""} dari ${b.pemasok || "pemasok"}: ${rp(j.cif + j.pungutan)}`.replace(/\s+/g, " "),
        penjelasan: `Persediaan ${rp(j.persediaan)}, PPN impor ${rp(j.ppn)} (pajak masukan), PPh 22 impor ${rp(j.pph)} (kredit pajak), utang ke pemasok ${b.valuta || ""} ${valuta(b.nilai_cif)} = ${rp(j.cif)} (NDPBM ${kurs(b.ndpbm)}), pungutan dibayar ${rp(j.pungutan)}. Disetujui = jurnal ini dicatat; ongkos kirim yang dibayar ke pihak lain sesuaikan sendiri. ${yakin}`,
        dampak_rp: j.cif + j.pungutan || null,
      };
    }
    case "peb":
      return { aksi: "dokumen.peb", judul: `Arsipkan PEB ${b.nomor_daftar || b.nomor_pengajuan || ""} ke ${b.pembeli || "pembeli"} (${b.negara_tujuan || "-"})`.replace(/\s+/g, " "), penjelasan: `Nilai FOB ${b.valuta || ""} ${valuta(b.nilai_fob)}. Penjualan ekspornya dicatat lewat invoice ekspor. ${yakin}`, dampak_rp: null };
    case "sppb":
      return { aksi: "dokumen.sppb", judul: `Arsipkan SPPB ${b.nomor || ""}`.trim(), penjelasan: `Barang PIB ${b.nomor_pib || "-"} boleh dikeluarkan dari kawasan pabean sejak ${b.tanggal || "-"}. ${yakin}`, dampak_rp: null };
    default:
      return { aksi: "berkas.tinjau", judul: `Tinjau berkas: ${b.judul || "tanpa judul"}`, penjelasan: `Nadi belum mengenali jenis berkas ini. ${yakin}`, dampak_rp: null };
  }
}

/**
 * Jurnal impor dari PIB (sama dengan trigger app.jurnal_pib di database): persediaan = CIF rupiah + bea masuk + cukai + PPnBM,
 * PPN impor = pajak masukan, PPh 22 impor = kredit pajak; kredit utang pemasok valas sebesar CIF rupiah dan bank sebesar pungutan.
 * CIF rupiah dari nilai pabean; bila kosong, nilai CIF x NDPBM.
 */
export function jurnalPib(b: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const n = (x: unknown) => Math.max(0, Math.round(Number(x) || 0));
  const cif = n(b.nilai_pabean_rp) || n((Number(b.nilai_cif) || 0) * (Number(b.ndpbm) || 0));
  const bm = n(b.bm), cukai = n(b.cukai), ppn = n(b.ppn), ppnbm = n(b.ppnbm), pph = n(b.pph);
  return { cif, bm, cukai, ppn, ppnbm, pph, persediaan: cif + bm + cukai + ppnbm, pungutan: bm + cukai + ppn + ppnbm + pph };
}

/**
 * Lampiran lamaran tanpa akun (Q-11, docs/quality/keamanan-f0.md A5): hanya boleh menjadi usulan pelamar. Bila model membacanya
 * sebagai jenis lain (nota, Excel karyawan, mutasi, ...), isinya tidak dipercaya: usulan tetap "catat pelamar" dengan nama dari
 * formulir lamaran dan peringatan untuk membuka berkasnya, sehingga orang luar tidak bisa menyelipkan usulan uang atau impor orang.
 */
export function usulanLamar(h: Hasil, namaPelamar: string): { usulan: Usulan; hasil: Hasil } {
  if (h.jenis === "cv") return { usulan: usulanDari(h), hasil: h };
  const aman: Hasil = {
    jenis: "cv",
    keyakinan: 0,
    ringkasan: `Lampiran lamaran terbaca sebagai ${h.jenis.replace(/_/g, " ")}, bukan CV.`,
    bidang: { nama: namaPelamar, posisi: "", pengalaman: [], keahlian: [] },
  };
  return {
    usulan: { ...usulanDari(aman), penjelasan: `Lampirannya bukan CV (terbaca sebagai ${h.jenis.replace(/_/g, " ")}). Buka berkasnya sebelum menyetujui.` },
    hasil: aman,
  };
}

// ---------- penilai eval ----------

const sama = (a: unknown, b: unknown) => String(a ?? "").trim().toLowerCase().replace(/\s+/g, " ") === String(b ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const angkaSama = (a: unknown, b: unknown) => Math.abs(Number(a) - Number(b)) < 0.5;

/** Bidang kunci per jenis yang harus benar agar satu berkas dihitung benar. */
export function nilai(jenisBenar: string, benar: Record<string, any>, h: Hasil): { benar: boolean; salah: string[]; diperiksa: number } { // eslint-disable-line @typescript-eslint/no-explicit-any
  const salah: string[] = [];
  let diperiksa = 0;
  if (h.jenis !== jenisBenar) return { benar: false, salah: [`jenis ${h.jenis} != ${jenisBenar}`], diperiksa: 0 };
  const b = h.bidang as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const cek = (nama: string, ok: boolean) => { diperiksa++; if (!ok) salah.push(nama); };
  switch (jenisBenar) {
    case "nota":
      cek("total", angkaSama(b.total, benar.total)); cek("tanggal", sama(b.tanggal, benar.tanggal)); cek("nomor", sama(b.nomor, benar.nomor)); cek("jumlah baris", panjang(b.baris) === panjang(benar.baris)); break;
    case "invoice":
      cek("nomor", sama(b.nomor, benar.nomor)); cek("total", angkaSama(b.total, benar.total)); cek("jatuh_tempo", sama(b.jatuh_tempo, benar.jatuh_tempo)); break;
    case "slip_gaji":
      cek("nama", sama(b.nama, benar.nama)); cek("neto", angkaSama(b.neto, benar.neto)); cek("periode", sama(b.periode, benar.periode)); break;
    case "ktp":
      cek("nik", sama(b.nik, benar.nik)); cek("nama", sama(b.nama, benar.nama)); cek("tanggal_lahir", sama(b.tanggal_lahir, benar.tanggal_lahir)); break;
    case "cv":
      cek("nama", sama(b.nama, benar.nama)); cek("posisi", sama(b.posisi, benar.posisi)); break;
    case "surat_sakit":
      cek("nama", sama(b.nama, benar.nama)); cek("mulai", sama(b.mulai, benar.mulai)); cek("lama_hari", angkaSama(b.lama_hari, benar.lama_hari)); break;
    case "absen":
    case "excel_karyawan":
    case "mutasi": {
      cek("jumlah baris", panjang(b.baris) === panjang(benar.baris));
      const k = jenisBenar === "mutasi" ? "jumlah" : "nama";
      const ab = (b.baris ?? [])[0]?.[k];
      cek(`baris pertama ${k}`, k === "jumlah" ? angkaSama(ab, benar.baris[0][k]) : sama(ab, benar.baris[0][k]));
      break;
    }
    case "surat":
      cek("nomor", sama(b.nomor, benar.nomor)); cek("pihak", sama(b.pihak, benar.pihak)); break;
    case "pib":
      for (const k of ["nomor_daftar", "tanggal_daftar", "pemasok", "valuta"]) cek(k, sama(b[k], benar[k]));
      for (const k of ["ndpbm", "nilai_cif", "nilai_pabean_rp", "bm", "ppn", "pph"]) cek(k, angkaSama(b[k], benar[k]));
      cek("jumlah baris", panjang(b.baris) === panjang(benar.baris));
      cek("HS baris pertama", sama((b.baris ?? [])[0]?.hs, benar.baris?.[0]?.hs));
      break;
    case "peb":
      for (const k of ["nomor_daftar", "tanggal_daftar", "pembeli", "negara_tujuan", "valuta"]) cek(k, sama(b[k], benar[k]));
      cek("nilai_fob", angkaSama(b.nilai_fob, benar.nilai_fob));
      cek("jumlah baris", panjang(b.baris) === panjang(benar.baris));
      break;
    case "sppb":
      for (const k of ["nomor", "tanggal", "nomor_pib"]) cek(k, sama(b[k], benar[k]));
      break;
  }
  return { benar: salah.length === 0, salah, diperiksa };
}
