// Teks Nadi (W-04): cetak biru onboarding yang ditulis AI milik pengguna (chat gratis atau lewat MCP), diurai dengan aturan
// tanpa model. Keluaran AI = masukan tak tepercaya (docs/quality/injeksi-prompt.md): setiap baris diperiksa, yang dikenali menjadi
// usulan untuk disetujui pemilik, yang lain ditampilkan dengan alasannya. Tidak ada angka uang, NIK, atau perintah yang diterima.
// Format teks berlabel (bisa dibaca dan disunting orang) dan JSON setara keduanya diterima.

export const KEPALA = "NADI ONBOARDING 1";
export type AksiOnboarding = "orang.impor" | "onboarding.usaha" | "onboarding.fitur" | "onboarding.izin";
export type Butir = { aksi: AksiOnboarding; judul: string; bidang: Record<string, unknown> };
export type AlasanTolak = "tanpa_kepala" | "nik" | "uang" | "perintah" | "nama" | "tanggal" | "tak_dikenal" | "negara" | "fitur" | "izin" | "kosong" | "json" | "terlalu_banyak";
export type BarisPratinjau = { no: number; teks: string; dikenali: boolean; alasan?: AlasanTolak; detail?: string };
export type HasilUrai = { butir: Butir[]; baris: BarisPratinjau[]; galat?: AlasanTolak };

export const FITUR: Record<string, string> = {
  lempar: "lempar", feed: "feed", absen: "absen", izin: "izin", cuti: "izin", gaji: "gaji", jadwal: "jadwal", shift: "jadwal", kerja: "kerja", tugas: "kerja",
  invoice: "invoice", tagihan: "invoice", penjualan: "jual", jual: "jual", pembelian: "beli", beli: "beli", stok: "barang", barang: "barang", gudang: "barang",
  kas: "kas", bank: "kas", buku: "buku", laporan: "buku", "laporan keuangan": "buku", pajak: "pajak", surat: "surat", mata: "mata", kamera: "mata",
  peta: "peta", "peta usaha": "peta", rekrut: "rekrut", lowongan: "rekrut", magang: "magang",
};
const NEGARA: Record<string, string> = { indonesia: "ID", id: "ID", malaysia: "MY", my: "MY", singapura: "SG", singapore: "SG", sg: "SG" };
const MAKS_ORANG = 60;
const PERINTAH = /^(HAPUS|BAYAR|TRANSFER|KIRIM|SETUJUI|TOLAK|JALANKAN|DELETE|DROP|UPDATE|INSERT|ABAIKAN|LUPAKAN|IGNORE)\b/i;
const NIK = /\d{12,}/;
// Nominal uang dalam bentuk apa pun, atau kata gaji/upah yang diikuti angka (kata "Gaji" sebagai nama fitur tetap boleh).
const UANG = /(\bRP\s?\d|\d[\d.,]*\s?(RB|RIBU|JT|JUTA)\b|\b(GAJI|UPAH|SALARY|IDR)\b[^0-9\n]{0,12}\d)/i;

const tanggalSah = (t: string, hari: string) => /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(`${t}T00:00:00Z`))
  && new Date(`${t}T00:00:00Z`).toISOString().slice(0, 10) === t && t <= hari && t >= "1950-01-01";
const namaSah = (n: string) => /^[\p{L}][\p{L} .'-]{1,79}$/u.test(n) && !/\d/.test(n);
const rapikanNama = (n: string) => n.replace(/\s+/g, " ").trim();

function skalaDari(n: number): string | null {
  if (!Number.isInteger(n) || n < 1 || n > 100000) return null;
  return n === 1 ? "1" : n <= 5 ? "2-5" : n <= 15 ? "6-15" : n <= 50 ? "16-50" : "50+";
}

type Orang = { nama: string; topi: string[]; mulai?: string };
type Izin = { jenis: "sakit" | "izin" | "cuti"; otomatis: boolean; maks_hari: number; butuh_bukti: boolean; jatah_tahunan: number | null };

function butirOrang(o: Orang): Butir {
  return { aksi: "orang.impor", judul: `Tambah ${o.nama}${o.topi.length ? ` sebagai ${o.topi.join(", ")}` : ""}`,
    bidang: { baris: [{ id: "", nama: o.nama, jabatan: o.topi.join(", "), telepon: "", mulai: o.mulai ?? "" }] } };
}
const butirIzin = (z: Izin): Butir => ({ aksi: "onboarding.izin", judul: `Aturan ${z.jenis}: ${z.otomatis ? `otomatis sampai ${z.maks_hari} hari` : "selalu ditinjau"}${z.butuh_bukti ? ", wajib bukti" : ""}`, bidang: { ...z } });

/** Satu klausa aturan izin: "sakit otomatis 1 hari", "wajib surat dokter", "cuti 12 hari setahun". */
function uraiIzin(teks: string): Izin[] | null {
  const hasil = new Map<Izin["jenis"], Izin>();
  let terakhir: Izin["jenis"] | null = null;
  for (const k of teks.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean)) {
    const jenis: Izin["jenis"] | null = (/\b(sakit|izin|cuti)\b/.exec(k)?.[1] as Izin["jenis"] | undefined) ?? terakhir;
    if (!jenis) return null;
    terakhir = jenis;
    const z = hasil.get(jenis) ?? { jenis, otomatis: false, maks_hari: 0, butuh_bukti: false, jatah_tahunan: null };
    let paham = false;
    const oto = /otomatis\s+(\d{1,2})\s+hari/.exec(k);
    if (oto) { z.otomatis = true; z.maks_hari = Number(oto[1]); paham = true; }
    if (/wajib\s+(surat|bukti|foto)/.test(k)) { z.butuh_bukti = true; paham = true; }
    if (/(tidak|tanpa)\s+otomatis|selalu\s+ditinjau/.test(k)) { z.otomatis = false; z.maks_hari = 0; paham = true; }
    const jatah = /(\d{1,2})\s+hari\s+(setahun|per\s+tahun|sehari|tahunan)/.exec(k);
    if (jatah && !oto) { z.jatah_tahunan = Number(jatah[1]); paham = true; }
    if (!paham || z.maks_hari > 30 || (z.jatah_tahunan ?? 0) > 60) return null;
    hasil.set(jenis, z);
  }
  return hasil.size ? [...hasil.values()] : null;
}

