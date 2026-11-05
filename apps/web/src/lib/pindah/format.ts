// M-24 pindah dari aplikasi lain: kenali berkas ekspor/template dari judul kolomnya lalu ubah barisnya ke bentuk Nadi, tanpa model.
// Kolom Jurnal dari pusat bantuan resminya (help-center.jurnal.id, dibaca 6 Nov 2026): Akun/COA (*Account Name, Account Number,
// *Category Number, Opening Balance, ...), Kontak (*Type customer/vendor/employee/others dipisah titik koma, *Display Name, ...),
// Penagihan Penjualan (dikenali, belum dipindahkan). Template karyawan Talenta tidak dipublikasikan, jadi daftar karyawan dan produk
// dikenali dari sinonim judul kolom umum (Indonesia dan Inggris).

export type Format = "akun" | "kontak" | "produk" | "karyawan";
export type HasilPindah =
  | { format: Format; sumber: "jurnal" | "umum"; baris: Record<string, unknown>[]; dilewati: number }
  | { format: "penagihan"; sumber: "jurnal"; belum: true }
  | null;

const judul = (s: unknown) => String(s ?? "").replace(/^﻿/, "").trim().toLowerCase().replace(/^[*#]+\s*/, "").replace(/\s+/g, " ");
const isi = (s: unknown) => String(s ?? "").trim().replace(/^'/, "");

/** CSV/TSV sederhana dengan kutip; pemisah dipilih dari baris pertama (titik koma, koma, atau tab). */
export function uraiCsv(teks: string): string[][] {
  const t = teks.replace(/^﻿/, "");
  const pertama = t.split(/\r?\n/, 1)[0] ?? "";
  const pisah = [";", "\t", ","].sort((a, b) => pertama.split(b).length - pertama.split(a).length)[0];
  const baris: string[][] = [];
  let sel = "", r: string[] = [], kutip = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (kutip) {
      if (c === '"' && t[i + 1] === '"') { sel += '"'; i++; } else if (c === '"') kutip = false; else sel += c;
    } else if (c === '"' && sel === "") kutip = true;
    else if (c === pisah) { r.push(sel); sel = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      r.push(sel); sel = "";
      if (r.some((x) => x.trim() !== "")) baris.push(r);
      r = [];
    } else sel += c;
  }
  r.push(sel);
  if (r.some((x) => x.trim() !== "")) baris.push(r);
  return baris;
}

/** Angka rupiah/jumlah: "Rp3.200.000", "2,500,000", "1.250,50", "(5000)" negatif. null bila bukan angka. */
export function angka(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = isi(v).replace(/rp\.?/i, "").replace(/\s/g, "");
  if (!s) return null;
  // T-01C: singkatan rupiah sehari-hari "72rb", "4,5jt", "1,2 juta".
  const singkat = /^(\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta)$/i.exec(s);
  if (singkat) return Number(singkat[1].replace(",", ".")) * (/^(jt|juta)$/i.test(singkat[2]) ? 1_000_000 : 1_000);
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()-]/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return (neg ? -1 : 1) * Number(s);
}

/** Tanggal: Date, YYYY-MM-DD, atau DD/MM/YYYY (format Indonesia dan Jurnal). */
export function tanggal(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = isi(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m && Number(m[2]) <= 12 && Number(m[1]) <= 31) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function hp(v: unknown): string | null {
  const d = isi(v).replace(/[^0-9]/g, "");
  if (/^0\d{8,13}$/.test(d)) return `62${d.slice(1)}`;
  if (/^62\d{8,13}$/.test(d)) return d;
  return null;
}

function kolom(kepala: string[], ...nama: string[]): number {
  for (const n of nama) { const i = kepala.indexOf(n); if (i >= 0) return i; }
  return -1;
}

const NAMA = ["nama", "nama lengkap", "nama karyawan", "full name", "employee name", "name"];
const NAMA_PRODUK = ["nama produk", "nama barang", "product name", "nama item", "produk", "nama", "name"];

export function kenali(rows: unknown[][]): HasilPindah {
  const i0 = rows.findIndex((r) => r.filter((x) => isi(x) !== "").length >= 2);
  if (i0 < 0) return null;
  const k = rows[i0].map(judul);
  const data = rows.slice(i0 + 1).filter((r) => r.some((x) => isi(x) !== ""));
  const ada = (...n: string[]) => kolom(k, ...n) >= 0;
  const ambil = (r: unknown[], ...n: string[]) => { const i = kolom(k, ...n); return i >= 0 ? r[i] : undefined; };
  let dilewati = 0;

  if (ada("account name") && ada("category number")) {
    const baris = data.flatMap((r) => {
      const nama = isi(ambil(r, "account name"));
      const kat = angka(ambil(r, "category number"));
      if (!nama || kat === null || kat < 1 || kat > 17) { dilewati++; return []; }
      const saldo = angka(ambil(r, "opening balance"));
      return [{ kode_asal: isi(ambil(r, "account number")) || undefined, nama, kategori: Math.round(kat), ...(saldo ? { saldo: Math.round(saldo) } : {}) }];
    });
    return { format: "akun", sumber: "jurnal", baris, dilewati };
  }
  if (ada("display name") && ada("type")) {
    const baris = data.flatMap((r) => {
      const nama = isi(ambil(r, "display name"));
      if (!nama) { dilewati++; return []; }
      const tipe = isi(ambil(r, "type")).toLowerCase().split(";").map((x) => x.trim()).filter(Boolean);
      return [{ tipe, nama, perusahaan: isi(ambil(r, "company name")) || undefined, email: isi(ambil(r, "email")) || undefined,
        hp: hp(ambil(r, "mobile")) ?? hp(ambil(r, "phone")) ?? undefined, kota: isi(ambil(r, "billing address city")) || undefined }];
    });
    return { format: "kontak", sumber: "jurnal", baris, dilewati };
  }
  if (ada("invoice date") && (ada("unit price") || ada("product name"))) return { format: "penagihan", sumber: "jurnal", belum: true };

  const adaNama = ada(...NAMA) || (ada("first name") && ada("last name"));
  if (adaNama && ada("jabatan", "posisi", "job position", "position", "job title", "tanggal masuk", "tgl masuk", "tanggal bergabung", "join date", "start date",
    "nik karyawan", "id karyawan", "employee id", "kode karyawan", "nip", "gaji pokok", "basic salary")) {
    const baris = data.flatMap((r) => {
      const nama = isi(ambil(r, ...NAMA)) || [isi(ambil(r, "first name")), isi(ambil(r, "last name"))].filter(Boolean).join(" ");
      if (nama.length < 2) { dilewati++; return []; }
      const gaji = angka(ambil(r, "gaji pokok", "basic salary", "gaji", "salary"));
      return [{ id: isi(ambil(r, "nik karyawan", "id karyawan", "employee id", "kode karyawan", "nip")) || undefined, nama,
        jabatan: isi(ambil(r, "jabatan", "posisi", "job position", "position", "job title")) || undefined,
        telepon: hp(ambil(r, "no hp", "hp", "nomor hp", "no telepon", "telepon", "mobile phone", "mobile", "phone", "whatsapp")) ?? undefined,
        mulai: tanggal(ambil(r, "tanggal masuk", "tgl masuk", "tanggal bergabung", "mulai bekerja", "join date", "start date")) ?? undefined,
        ...(gaji && gaji > 0 ? { gaji_pokok: Math.round(gaji) } : {}) }];
    });
    return { format: "karyawan", sumber: "umum", baris, dilewati };
  }
  if (ada(...NAMA_PRODUK) && ada("harga jual", "harga", "price", "sell price", "selling price", "harga satuan", "kode produk", "kode barang", "sku")) {
    const baris = data.flatMap((r) => {
      const nama = isi(ambil(r, ...NAMA_PRODUK));
      if (nama.length < 2) { dilewati++; return []; }
      const harga = angka(ambil(r, "harga jual", "harga", "price", "sell price", "selling price", "harga satuan"));
      const stok = angka(ambil(r, "stok", "stock", "qty", "jumlah", "quantity"));
      return [{ kode: isi(ambil(r, "kode produk", "kode barang", "sku", "kode", "product code", "code")) || undefined, nama,
        satuan: isi(ambil(r, "satuan", "unit", "uom")) || undefined, harga_jual: harga !== null && harga >= 0 ? Math.round(harga) : 0,
        ...(stok !== null && stok > 0 ? { stok } : {}) }];
    });
    return { format: "produk", sumber: "umum", baris, dilewati };
  }
  return null;
}
