// U-05 daftar "Mulai di Nadi" (docs/design/REKONSTRUKSI-APP.md bagian 6, NN/g 2023: daftar langkah yang dikerjakan pengguna sendiri,
// bukan tur kartu pembuka). Langkah dipilih menurut modul yang menyala untuk paket usaha (U-06) dan dicentang dari data, bukan dari
// klik: langkah selesai selama datanya ada (orang aktif, produk aktif, invoice yang tidak dibatalkan), jadi tidak ada status
// tersimpan yang bisa melenceng. Paling banyak 7 langkah.
import type { Teks2 } from "@/lib/ruang";

export type Fakta = {
  berkas: number;
  orang: number;
  produk: number;
  invoice: number;
  ai: number;
  staf: number;
  servis: number;
  janji: number;
};

export type Langkah = { id: string; label: Teks2; guna: Teks2; href: string; selesai: boolean };

type Calon = Omit<Langkah, "selesai"> & { modul?: string; fakta: keyof Fakta };

const CALON: readonly Calon[] = [
  { id: "lempar", fakta: "berkas", href: "/app/lempar",
    label: { id: "Lempar berkas pertama", en: "Drop your first file" },
    guna: { id: "Foto nota, slip, atau Excel. Nadi membacanya jadi usulan.", en: "A receipt photo, payslip, or Excel. Nadi turns it into a proposal." } },
  { id: "orang", fakta: "orang", href: "/app/orang",
    label: { id: "Tambah orang yang bekerja", en: "Add the people who work here" },
    guna: { id: "Dasar absen, gaji, dan izin.", en: "The base for attendance, pay, and leave." } },
  { id: "produk", fakta: "produk", modul: "stok", href: "/app/barang",
    label: { id: "Tambah barang yang kamu jual", en: "Add what you sell" },
    guna: { id: "Dipakai kasir, invoice, dan hitung stok.", en: "Used by the till, invoices, and stock counts." } },
  { id: "servis", fakta: "servis", modul: "servis", href: "/app/servis",
    label: { id: "Terima order servis pertama", en: "Take your first service order" },
    guna: { id: "Pelanggan bisa cek status lewat tautan.", en: "Customers can check status from a link." } },
  { id: "janji", fakta: "janji", modul: "janji", href: "/app/janji-temu",
    label: { id: "Buka jadwal janji temu", en: "Open booking slots" },
    guna: { id: "Pelanggan memesan jam tanpa bentrok.", en: "Customers book times without clashes." } },
  { id: "invoice", fakta: "invoice", href: "/app/invoice",
    label: { id: "Buat invoice pertama", en: "Create your first invoice" },
    guna: { id: "Dengan QRIS, pengingat, dan jurnal otomatis.", en: "With QRIS, reminders, and automatic journal entries." } },
  { id: "ai", fakta: "ai", href: "/app/siapkan",
    label: { id: "Sambungkan AI-mu", en: "Connect your AI" },
    guna: { id: "ChatGPT, Gemini, atau asisten lain menyiapkan datamu untuk kamu periksa.", en: "ChatGPT, Gemini, or another assistant prepares your data for you to review." } },
  { id: "staf", fakta: "staf", href: "/app/orang#daftar-orang",
    label: { id: "Ajak staf absen dari HP", en: "Let staff clock in from their phone" },
    guna: { id: "Buat akun staf dengan PIN, tanpa email.", en: "Create staff accounts with a PIN, no email." } },
];

export const MAKS_LANGKAH = 7;

/** Langkah untuk satu usaha: yang modulnya menyala, paling banyak 7, urut seperti CALON. */
export function langkahMulai(nyala: ReadonlySet<string>, fakta: Fakta): Langkah[] {
  return CALON.filter((c) => !c.modul || nyala.has(c.modul))
    .slice(0, MAKS_LANGKAH)
    .map((c) => ({ id: c.id, label: c.label, guna: c.guna, href: c.href, selesai: fakta[c.fakta] > 0 }));
}

/** Nama cookie penutup daftar, per usaha (daftar usaha lain tetap tampil). */
export const cookieMulai = (pid: string) => `nadi_mulai_${pid.replace(/-/g, "")}`;