function tolakUmum(t: string): AlasanTolak | undefined {
  if (NIK.test(t.replace(/[\s.-]/g, ""))) return "nik";
  if (PERINTAH.test(t.replace(/^[-*\s]+/, ""))) return "perintah";
  if (UANG.test(t)) return "uang";
  return undefined;
}

export function uraiTeksNadi(masukan: string, hari: string): HasilUrai {
  const t = masukan.replace(/^﻿/, "").trim();
  if (!t) return { butir: [], baris: [], galat: "kosong" };
  if (t.startsWith("{")) return uraiJsonNadi(t, hari);
  // Model chat sering menebalkan atau memberi kode pada baris (Markdown): tandanya dibuang sebelum dibaca.
  const garis = t.split(/\r?\n/).map((g) => g.replace(/\*\*|__|`/g, ""));
  const baris: BarisPratinjau[] = [];
  const butir: Butir[] = [];
  const mulai = garis.findIndex((g) => g.trim().toUpperCase() === KEPALA);
  if (mulai < 0) return { butir: [], baris: [], galat: "tanpa_kepala" };
  const usaha: Record<string, unknown> = {};
  let bagian: "orang" | null = null;
  let orang = 0;
  const catat = (no: number, teks: string, alasan?: AlasanTolak, detail?: string) => baris.push({ no, teks, dikenali: !alasan, alasan, detail });
  for (let i = mulai + 1; i < garis.length; i++) {
    const teks = garis[i].trim();
    const no = i + 1;
    if (!teks || teks.startsWith("#") || /^```/.test(teks)) continue;
    const tolak = tolakUmum(teks);
    if (tolak) { catat(no, teks, tolak); continue; }
    const label = /^([A-Z][A-Z ]{1,20}):\s*(.*)$/i.exec(teks);
    if (bagian === "orang" && teks.startsWith("-")) {
      const [nama, topi = "", sisa = ""] = teks.slice(1).split("|").map((s) => s.trim());
      const n = rapikanNama(nama ?? "");
      if (!namaSah(n)) { catat(no, teks, "nama"); continue; }
      const tgl = /mulai\s+(\S+)/i.exec(sisa)?.[1];
      if (tgl && !tanggalSah(tgl, hari)) { catat(no, teks, "tanggal"); continue; }
      if (++orang > MAKS_ORANG) { catat(no, teks, "terlalu_banyak"); continue; }
      butir.push(butirOrang({ nama: n, topi: topi.split(/,|\/|&|\+|\s+(?:dan|merangkap|sekaligus)\s+/i).map((s) => s.trim().toLowerCase()).filter((s) => s && s.length <= 40).slice(0, 5), mulai: tgl }));
      catat(no, teks);
      continue;
    }
    if (!label) { catat(no, teks, "tak_dikenal"); continue; }
    bagian = null;
    const kunci = label[1].trim().toUpperCase();
    const isi = label[2].trim();
    if (kunci === "ORANG" && !isi) { bagian = "orang"; catat(no, teks); continue; }
    if (kunci === "USAHA" || kunci === "JENIS") { usaha[kunci === "USAHA" ? "nama" : "jenis"] = isi.slice(0, 80); catat(no, teks); continue; }
    if (["KOTA", "NEGARA", "ORANG", "CABANG"].includes(kunci)) {
      // Satu baris bisa berisi beberapa label dipisah "|".
      let rusak: AlasanTolak | undefined;
      for (const bag of teks.split("|").map((s) => s.trim())) {
        const m = /^([A-Z]+):\s*(.*)$/i.exec(bag);
        if (!m) { rusak = "tak_dikenal"; break; }
        const k = m[1].toUpperCase(), v = m[2].trim();
        if (k === "KOTA") usaha.kota = v.slice(0, 80);
        else if (k === "NEGARA") { const kode = NEGARA[v.toLowerCase()]; if (!kode) { rusak = "negara"; break; } usaha.negara = kode; }
        else if (k === "ORANG") { const s = skalaDari(Number(v)); if (!s) { rusak = "tak_dikenal"; break; } usaha.skala = s; }
        else if (k === "CABANG") { const c = Number(v); if (!Number.isInteger(c) || c < 1 || c > 500) { rusak = "tak_dikenal"; break; } usaha.cabang = c; }
        else { rusak = "tak_dikenal"; break; }
      }
      catat(no, teks, rusak);
      continue;
    }
    if (kunci === "FITUR") {
      const nama = isi.split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      const kenal = [...new Set(nama.map((n) => FITUR[n]).filter(Boolean))];
      const asing = nama.filter((n) => !FITUR[n]);
      if (!kenal.length) { catat(no, teks, "fitur"); continue; }
      butir.push({ aksi: "onboarding.fitur", judul: `Pakai fitur: ${kenal.join(", ")}`, bidang: { fitur: kenal } });
      catat(no, teks, undefined, asing.length ? asing.join(", ") : undefined);
      continue;
    }
    if (kunci === "ATURAN IZIN") {
      const z = uraiIzin(isi);
      if (!z) { catat(no, teks, "izin"); continue; }
      butir.push(...z.map(butirIzin));
      catat(no, teks);
      continue;
    }
    catat(no, teks, "tak_dikenal");
  }
  if (usaha.kota || usaha.negara || usaha.skala || usaha.cabang) butir.unshift(butirUsaha(usaha));
  return { butir, baris };
}

function butirUsaha(u: Record<string, unknown>): Butir {
  const bagian = [u.jenis, u.kota, u.skala ? `${u.skala} orang` : null, u.cabang ? `${u.cabang} cabang` : null].filter(Boolean);
  return { aksi: "onboarding.usaha", judul: `Atur profil usaha: ${bagian.join(", ")}`, bidang: { negara: u.negara ?? "ID", kota: u.kota ?? null, skala: u.skala ?? null, cabang: u.cabang ?? null, jenis: u.jenis ?? null } };
}

/** JSON setara: {"nadi_onboarding": 1, "usaha": {...}, "orang": [{nama, topi: [], mulai}], "fitur": [], "aturan_izin": "teks klausa"}. */
export function uraiJsonNadi(t: string, hari: string): HasilUrai {
  let j: unknown;
  try { j = JSON.parse(t); } catch { return { butir: [], baris: [], galat: "json" }; }
  const o = j as { nadi_onboarding?: unknown; usaha?: Record<string, unknown>; orang?: unknown[]; fitur?: unknown[]; aturan_izin?: unknown };
  if (!o || typeof o !== "object" || o.nadi_onboarding !== 1) return { butir: [], baris: [], galat: "tanpa_kepala" };
  // Ubah ke Teks Nadi lalu urai dengan aturan yang sama, supaya kedua format tidak pernah berbeda perlakuan.
  const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");
  const u = o.usaha ?? {};
  const g = [KEPALA];
  if (s(u.nama)) g.push(`USAHA: ${s(u.nama)}`);
  if (s(u.jenis)) g.push(`JENIS: ${s(u.jenis)}`);
  const profil = [["KOTA", u.kota], ["NEGARA", u.negara], ["ORANG", u.orang], ["CABANG", u.cabang]].filter(([, v]) => s(v)).map(([k, v]) => `${k}: ${s(v)}`);
  if (profil.length) g.push(profil.join(" | "));
  if (Array.isArray(o.orang) && o.orang.length) {
    g.push("ORANG:");
    for (const r of o.orang) {
      const x = (r ?? {}) as Record<string, unknown>;
      g.push(`- ${s(x.nama).replace(/[|\n]/g, " ")} | ${(Array.isArray(x.topi) ? x.topi.map(s) : [s(x.topi)]).join(", ").replace(/[|\n]/g, " ")}${s(x.mulai) ? ` | mulai ${s(x.mulai)}` : ""}${Object.keys(x).some((k) => /gaji|upah|nik/i.test(k)) ? " | gaji 1" : ""}`);
    }
  }
  if (Array.isArray(o.fitur) && o.fitur.length) g.push(`FITUR: ${o.fitur.map(s).join(", ")}`);
  if (s(o.aturan_izin)) g.push(`ATURAN IZIN: ${s(o.aturan_izin).replace(/\n/g, " ")}`);
  return uraiTeksNadi(g.join("\n"), hari);
}
